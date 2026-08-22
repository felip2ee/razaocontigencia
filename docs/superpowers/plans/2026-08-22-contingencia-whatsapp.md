# Sistema de contingência de números de WhatsApp — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a agenda de papel e a fita adesiva por um sistema web local que cadastra aparelhos, chips e contas de WhatsApp, registra restrições e bans, e sorteia tarefas diárias de aquecimento por idade do número.

**Architecture:** Next.js 16 App Router com leitura em Server Components direto do PostgreSQL via Drizzle, e escrita em Server Actions que chamam `refresh()`. Não há API REST, estado de cliente, nem autenticação. As regras de integridade vivem como constraints no banco; a única lógica pura testada é o motor de sorteio de aquecimento.

**Tech Stack:** Next.js 16.2.6, React 19.2.4, TypeScript, Tailwind 4, shadcn sobre Base UI, Drizzle ORM com node-postgres, PostgreSQL 17 em Docker Compose, `node:test` para testes.

**Spec:** `docs/superpowers/specs/2026-08-22-contingencia-whatsapp-design.md`

## Global Constraints

- **Toda `page.tsx` que lê o banco leva `export const dynamic = "force-dynamic"`.** Sem isso o Next 16 prerenderiza a rota como estática e serve dados congelados do momento do build para qualquer sessão nova — `refresh()` refresca o client router mas não invalida prerender. Verificado empiricamente na Task 4. Confirme no `npm run build` que a rota aparece como `ƒ`, não `○`.
- Diretório de trabalho: `razao-contigencia/`. Todos os caminhos deste plano são relativos a ele.
- Next.js 16: `params` em rota dinâmica é `Promise` e precisa de `await`. Server Actions usam `refresh()` de `next/cache`, não `revalidatePath` — as páginas leem o banco sem cache, então basta re-renderizar a rota.
- Node.js 24: executa TypeScript nativamente (type stripping). Não instalar transpilador para testes nem para scripts.
- Nenhuma dependência de validação (Zod ou equivalente). As regras que importam são constraints do PostgreSQL.
- Nenhuma autenticação, multiusuário, permissão ou log de auditoria.
- Rótulos de interface em português.
- Arquivos dentro de `lib/` importam uns aos outros por caminho relativo (`./schema.ts`), porque scripts avulsos rodam fora do resolvedor de alias do Next. Arquivos em `app/` e `components/` usam o alias `@/`.
- O estado de restrição e ban é derivado: uma conta está restrita ou banida se existe um `incident` seu com `fim` nulo. Nunca criar campo de status de incidente na tabela `account`.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `docker-compose.yml` | PostgreSQL 17 local com volume nomeado |
| `.env.local` | `DATABASE_URL` (não versionado — `.gitignore` já cobre `.env*`) |
| `drizzle.config.ts` | Configuração do drizzle-kit |
| `drizzle/` | Migrations SQL geradas, versionadas |
| `lib/schema.ts` | As seis tabelas e os enums |
| `lib/db.ts` | Client Drizzle, singleton |
| `lib/warmup.ts` | Faixas de idade e sorteio — funções puras, sem banco |
| `lib/warmup.test.ts` | Testes do motor de sorteio |
| `lib/seed.ts` | Popula o catálogo de ações |
| `lib/queries.ts` | Todas as leituras usadas pelas páginas |
| `lib/actions.ts` | Todas as Server Actions de escrita |
| `app/layout.tsx` | Modificado: cabeçalho com navegação e busca |
| `app/page.tsx` | Painel |
| `app/cadastro/page.tsx` | Cadastro de aparelho, chip e conta |
| `app/aparelho/[id]/page.tsx` | Ficha do aparelho |
| `app/chip/[id]/page.tsx` | Ficha do chip |
| `app/aquecimento/page.tsx` | Tarefas do dia |
| `app/busca/route.ts` | Resolve um ID digitado e redireciona |
| `components/busca.tsx` | Campo de busca do cabeçalho |
| `components/incident-form.tsx` | Formulários de registrar e encerrar incidente |

---

## Task 1: Banco, schema e migration — CONCLUÍDA (commit 9b8ed99, review limpa)

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.local`
- Create: `drizzle.config.ts`
- Create: `lib/schema.ts`
- Create: `lib/db.ts`
- Modify: `package.json` (dependências e scripts)

**Interfaces:**
- Consumes: nada.
- Produces: `lib/schema.ts` exporta as tabelas `device`, `chip`, `account`, `incident`, `warmupAction`, `warmupTask`. `lib/db.ts` exporta `db` (instância Drizzle) e reexporta `schema` como namespace.

- [x] **Step 1: Instalar dependências**

```bash
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg
```

- [x] **Step 2: Criar o docker-compose.yml**

```yaml
services:
  db:
    image: postgres:17-alpine
    container_name: contingencia-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: contingencia
    ports:
      - "5432:5432"
    volumes:
      - contingencia-data:/var/lib/postgresql/data

volumes:
  contingencia-data:
```

- [x] **Step 3: Criar o .env.local**

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/contingencia
```

- [x] **Step 4: Subir o banco**

Run: `docker compose up -d`
Expected: container `contingencia-db` em execução. Confirmar com `docker compose ps`.

- [x] **Step 5: Escrever o schema**

Criar `lib/schema.ts`:

```ts
import { sql } from "drizzle-orm"
import {
  date,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const deviceStatus = pgEnum("device_status", ["ativo", "quarentena", "aposentado"])
export const chipStatus = pgEnum("chip_status", ["novo", "em_uso", "aposentado"])
export const chipLocal = pgEnum("chip_local", ["pasta", "gaveta", "bandeja"])
export const accountSlot = pgEnum("account_slot", ["wa1", "wa2", "business"])
export const accountStatus = pgEnum("account_status", ["ativa", "aposentada"])
export const incidentTipo = pgEnum("incident_tipo", ["restricao", "ban"])
export const incidentResultado = pgEnum("incident_resultado", ["pendente", "recuperada", "perdida"])
export const warmupCategoria = pgEnum("warmup_categoria", ["conversa", "perfil", "grupo", "midia"])
export const warmupTaskStatus = pgEnum("warmup_task_status", ["pendente", "feito", "pulado"])

export const device = pgTable("device", {
  id: text("id").primaryKey(),
  apelido: text("apelido"),
  status: deviceStatus("status").notNull().default("ativo"),
  notas: text("notas"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const chip = pgTable("chip", {
  id: text("id").primaryKey(),
  operadora: text("operadora").notNull(),
  numero: text("numero").notNull(),
  status: chipStatus("status").notNull().default("novo"),
  local: chipLocal("local").notNull().default("pasta"),
  posicao: text("posicao"),
  bandejaDeviceId: text("bandeja_device_id").references(() => device.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const account = pgTable(
  "account",
  {
    id: serial("id").primaryKey(),
    deviceId: text("device_id")
      .notNull()
      .references(() => device.id),
    slot: accountSlot("slot").notNull(),
    chipId: text("chip_id")
      .notNull()
      .references(() => chip.id),
    ativadaEm: date("ativada_em").notNull(),
    status: accountStatus("status").notNull().default("ativa"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("account_slot_ativo")
      .on(t.deviceId, t.slot)
      .where(sql`${t.status} = 'ativa'`),
    uniqueIndex("account_chip_ativo")
      .on(t.chipId)
      .where(sql`${t.status} = 'ativa'`),
  ],
)

export const incident = pgTable(
  "incident",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => account.id),
    tipo: incidentTipo("tipo").notNull(),
    inicio: timestamp("inicio", { withTimezone: true }).notNull().defaultNow(),
    fim: timestamp("fim", { withTimezone: true }),
    resultado: incidentResultado("resultado"),
    notas: text("notas"),
  },
  (t) => [
    uniqueIndex("incident_aberto_unico")
      .on(t.accountId)
      .where(sql`${t.fim} is null`),
  ],
)

export const warmupAction = pgTable("warmup_action", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull().unique(),
  categoria: warmupCategoria("categoria").notNull(),
  idadeMinDias: integer("idade_min_dias").notNull().default(0),
  idadeMaxDias: integer("idade_max_dias"),
  peso: integer("peso").notNull().default(1),
})

export const warmupTask = pgTable(
  "warmup_task",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => account.id),
    actionId: integer("action_id")
      .notNull()
      .references(() => warmupAction.id),
    data: date("data").notNull(),
    parAccountId: integer("par_account_id").references(() => account.id),
    status: warmupTaskStatus("status").notNull().default("pendente"),
    feitoEm: timestamp("feito_em", { withTimezone: true }),
  },
  (t) => [uniqueIndex("warmup_task_unica").on(t.accountId, t.actionId, t.data)],
)
```

Três constraints carregam regra de negócio e merecem atenção: `account_slot_ativo` impede duas contas ativas no mesmo slot do mesmo aparelho; `account_chip_ativo` impede um chip servir duas contas ativas; `incident_aberto_unico` impede dois incidentes abertos na mesma conta. `warmup_task_unica` impede a mesma ação sortear duas vezes para a mesma conta no mesmo dia.

- [x] **Step 6: Criar o client**

Criar `lib/db.ts`:

```ts
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "./schema.ts"

const globalForDb = globalThis as unknown as { pool?: Pool }

const pool =
  globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL })

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool

export const db = drizzle(pool, { schema })
export { schema }
```

O singleton em `globalThis` evita esgotar conexões durante o hot reload do `next dev`.

- [x] **Step 7: Configurar o drizzle-kit**

Criar `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit"

process.loadEnvFile(".env.local")

export default defineConfig({
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

`process.loadEnvFile` é nativo do Node 24 — o drizzle-kit não lê `.env.local` sozinho e não vamos instalar `dotenv` para isso.

- [x] **Step 8: Adicionar scripts ao package.json**

Dentro de `"scripts"`, acrescentar:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:seed": "node --env-file=.env.local lib/seed.ts",
"test": "node --test lib/warmup.test.ts"
```

- [x] **Step 9: Gerar e aplicar a migration**

Run: `npm run db:generate`
Expected: um arquivo `.sql` novo em `drizzle/`.

Run: `npm run db:migrate`
Expected: aplica sem erro.

- [x] **Step 10: Verificar as tabelas e uma constraint**

Run:

```bash
docker compose exec -T db psql -U postgres -d contingencia -c "\dt"
```

Expected: as seis tabelas listadas — `account`, `chip`, `device`, `incident`, `warmup_action`, `warmup_task` — mais a tabela de controle do drizzle.

Agora provar que a constraint de slot funciona de verdade:

```bash
docker compose exec -T db psql -U postgres -d contingencia -c "
insert into device (id) values ('TESTE');
insert into chip (id, operadora, numero) values ('C1','vivo','1'),('C2','vivo','2');
insert into account (device_id, slot, chip_id, ativada_em) values ('TESTE','wa1','C1',current_date);
insert into account (device_id, slot, chip_id, ativada_em) values ('TESTE','wa1','C2',current_date);
"
```

Expected: FALHA na última linha com `duplicate key value violates unique constraint "account_slot_ativo"`.

Limpar o teste:

```bash
docker compose exec -T db psql -U postgres -d contingencia -c "
delete from account where device_id='TESTE';
delete from chip where id in ('C1','C2');
delete from device where id='TESTE';
"
```

- [x] **Step 11: Commit**

```bash
git add docker-compose.yml drizzle.config.ts drizzle lib/schema.ts lib/db.ts package.json package-lock.json
git commit -m "feat: schema do banco e infraestrutura postgres"
```

---

## Task 2: Motor de aquecimento — CONCLUÍDA (commit 5b3d8cd, review limpa)

Lógica pura, sem banco. É o único código do projeto que pode quebrar em silêncio, então é o único com testes.

**Files:**
- Create: `lib/warmup.ts`
- Create: `lib/warmup.test.ts`
- Modify: `tsconfig.json` (permitir importar com extensão `.ts`)

**Interfaces:**
- Consumes: nada. Não importa `db` nem `schema` — recebe dados simples e devolve dados simples.
- Produces:
  - `FAIXAS: Faixa[]`
  - `idadeEmDias(ativadaEm: string, hoje: Date): number`
  - `faixaDe(idadeDias: number): Faixa`
  - `faixaEfetiva(idadeDias: number, diasDesdeFimDeRestricao: number | null): Faixa`
  - `acoesElegiveis(catalogo: AcaoCatalogo[], idadeDias: number): AcaoCatalogo[]`
  - `sortearAcoes(catalogo: AcaoCatalogo[], idadeDias: number, quantidade: number, rng: () => number): AcaoCatalogo[]`
  - `escolherPar(conta: ContaParaSorteio, candidatas: ContaParaSorteio[], paresRecentes: Par[], rng: () => number): number | null`
  - `gerarTarefasDoDia(contas: ContaParaSorteio[], catalogo: AcaoCatalogo[], paresRecentes: Par[], hoje: Date, rng: () => number): TarefaSorteada[]`
  - Tipos `Faixa`, `AcaoCatalogo`, `ContaParaSorteio`, `Par`, `TarefaSorteada`

- [x] **Step 1: Permitir importar com extensão .ts**

Em `tsconfig.json`, dentro de `compilerOptions`, acrescentar:

```json
"allowImportingTsExtensions": true
```

Isso é obrigatório porque o Node exige a extensão explícita em imports ESM relativos, e sem essa flag o TypeScript reclama. É permitido porque `noEmit` já é `true`.

- [x] **Step 2: Escrever os testes que falham**

Criar `lib/warmup.test.ts`:

```ts
import assert from "node:assert/strict"
import { test } from "node:test"

import {
  acoesElegiveis,
  escolherPar,
  faixaDe,
  faixaEfetiva,
  gerarTarefasDoDia,
  idadeEmDias,
  sortearAcoes,
  type AcaoCatalogo,
  type ContaParaSorteio,
} from "./warmup.ts"

const catalogo: AcaoCatalogo[] = [
  { id: 1, nome: "foto de perfil", categoria: "perfil", idadeMinDias: 0, idadeMaxDias: 3, peso: 1 },
  { id: 2, nome: "ficar online", categoria: "perfil", idadeMinDias: 0, idadeMaxDias: null, peso: 1 },
  { id: 3, nome: "conversa curta", categoria: "conversa", idadeMinDias: 4, idadeMaxDias: null, peso: 1 },
  { id: 4, nome: "mandar audio", categoria: "midia", idadeMinDias: 8, idadeMaxDias: null, peso: 1 },
]

// rng determinístico: devolve os valores da lista, em ordem, e repete o último.
function rngFixo(valores: number[]): () => number {
  let i = 0
  return () => valores[Math.min(i++, valores.length - 1)]
}

test("idadeEmDias conta os dias entre a ativação e hoje", () => {
  assert.equal(idadeEmDias("2026-08-01", new Date("2026-08-11T12:00:00Z")), 10)
  assert.equal(idadeEmDias("2026-08-11", new Date("2026-08-11T23:00:00Z")), 0)
})

test("faixaDe escolhe a faixa pela idade, inclusive nos limites", () => {
  assert.equal(faixaDe(0).acoesPorDia, 2)
  assert.equal(faixaDe(3).acoesPorDia, 2)
  assert.equal(faixaDe(4).acoesPorDia, 5)
  assert.equal(faixaDe(14).acoesPorDia, 8)
  assert.equal(faixaDe(30).acoesPorDia, 12)
  assert.equal(faixaDe(365).acoesPorDia, 5)
})

test("faixaEfetiva recua uma faixa nos 7 dias seguintes ao fim de uma restrição", () => {
  assert.equal(faixaEfetiva(20, null).acoesPorDia, 12)
  assert.equal(faixaEfetiva(20, 3).acoesPorDia, 8)
  assert.equal(faixaEfetiva(20, 7).acoesPorDia, 12)
})

test("faixaEfetiva não recua abaixo da primeira faixa", () => {
  assert.equal(faixaEfetiva(1, 0).acoesPorDia, 2)
})

test("acoesElegiveis respeita idade mínima e máxima", () => {
  assert.deepEqual(
    acoesElegiveis(catalogo, 1).map((a) => a.id),
    [1, 2],
  )
  assert.deepEqual(
    acoesElegiveis(catalogo, 5).map((a) => a.id),
    [2, 3],
  )
  assert.deepEqual(
    acoesElegiveis(catalogo, 10).map((a) => a.id),
    [2, 3, 4],
  )
})

test("sortearAcoes nunca repete a mesma ação no mesmo dia", () => {
  const sorteadas = sortearAcoes(catalogo, 10, 3, rngFixo([0, 0, 0]))
  const ids = sorteadas.map((a) => a.id)
  assert.equal(ids.length, 3)
  assert.equal(new Set(ids).size, 3)
})

test("sortearAcoes devolve no máximo o que existe de elegível", () => {
  const sorteadas = sortearAcoes(catalogo, 1, 10, rngFixo([0]))
  assert.equal(sorteadas.length, 2)
})

const contaA: ContaParaSorteio = { id: 1, deviceId: "AP1", ativadaEm: "2026-08-01" }
const contaB: ContaParaSorteio = { id: 2, deviceId: "AP1", ativadaEm: "2026-08-01" }
const contaC: ContaParaSorteio = { id: 3, deviceId: "AP2", ativadaEm: "2026-08-01" }
const contaD: ContaParaSorteio = { id: 4, deviceId: "AP3", ativadaEm: "2026-08-01" }

test("escolherPar nunca escolhe conta do mesmo aparelho", () => {
  const par = escolherPar(contaA, [contaB, contaC], [], rngFixo([0]))
  assert.equal(par, contaC.id)
})

test("escolherPar evita par repetido nos últimos 7 dias", () => {
  const par = escolherPar(contaA, [contaC, contaD], [{ a: 1, b: 3 }], rngFixo([0]))
  assert.equal(par, contaD.id)
})

test("escolherPar trata par recente na ordem invertida", () => {
  const par = escolherPar(contaA, [contaC, contaD], [{ a: 3, b: 1 }], rngFixo([0]))
  assert.equal(par, contaD.id)
})

test("escolherPar devolve null quando não há candidata possível", () => {
  assert.equal(escolherPar(contaA, [contaB], [], rngFixo([0])), null)
})

test("gerarTarefasDoDia só dá par a ações de conversa", () => {
  const hoje = new Date("2026-08-11T09:00:00Z")
  const tarefas = gerarTarefasDoDia([contaA, contaC], catalogo, [], hoje, rngFixo([0]))
  for (const t of tarefas) {
    const acao = catalogo.find((a) => a.id === t.actionId)!
    if (acao.categoria === "conversa") assert.notEqual(t.parAccountId, null)
    else assert.equal(t.parAccountId, null)
  }
})

test("gerarTarefasDoDia respeita a quantidade da faixa de cada conta", () => {
  const hoje = new Date("2026-08-11T09:00:00Z")
  const novinha: ContaParaSorteio = { id: 9, deviceId: "AP9", ativadaEm: "2026-08-10" }
  const tarefas = gerarTarefasDoDia([novinha], catalogo, [], hoje, rngFixo([0]))
  assert.equal(tarefas.length, 2)
})
```

- [x] **Step 3: Rodar os testes e ver falhar**

Run: `npm test`
Expected: FALHA — `Cannot find module './warmup.ts'`.

- [x] **Step 4: Implementar o motor**

Criar `lib/warmup.ts`:

```ts
export type Categoria = "conversa" | "perfil" | "grupo" | "midia"

export type Faixa = {
  minDias: number
  maxDias: number | null
  acoesPorDia: number
}

export type AcaoCatalogo = {
  id: number
  nome: string
  categoria: Categoria
  idadeMinDias: number
  idadeMaxDias: number | null
  peso: number
}

export type ContaParaSorteio = {
  id: number
  deviceId: string
  ativadaEm: string
  diasDesdeFimDeRestricao?: number | null
}

export type Par = { a: number; b: number }

export type TarefaSorteada = {
  accountId: number
  actionId: number
  parAccountId: number | null
}

/**
 * Plano de maturação. Editar aqui é como se ajusta a operação — não há tela
 * de administração para isso, de propósito.
 */
export const FAIXAS: Faixa[] = [
  { minDias: 0, maxDias: 3, acoesPorDia: 2 },
  { minDias: 4, maxDias: 7, acoesPorDia: 5 },
  { minDias: 8, maxDias: 14, acoesPorDia: 8 },
  { minDias: 15, maxDias: 30, acoesPorDia: 12 },
  { minDias: 31, maxDias: null, acoesPorDia: 5 },
]

const DIAS_DE_RECUO_APOS_RESTRICAO = 7
const MS_POR_DIA = 86_400_000

export function idadeEmDias(ativadaEm: string, hoje: Date): number {
  const inicio = Date.parse(`${ativadaEm}T00:00:00Z`)
  const fim = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())
  return Math.max(0, Math.floor((fim - inicio) / MS_POR_DIA))
}

function indiceDaFaixa(idadeDias: number): number {
  for (let i = FAIXAS.length - 1; i >= 0; i--) {
    if (idadeDias >= FAIXAS[i].minDias) return i
  }
  return 0
}

export function faixaDe(idadeDias: number): Faixa {
  return FAIXAS[indiceDaFaixa(idadeDias)]
}

export function faixaEfetiva(
  idadeDias: number,
  diasDesdeFimDeRestricao: number | null,
): Faixa {
  const i = indiceDaFaixa(idadeDias)
  const recua =
    diasDesdeFimDeRestricao !== null &&
    diasDesdeFimDeRestricao < DIAS_DE_RECUO_APOS_RESTRICAO
  return FAIXAS[recua ? Math.max(0, i - 1) : i]
}

export function acoesElegiveis(
  catalogo: AcaoCatalogo[],
  idadeDias: number,
): AcaoCatalogo[] {
  return catalogo.filter(
    (a) =>
      idadeDias >= a.idadeMinDias &&
      (a.idadeMaxDias === null || idadeDias <= a.idadeMaxDias),
  )
}

function sortearComPeso<T extends { peso: number }>(itens: T[], rng: () => number): T {
  const total = itens.reduce((soma, i) => soma + i.peso, 0)
  let alvo = rng() * total
  for (const item of itens) {
    alvo -= item.peso
    if (alvo < 0) return item
  }
  return itens[itens.length - 1]
}

export function sortearAcoes(
  catalogo: AcaoCatalogo[],
  idadeDias: number,
  quantidade: number,
  rng: () => number,
): AcaoCatalogo[] {
  const disponiveis = [...acoesElegiveis(catalogo, idadeDias)]
  const escolhidas: AcaoCatalogo[] = []
  while (escolhidas.length < quantidade && disponiveis.length > 0) {
    const escolhida = sortearComPeso(disponiveis, rng)
    escolhidas.push(escolhida)
    disponiveis.splice(disponiveis.indexOf(escolhida), 1)
  }
  return escolhidas
}

export function escolherPar(
  conta: ContaParaSorteio,
  candidatas: ContaParaSorteio[],
  paresRecentes: Par[],
  rng: () => number,
): number | null {
  const jaConversou = (outra: number) =>
    paresRecentes.some(
      (p) =>
        (p.a === conta.id && p.b === outra) || (p.b === conta.id && p.a === outra),
    )

  const possiveis = candidatas.filter(
    (c) => c.id !== conta.id && c.deviceId !== conta.deviceId && !jaConversou(c.id),
  )
  if (possiveis.length === 0) return null
  return possiveis[Math.min(Math.floor(rng() * possiveis.length), possiveis.length - 1)].id
}

export function gerarTarefasDoDia(
  contas: ContaParaSorteio[],
  catalogo: AcaoCatalogo[],
  paresRecentes: Par[],
  hoje: Date,
  rng: () => number,
): TarefaSorteada[] {
  const tarefas: TarefaSorteada[] = []
  for (const conta of contas) {
    const idade = idadeEmDias(conta.ativadaEm, hoje)
    const faixa = faixaEfetiva(idade, conta.diasDesdeFimDeRestricao ?? null)
    for (const acao of sortearAcoes(catalogo, idade, faixa.acoesPorDia, rng)) {
      tarefas.push({
        accountId: conta.id,
        actionId: acao.id,
        parAccountId:
          acao.categoria === "conversa"
            ? escolherPar(conta, contas, paresRecentes, rng)
            : null,
      })
    }
  }
  return tarefas
}
```

- [x] **Step 5: Rodar os testes e ver passar**

Run: `npm test`
Expected: todos os testes passam, sem falha nem erro.

- [x] **Step 6: Commit**

```bash
git add lib/warmup.ts lib/warmup.test.ts tsconfig.json package.json
git commit -m "feat: motor de sorteio de aquecimento por faixa de idade"
```

---

## Task 3: Catálogo de ações e leituras — CONCLUÍDA (commit 684e29a, review limpa)

**Files:**
- Create: `lib/seed.ts`
- Create: `lib/queries.ts`

**Interfaces:**
- Consumes: `db` e `schema` de `lib/db.ts`; tipos de `lib/warmup.ts`.
- Produces:
  - `listarCatalogo(): Promise<AcaoCatalogo[]>`
  - `contasSaudaveis(): Promise<ContaNaLista[]>`
  - `contasComIncidenteAberto(): Promise<ContaComIncidente[]>`
  - `contadores(): Promise<{ aparelhosAtivos: number; contasSaudaveis: number; chipsNaPasta: number }>`
  - `fichaDoAparelho(id: string): Promise<FichaAparelho | null>`
  - `fichaDoChip(id: string): Promise<FichaChip | null>`
  - Tipos `ContaNaLista`, `ContaComIncidente`, `FichaAparelho`, `FichaChip`

- [x] **Step 1: Escrever a seed do catálogo**

Criar `lib/seed.ts`:

```ts
import { db } from "./db.ts"
import { warmupAction } from "./schema.ts"

const CATALOGO = [
  // perfil e presença — liberado desde o dia zero
  { nome: "Definir foto de perfil", categoria: "perfil", idadeMinDias: 0, idadeMaxDias: 3, peso: 2 },
  { nome: "Definir nome e recado", categoria: "perfil", idadeMinDias: 0, idadeMaxDias: 3, peso: 2 },
  { nome: "Ficar 10 minutos online", categoria: "perfil", idadeMinDias: 0, idadeMaxDias: null, peso: 2 },
  { nome: "Ver o status dos outros números", categoria: "perfil", idadeMinDias: 0, idadeMaxDias: null, peso: 1 },
  { nome: "Postar um status", categoria: "perfil", idadeMinDias: 4, idadeMaxDias: null, peso: 1 },
  // conversa entre os próprios números — a partir do dia 4
  { nome: "Trocar 5 mensagens de texto com outro número", categoria: "conversa", idadeMinDias: 4, idadeMaxDias: null, peso: 3 },
  { nome: "Conversa de 15 mensagens, ida e volta", categoria: "conversa", idadeMinDias: 8, idadeMaxDias: null, peso: 2 },
  { nome: "Responder uma mensagem antiga", categoria: "conversa", idadeMinDias: 15, idadeMaxDias: null, peso: 1 },
  // mídia — a partir do dia 8
  { nome: "Mandar um áudio curto", categoria: "midia", idadeMinDias: 8, idadeMaxDias: null, peso: 2 },
  { nome: "Mandar uma foto", categoria: "midia", idadeMinDias: 8, idadeMaxDias: null, peso: 2 },
  { nome: "Mandar um sticker", categoria: "midia", idadeMinDias: 8, idadeMaxDias: null, peso: 1 },
  { nome: "Mandar um documento PDF", categoria: "midia", idadeMinDias: 15, idadeMaxDias: null, peso: 1 },
  { nome: "Chamada de voz de 1 minuto", categoria: "midia", idadeMinDias: 15, idadeMaxDias: null, peso: 1 },
  // grupos — a partir do dia 8
  { nome: "Entrar em um grupo", categoria: "grupo", idadeMinDias: 8, idadeMaxDias: 14, peso: 1 },
  { nome: "Mandar mensagem em um grupo", categoria: "grupo", idadeMinDias: 15, idadeMaxDias: null, peso: 2 },
  { nome: "Participar de conversa em grupo por 10 minutos", categoria: "grupo", idadeMinDias: 15, idadeMaxDias: null, peso: 1 },
] as const

await db
  .insert(warmupAction)
  .values(CATALOGO.map((a) => ({ ...a })))
  .onConflictDoNothing({ target: warmupAction.nome })

console.log(`catálogo: ${CATALOGO.length} ações garantidas`)
process.exit(0)
```

`onConflictDoNothing` no nome torna a seed idempotente — rodar duas vezes não duplica.

- [x] **Step 2: Rodar a seed**

Run: `npm run db:seed`
Expected: `catálogo: 16 ações garantidas`.

Run: `docker compose exec -T db psql -U postgres -d contingencia -c "select count(*) from warmup_action"`
Expected: `16`.

Rodar de novo para provar a idempotência:

Run: `npm run db:seed && docker compose exec -T db psql -U postgres -d contingencia -c "select count(*) from warmup_action"`
Expected: ainda `16`.

- [x] **Step 3: Escrever as leituras**

Criar `lib/queries.ts`:

```ts
import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm"

import { db } from "./db.ts"
import { account, chip, device, incident, warmupAction } from "./schema.ts"
import type { AcaoCatalogo } from "./warmup.ts"

export type ContaNaLista = {
  id: number
  deviceId: string
  slot: string
  chipId: string
  numero: string
  operadora: string
  ativadaEm: string
}

export type ContaComIncidente = ContaNaLista & {
  incidentId: number
  tipo: "restricao" | "ban"
  inicio: Date
  resultado: "pendente" | "recuperada" | "perdida" | null
}

const CAMPOS_DA_CONTA = {
  id: account.id,
  deviceId: account.deviceId,
  slot: account.slot,
  chipId: account.chipId,
  numero: chip.numero,
  operadora: chip.operadora,
  ativadaEm: account.ativadaEm,
}

export async function listarCatalogo(): Promise<AcaoCatalogo[]> {
  return db.select().from(warmupAction).orderBy(asc(warmupAction.id))
}

/** Contas ativas sem nenhum incidente aberto. */
export async function contasSaudaveis(): Promise<ContaNaLista[]> {
  const abertos = db
    .select({ accountId: incident.accountId })
    .from(incident)
    .where(isNull(incident.fim))

  return db
    .select(CAMPOS_DA_CONTA)
    .from(account)
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(and(eq(account.status, "ativa"), sql`${account.id} not in ${abertos}`))
    .orderBy(asc(account.deviceId), asc(account.slot))
}

export async function contasComIncidenteAberto(): Promise<ContaComIncidente[]> {
  return db
    .select({
      ...CAMPOS_DA_CONTA,
      incidentId: incident.id,
      tipo: incident.tipo,
      inicio: incident.inicio,
      resultado: incident.resultado,
    })
    .from(incident)
    .innerJoin(account, eq(account.id, incident.accountId))
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(isNull(incident.fim))
    .orderBy(desc(incident.inicio))
}

export async function contadores() {
  const [aparelhos] = await db
    .select({ n: count() })
    .from(device)
    .where(eq(device.status, "ativo"))
  const [chipsNaPasta] = await db
    .select({ n: count() })
    .from(chip)
    .where(and(eq(chip.local, "pasta"), eq(chip.status, "novo")))
  const saudaveis = await contasSaudaveis()

  return {
    aparelhosAtivos: aparelhos.n,
    contasSaudaveis: saudaveis.length,
    chipsNaPasta: chipsNaPasta.n,
  }
}

export type FichaAparelho = {
  device: typeof device.$inferSelect
  chipNaBandeja: typeof chip.$inferSelect | null
  contas: (ContaNaLista & {
    status: "ativa" | "aposentada"
    incidenteAberto: ContaComIncidente | null
  })[]
  historico: (typeof incident.$inferSelect & { slot: string; chipId: string })[]
  totalBans: number
}

export async function fichaDoAparelho(id: string): Promise<FichaAparelho | null> {
  const [aparelho] = await db.select().from(device).where(eq(device.id, id))
  if (!aparelho) return null

  const [naBandeja] = await db
    .select()
    .from(chip)
    .where(and(eq(chip.bandejaDeviceId, id), eq(chip.local, "bandeja")))

  const contas = await db
    .select({ ...CAMPOS_DA_CONTA, status: account.status })
    .from(account)
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(and(eq(account.deviceId, id), eq(account.status, "ativa")))
    .orderBy(asc(account.slot))

  const abertos = await contasComIncidenteAberto()

  const historico = await db
    .select({
      id: incident.id,
      accountId: incident.accountId,
      tipo: incident.tipo,
      inicio: incident.inicio,
      fim: incident.fim,
      resultado: incident.resultado,
      notas: incident.notas,
      slot: account.slot,
      chipId: account.chipId,
    })
    .from(incident)
    .innerJoin(account, eq(account.id, incident.accountId))
    .where(eq(account.deviceId, id))
    .orderBy(desc(incident.inicio))

  return {
    device: aparelho,
    chipNaBandeja: naBandeja ?? null,
    contas: contas.map((c) => ({
      ...c,
      incidenteAberto: abertos.find((a) => a.id === c.id) ?? null,
    })),
    historico,
    totalBans: historico.filter((h) => h.tipo === "ban").length,
  }
}

export type FichaChip = {
  chip: typeof chip.$inferSelect
  aparelhoDaBandeja: typeof device.$inferSelect | null
  conta: (typeof account.$inferSelect) | null
}

export async function fichaDoChip(id: string): Promise<FichaChip | null> {
  const [oChip] = await db.select().from(chip).where(eq(chip.id, id))
  if (!oChip) return null

  const [aparelho] = oChip.bandejaDeviceId
    ? await db.select().from(device).where(eq(device.id, oChip.bandejaDeviceId))
    : []

  const [aConta] = await db.select().from(account).where(eq(account.chipId, id))

  return { chip: oChip, aparelhoDaBandeja: aparelho ?? null, conta: aConta ?? null }
}
```

- [x] **Step 4: Verificar que as leituras rodam**

Run: `npx tsc --noEmit`
Expected: sem erro de tipo.

- [x] **Step 5: Commit**

```bash
git add lib/seed.ts lib/queries.ts
git commit -m "feat: seed do catalogo de aquecimento e leituras do banco"
```

---

## Task 4: Cadastro — CONCLUÍDA (commits 1586672 + fix cdeb097, review limpa)

Primeira tela. Vem antes do painel porque sem ela não há dado para o painel mostrar.

**Files:**
- Create: `lib/actions.ts`
- Create: `app/cadastro/page.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `db`, `schema` de `lib/db.ts`.
- Produces em `lib/actions.ts`: `criarAparelho(formData: FormData)`, `criarChip(formData: FormData)`, `ativarConta(formData: FormData)`. Todas são Server Actions que recebem `FormData` e não retornam valor.

- [x] **Step 1: Instalar os componentes shadcn**

```bash
npx shadcn@latest add table dialog input select badge tabs label
```

- [x] **Step 2: Escrever as ações de escrita**

Criar `lib/actions.ts`:

```ts
"use server"

import { eq } from "drizzle-orm"
import { refresh } from "next/cache"

import { db } from "./db.ts"
import { account, chip, device } from "./schema.ts"

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo)
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new Error(`Campo obrigatório: ${campo}`)
  }
  return valor.trim()
}

function textoOpcional(formData: FormData, campo: string): string | null {
  const valor = formData.get(campo)
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null
}

export async function criarAparelho(formData: FormData) {
  await db.insert(device).values({
    id: texto(formData, "id"),
    apelido: textoOpcional(formData, "apelido"),
    notas: textoOpcional(formData, "notas"),
  })
  refresh()
}

export async function criarChip(formData: FormData) {
  await db.insert(chip).values({
    id: texto(formData, "id"),
    operadora: texto(formData, "operadora"),
    numero: texto(formData, "numero"),
    posicao: textoOpcional(formData, "posicao"),
  })
  refresh()
}

export async function ativarConta(formData: FormData) {
  const chipId = texto(formData, "chipId")
  await db.transaction(async (tx) => {
    await tx.insert(account).values({
      deviceId: texto(formData, "deviceId"),
      slot: texto(formData, "slot") as "wa1" | "wa2" | "business",
      chipId,
      ativadaEm: texto(formData, "ativadaEm"),
    })
    await tx.update(chip).set({ status: "em_uso" }).where(eq(chip.id, chipId))
  })
  refresh()
}
```

Não há validação além de campo vazio: slot duplicado, chip já em uso e aparelho inexistente são recusados pelas constraints da Task 1, e o erro sobe como mensagem.

- [x] **Step 3: Escrever a página de cadastro**

Criar `app/cadastro/page.tsx`:

```tsx
import { asc, eq } from "drizzle-orm"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ativarConta, criarAparelho, criarChip } from "@/lib/actions"
import { db } from "@/lib/db"
import { chip, device } from "@/lib/schema"

export default async function Page() {
  const aparelhos = await db
    .select()
    .from(device)
    .where(eq(device.status, "ativo"))
    .orderBy(asc(device.id))
  const chipsLivres = await db
    .select()
    .from(chip)
    .where(eq(chip.status, "novo"))
    .orderBy(asc(chip.id))

  return (
    <div className="grid gap-8 p-6 md:grid-cols-3">
      <form action={criarAparelho} className="flex flex-col gap-3">
        <h2 className="font-medium">Novo aparelho</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="ap-id">ID colado no aparelho</Label>
          <Input id="ap-id" name="id" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ap-apelido">Apelido</Label>
          <Input id="ap-apelido" name="apelido" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ap-notas">Notas</Label>
          <Input id="ap-notas" name="notas" />
        </div>
        <Button type="submit">Cadastrar aparelho</Button>
      </form>

      <form action={criarChip} className="flex flex-col gap-3">
        <h2 className="font-medium">Novo chip</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="ch-id">ID colado no chip</Label>
          <Input id="ch-id" name="id" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ch-operadora">Operadora</Label>
          <Input id="ch-operadora" name="operadora" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ch-numero">Número</Label>
          <Input id="ch-numero" name="numero" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ch-posicao">Posição na pasta</Label>
          <Input id="ch-posicao" name="posicao" placeholder="pasta 2, folha 3" />
        </div>
        <Button type="submit">Cadastrar chip</Button>
      </form>

      <form action={ativarConta} className="flex flex-col gap-3">
        <h2 className="font-medium">Ativar conta</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="co-device">Aparelho</Label>
          <select
            id="co-device"
            name="deviceId"
            required
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            {aparelhos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} {a.apelido ? `— ${a.apelido}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="co-slot">Slot</Label>
          <select
            id="co-slot"
            name="slot"
            required
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            <option value="wa1">WhatsApp 1</option>
            <option value="wa2">WhatsApp 2</option>
            <option value="business">WhatsApp Business</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="co-chip">Chip</Label>
          <select
            id="co-chip"
            name="chipId"
            required
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            {chipsLivres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.numero} ({c.operadora})
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="co-data">Ativada em</Label>
          <Input id="co-data" name="ativadaEm" type="date" required />
        </div>
        <Button type="submit">Ativar conta</Button>
      </form>
    </div>
  )
}
```

O `<select>` é nativo de propósito: é o controle certo para o caso e não precisa de componente de cliente.

- [x] **Step 4: Acrescentar navegação ao layout**

Em `app/layout.tsx`, substituir o conteúdo de `<body>` por:

```tsx
      <body>
        <ThemeProvider>
          <header className="flex items-center gap-6 border-b px-6 py-3 text-sm">
            <a href="/" className="font-medium">
              Contingência
            </a>
            <nav className="flex gap-4">
              <a href="/aquecimento">Aquecimento</a>
              <a href="/cadastro">Cadastro</a>
            </nav>
          </header>
          <main>{children}</main>
        </ThemeProvider>
      </body>
```

Trocar também `lang="en"` por `lang="pt-BR"`.

- [x] **Step 5: Testar na mão**

Run: `npm run dev`

Abrir `http://localhost:3000/cadastro` e cadastrar, nesta ordem: um aparelho `AP001`, três chips `C001`, `C002` e `C003`, e três contas em `AP001` nos slots `wa1`, `wa2` e `business`, com data de ativação de hoje.

Expected: os três formulários salvam e a página recarrega com os selects atualizados.

Agora provar que a constraint aparece como erro na interface: tentar ativar uma quarta conta em `AP001` no slot `wa1`.
Expected: erro de constraint, a conta não é criada.

- [x] **Step 6: Commit**

```bash
git add lib/actions.ts app/cadastro/page.tsx app/layout.tsx components/ui
git commit -m "feat: cadastro de aparelho, chip e conta"
```

---

## Task 5: Painel e busca

**Files:**
- Modify: `app/page.tsx`
- Create: `app/busca/route.ts`
- Create: `components/busca.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `contadores`, `contasSaudaveis`, `contasComIncidenteAberto` de `lib/queries.ts`.
- Produces: `components/busca.tsx` exporta `Busca` (componente sem props). `app/busca/route.ts` exporta `GET`.

- [ ] **Step 1: Escrever o painel**

Substituir `app/page.tsx` por:

```tsx
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { contadores, contasComIncidenteAberto, contasSaudaveis } from "@/lib/queries"

const NOME_DO_SLOT: Record<string, string> = {
  wa1: "WhatsApp 1",
  wa2: "WhatsApp 2",
  business: "Business",
}

function haQuantoTempo(desde: Date): string {
  const horas = Math.floor((Date.now() - desde.getTime()) / 3_600_000)
  if (horas < 24) return `${horas}h`
  return `${Math.floor(horas / 24)}d ${horas % 24}h`
}

export default async function Page() {
  const [numeros, saudaveis, comIncidente] = await Promise.all([
    contadores(),
    contasSaudaveis(),
    contasComIncidenteAberto(),
  ])

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex gap-8 text-sm">
        <div>
          <div className="text-2xl font-medium">{numeros.aparelhosAtivos}</div>
          <div className="text-muted-foreground">aparelhos ativos</div>
        </div>
        <div>
          <div className="text-2xl font-medium">{numeros.contasSaudaveis}</div>
          <div className="text-muted-foreground">contas saudáveis</div>
        </div>
        <div>
          <div className="text-2xl font-medium">{numeros.chipsNaPasta}</div>
          <div className="text-muted-foreground">chips livres na pasta</div>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Fora do ar ({comIncidente.length})</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aparelho</TableHead>
              <TableHead>Slot</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Há quanto tempo</TableHead>
              <TableHead>Análise</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comIncidente.map((c) => (
              <TableRow key={c.incidentId}>
                <TableCell>
                  <Link href={`/aparelho/${c.deviceId}`} className="underline">
                    {c.deviceId}
                  </Link>
                </TableCell>
                <TableCell>{NOME_DO_SLOT[c.slot]}</TableCell>
                <TableCell>{c.numero}</TableCell>
                <TableCell>
                  <Badge variant={c.tipo === "ban" ? "destructive" : "secondary"}>
                    {c.tipo === "ban" ? "Ban" : "Restrição"}
                  </Badge>
                </TableCell>
                <TableCell>{haQuantoTempo(c.inicio)}</TableCell>
                <TableCell>{c.resultado ?? "—"}</TableCell>
              </TableRow>
            ))}
            {comIncidente.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Nada restrito no momento.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Saudáveis ({saudaveis.length})</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aparelho</TableHead>
              <TableHead>Slot</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Operadora</TableHead>
              <TableHead>Chip</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {saudaveis.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/aparelho/${c.deviceId}`} className="underline">
                    {c.deviceId}
                  </Link>
                </TableCell>
                <TableCell>{NOME_DO_SLOT[c.slot]}</TableCell>
                <TableCell>{c.numero}</TableCell>
                <TableCell>{c.operadora}</TableCell>
                <TableCell>
                  <Link href={`/chip/${c.chipId}`} className="underline">
                    {c.chipId}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Escrever a rota de busca**

Criar `app/busca/route.ts`:

```ts
import { eq } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"

import { db } from "@/lib/db"
import { chip, device } from "@/lib/schema"

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim()
  if (!id) return NextResponse.redirect(new URL("/", request.url))

  const [aparelho] = await db.select({ id: device.id }).from(device).where(eq(device.id, id))
  if (aparelho) return NextResponse.redirect(new URL(`/aparelho/${id}`, request.url))

  const [oChip] = await db.select({ id: chip.id }).from(chip).where(eq(chip.id, id))
  if (oChip) return NextResponse.redirect(new URL(`/chip/${id}`, request.url))

  return NextResponse.redirect(new URL(`/?nao-encontrado=${encodeURIComponent(id)}`, request.url))
}
```

- [ ] **Step 3: Escrever o campo de busca**

Criar `components/busca.tsx`:

```tsx
import { Input } from "@/components/ui/input"

export function Busca() {
  return (
    <form action="/busca" className="ml-auto">
      <Input
        name="id"
        placeholder="ID do aparelho ou chip"
        className="h-8 w-56"
        aria-label="Buscar por ID"
      />
    </form>
  )
}
```

Formulário com `method` GET padrão apontando para a rota — sem estado de cliente, sem `use client`.

- [ ] **Step 4: Colocar a busca no cabeçalho**

Em `app/layout.tsx`, importar `import { Busca } from "@/components/busca"` e acrescentar `<Busca />` como último filho do `<header>`.

- [ ] **Step 5: Testar na mão**

Run: `npm run dev`

Abrir `http://localhost:3000`.
Expected: três contadores, tabela "Fora do ar" vazia com a mensagem, e as três contas de `AP001` em "Saudáveis".

Digitar `AP001` na busca do cabeçalho e enviar.
Expected: redireciona para `/aparelho/AP001` (a página ainda não existe — 404 é o esperado nesta etapa).

Digitar `C001`.
Expected: redireciona para `/chip/C001`.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/busca/route.ts components/busca.tsx app/layout.tsx
git commit -m "feat: painel de disponibilidade e busca por ID"
```

---

## Task 6: Ficha do aparelho e incidentes

**Files:**
- Create: `app/aparelho/[id]/page.tsx`
- Create: `components/incident-form.tsx`
- Modify: `lib/actions.ts`

**Interfaces:**
- Consumes: `fichaDoAparelho` de `lib/queries.ts`.
- Produces em `lib/actions.ts`: `registrarIncidente(formData: FormData)`, `encerrarIncidente(formData: FormData)`, `resolverBan(formData: FormData)`, `mudarStatusDoAparelho(formData: FormData)`. `components/incident-form.tsx` exporta `RegistrarIncidente({ accountId }: { accountId: number })` e `EncerrarIncidente({ incidentId, tipo }: { incidentId: number; tipo: "restricao" | "ban" })`.

- [ ] **Step 1: Acrescentar as ações de incidente**

No fim de `lib/actions.ts`, acrescentar (mantendo os imports existentes e trocando a linha de import do drizzle por `import { and, eq, isNull } from "drizzle-orm"`, e a do schema por `import { account, chip, device, incident } from "./schema.ts"`):

```ts
export async function registrarIncidente(formData: FormData) {
  const tipo = texto(formData, "tipo") as "restricao" | "ban"
  await db.insert(incident).values({
    accountId: Number(texto(formData, "accountId")),
    tipo,
    inicio: new Date(texto(formData, "inicio")),
    resultado: tipo === "ban" ? "pendente" : null,
    notas: textoOpcional(formData, "notas"),
  })
  refresh()
}

/** Restrição acabou: carimba o fim. A duração é sempre calculada, nunca digitada. */
export async function encerrarIncidente(formData: FormData) {
  await db
    .update(incident)
    .set({ fim: new Date() })
    .where(and(eq(incident.id, Number(texto(formData, "incidentId"))), isNull(incident.fim)))
  refresh()
}

/**
 * Resultado da análise de um ban. Se o número foi perdido, a conta é aposentada
 * e o chip também, liberando o slot para um chip novo.
 */
export async function resolverBan(formData: FormData) {
  const incidentId = Number(texto(formData, "incidentId"))
  const resultado = texto(formData, "resultado") as "recuperada" | "perdida"

  await db.transaction(async (tx) => {
    const [oIncidente] = await tx
      .update(incident)
      .set({ resultado, fim: new Date() })
      .where(eq(incident.id, incidentId))
      .returning({ accountId: incident.accountId })

    if (resultado === "perdida") {
      const [aConta] = await tx
        .update(account)
        .set({ status: "aposentada" })
        .where(eq(account.id, oIncidente.accountId))
        .returning({ chipId: account.chipId })
      await tx.update(chip).set({ status: "aposentado" }).where(eq(chip.id, aConta.chipId))
    }
  })
  refresh()
}

export async function mudarStatusDoAparelho(formData: FormData) {
  await db
    .update(device)
    .set({ status: texto(formData, "status") as "ativo" | "quarentena" | "aposentado" })
    .where(eq(device.id, texto(formData, "deviceId")))
  refresh()
}
```

- [ ] **Step 2: Escrever os formulários de incidente**

Criar `components/incident-form.tsx`:

```tsx
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { encerrarIncidente, registrarIncidente, resolverBan } from "@/lib/actions"

export function RegistrarIncidente({ accountId }: { accountId: number }) {
  return (
    <form action={registrarIncidente} className="flex items-center gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <select
        name="tipo"
        className="border-input bg-background h-8 rounded-md border px-2 text-sm"
        aria-label="Tipo de incidente"
      >
        <option value="restricao">Restrição</option>
        <option value="ban">Ban</option>
      </select>
      <Input
        type="datetime-local"
        name="inicio"
        required
        className="h-8 w-48"
        aria-label="Início"
      />
      <Button type="submit" size="sm" variant="outline">
        Registrar
      </Button>
    </form>
  )
}

export function EncerrarIncidente({
  incidentId,
  tipo,
}: {
  incidentId: number
  tipo: "restricao" | "ban"
}) {
  if (tipo === "restricao") {
    return (
      <form action={encerrarIncidente}>
        <input type="hidden" name="incidentId" value={incidentId} />
        <Button type="submit" size="sm">
          Voltou
        </Button>
      </form>
    )
  }

  return (
    <div className="flex gap-2">
      <form action={resolverBan}>
        <input type="hidden" name="incidentId" value={incidentId} />
        <input type="hidden" name="resultado" value="recuperada" />
        <Button type="submit" size="sm">
          Análise devolveu
        </Button>
      </form>
      <form action={resolverBan}>
        <input type="hidden" name="incidentId" value={incidentId} />
        <input type="hidden" name="resultado" value="perdida" />
        <Button type="submit" size="sm" variant="destructive">
          Perdido
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Escrever a ficha do aparelho**

Criar `app/aparelho/[id]/page.tsx`:

```tsx
import Link from "next/link"
import { notFound } from "next/navigation"

import { EncerrarIncidente, RegistrarIncidente } from "@/components/incident-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { mudarStatusDoAparelho } from "@/lib/actions"
import { fichaDoAparelho } from "@/lib/queries"
import { idadeEmDias } from "@/lib/warmup"

const NOME_DO_SLOT: Record<string, string> = {
  wa1: "WhatsApp 1",
  wa2: "WhatsApp 2",
  business: "Business",
}

function duracao(inicio: Date, fim: Date | null): string {
  const horas = Math.floor(((fim ?? new Date()).getTime() - inicio.getTime()) / 3_600_000)
  if (horas < 24) return `${horas}h`
  return `${Math.floor(horas / 24)}d ${horas % 24}h`
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ficha = await fichaDoAparelho(id)
  if (!ficha) notFound()

  const hoje = new Date()

  return (
    <div className="flex flex-col gap-8 p-6">
      <header className="flex items-center gap-4">
        <h1 className="text-xl font-medium">{ficha.device.id}</h1>
        {ficha.device.apelido && (
          <span className="text-muted-foreground">{ficha.device.apelido}</span>
        )}
        <Badge variant={ficha.device.status === "ativo" ? "secondary" : "destructive"}>
          {ficha.device.status}
        </Badge>
        <span className="text-muted-foreground text-sm">
          {ficha.totalBans} ban(s) no histórico
        </span>
        <form action={mudarStatusDoAparelho} className="ml-auto flex gap-2">
          <input type="hidden" name="deviceId" value={ficha.device.id} />
          <select
            name="status"
            defaultValue={ficha.device.status}
            className="border-input bg-background h-8 rounded-md border px-2 text-sm"
            aria-label="Status do aparelho"
          >
            <option value="ativo">ativo</option>
            <option value="quarentena">quarentena</option>
            <option value="aposentado">aposentado</option>
          </select>
          <Button type="submit" size="sm" variant="outline">
            Mudar status
          </Button>
        </form>
      </header>

      <section className="text-sm">
        <h2 className="mb-1 font-medium">Chip de rede na bandeja</h2>
        {ficha.chipNaBandeja ? (
          <Link href={`/chip/${ficha.chipNaBandeja.id}`} className="underline">
            {ficha.chipNaBandeja.id} — {ficha.chipNaBandeja.numero} (
            {ficha.chipNaBandeja.operadora})
          </Link>
        ) : (
          <span className="text-muted-foreground">Bandeja vazia.</span>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Contas</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Slot</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Chip</TableHead>
              <TableHead>Idade</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ficha.contas.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{NOME_DO_SLOT[c.slot]}</TableCell>
                <TableCell>{c.numero}</TableCell>
                <TableCell>
                  <Link href={`/chip/${c.chipId}`} className="underline">
                    {c.chipId}
                  </Link>
                </TableCell>
                <TableCell>{idadeEmDias(c.ativadaEm, hoje)} dias</TableCell>
                <TableCell>
                  {c.incidenteAberto ? (
                    <Badge
                      variant={
                        c.incidenteAberto.tipo === "ban" ? "destructive" : "secondary"
                      }
                    >
                      {c.incidenteAberto.tipo === "ban" ? "Ban" : "Restrição"} há{" "}
                      {duracao(c.incidenteAberto.inicio, null)}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Saudável</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {c.incidenteAberto ? (
                    <EncerrarIncidente
                      incidentId={c.incidenteAberto.incidentId}
                      tipo={c.incidenteAberto.tipo}
                    />
                  ) : (
                    <RegistrarIncidente accountId={c.id} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Histórico de incidentes</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Slot</TableHead>
              <TableHead>Chip</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Análise</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ficha.historico.map((h) => (
              <TableRow key={h.id}>
                <TableCell>{NOME_DO_SLOT[h.slot]}</TableCell>
                <TableCell>{h.chipId}</TableCell>
                <TableCell>{h.tipo === "ban" ? "Ban" : "Restrição"}</TableCell>
                <TableCell>{h.inicio.toLocaleString("pt-BR")}</TableCell>
                <TableCell>{h.fim ? duracao(h.inicio, h.fim) : "em curso"}</TableCell>
                <TableCell>{h.resultado ?? "—"}</TableCell>
              </TableRow>
            ))}
            {ficha.historico.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Nenhum incidente registrado neste aparelho.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Testar o ciclo de restrição na mão**

Run: `npm run dev`

Abrir `http://localhost:3000/aparelho/AP001`. Na conta do slot WhatsApp 1, registrar uma restrição com início de ontem.
Expected: a linha passa a mostrar `Restrição há 24h` e o botão vira "Voltou". A conta some da lista de saudáveis no painel e aparece em "Fora do ar".

Clicar em "Voltou".
Expected: a conta volta a "Saudável" e o histórico ganha uma linha com duração preenchida.

- [ ] **Step 5: Testar o ciclo de ban na mão**

Na conta do slot WhatsApp 2, registrar um ban com início de hoje.
Expected: aparecem dois botões, "Análise devolveu" e "Perdido".

Clicar em "Perdido".
Expected: a conta some da lista de contas ativas do aparelho, o histórico registra `perdida`, e o chip correspondente aparece como `aposentado`. Confirmar:

```bash
docker compose exec -T db psql -U postgres -d contingencia -c "select id, status from chip; select id, slot, status from account"
```

Expected: o chip da conta banida com status `aposentado` e a conta com status `aposentada`.

Provar que o slot foi liberado: em `/cadastro`, ativar uma conta nova em `AP001` no slot `wa2` com o chip `C003`.
Expected: salva sem erro de constraint.

- [ ] **Step 6: Commit**

```bash
git add app/aparelho components/incident-form.tsx lib/actions.ts
git commit -m "feat: ficha do aparelho e ciclo de restricao e ban"
```

---

## Task 7: Ficha do chip

**Files:**
- Create: `app/chip/[id]/page.tsx`
- Modify: `lib/actions.ts`

**Interfaces:**
- Consumes: `fichaDoChip` de `lib/queries.ts`.
- Produces em `lib/actions.ts`: `moverChip(formData: FormData)`.

- [ ] **Step 1: Acrescentar a ação de mover chip**

No fim de `lib/actions.ts`:

```ts
/**
 * Move o chip entre pasta, gaveta e bandeja de um aparelho. Os campos que não
 * pertencem ao destino são zerados para o registro não mentir sobre onde o
 * chip está.
 */
export async function moverChip(formData: FormData) {
  const local = texto(formData, "local") as "pasta" | "gaveta" | "bandeja"
  const deviceId = textoOpcional(formData, "bandejaDeviceId")

  if (local === "bandeja" && !deviceId) {
    throw new Error("Escolha o aparelho da bandeja")
  }

  await db
    .update(chip)
    .set({
      local,
      bandejaDeviceId: local === "bandeja" ? deviceId : null,
      posicao: local === "pasta" ? textoOpcional(formData, "posicao") : null,
    })
    .where(eq(chip.id, texto(formData, "chipId")))
  refresh()
}
```

- [ ] **Step 2: Escrever a ficha do chip**

Criar `app/chip/[id]/page.tsx`:

```tsx
import { asc, eq } from "drizzle-orm"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { moverChip } from "@/lib/actions"
import { db } from "@/lib/db"
import { fichaDoChip } from "@/lib/queries"
import { device } from "@/lib/schema"

const NOME_DO_SLOT: Record<string, string> = {
  wa1: "WhatsApp 1",
  wa2: "WhatsApp 2",
  business: "Business",
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ficha = await fichaDoChip(id)
  if (!ficha) notFound()

  const aparelhos = await db
    .select()
    .from(device)
    .where(eq(device.status, "ativo"))
    .orderBy(asc(device.id))

  return (
    <div className="flex max-w-2xl flex-col gap-8 p-6">
      <header className="flex items-center gap-4">
        <h1 className="text-xl font-medium">{ficha.chip.id}</h1>
        <span className="text-muted-foreground">
          {ficha.chip.numero} — {ficha.chip.operadora}
        </span>
        <Badge variant={ficha.chip.status === "aposentado" ? "destructive" : "secondary"}>
          {ficha.chip.status}
        </Badge>
      </header>

      <section className="text-sm">
        <h2 className="mb-1 font-medium">Onde está</h2>
        {ficha.chip.local === "bandeja" && ficha.aparelhoDaBandeja ? (
          <p>
            Na bandeja do aparelho{" "}
            <Link href={`/aparelho/${ficha.aparelhoDaBandeja.id}`} className="underline">
              {ficha.aparelhoDaBandeja.id}
            </Link>{" "}
            (chip de rede, 4G).
          </p>
        ) : ficha.chip.local === "gaveta" ? (
          <p>Na gaveta.</p>
        ) : (
          <p>Na pasta{ficha.chip.posicao ? ` — ${ficha.chip.posicao}` : ""}.</p>
        )}
      </section>

      <section className="text-sm">
        <h2 className="mb-1 font-medium">Conta gerada</h2>
        {ficha.conta ? (
          <p>
            <Link href={`/aparelho/${ficha.conta.deviceId}`} className="underline">
              {ficha.conta.deviceId}
            </Link>{" "}
            — {NOME_DO_SLOT[ficha.conta.slot]} — ativada em {ficha.conta.ativadaEm} —{" "}
            {ficha.conta.status}
          </p>
        ) : (
          <p className="text-muted-foreground">
            Nenhuma conta usa este chip. É um chip de rede ou está reservado.
          </p>
        )}
      </section>

      <form action={moverChip} className="flex flex-col gap-3">
        <h2 className="font-medium">Mover</h2>
        <input type="hidden" name="chipId" value={ficha.chip.id} />
        <div className="grid gap-1.5">
          <Label htmlFor="mv-local">Destino</Label>
          <select
            id="mv-local"
            name="local"
            defaultValue={ficha.chip.local}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            <option value="pasta">Pasta (fazenda de SMS)</option>
            <option value="gaveta">Gaveta</option>
            <option value="bandeja">Bandeja de um aparelho</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mv-posicao">Posição na pasta</Label>
          <Input
            id="mv-posicao"
            name="posicao"
            defaultValue={ficha.chip.posicao ?? ""}
            placeholder="pasta 2, folha 3"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mv-device">Aparelho da bandeja</Label>
          <select
            id="mv-device"
            name="bandejaDeviceId"
            defaultValue={ficha.chip.bandejaDeviceId ?? ""}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            <option value="">—</option>
            {aparelhos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} {a.apelido ? `— ${a.apelido}` : ""}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" className="self-start">
          Mover chip
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Testar na mão**

Run: `npm run dev`

Abrir `http://localhost:3000/chip/C001`.
Expected: mostra a conta gerada e "Na pasta".

Mover para a bandeja de `AP001`.
Expected: a página passa a dizer "Na bandeja do aparelho AP001", e `/aparelho/AP001` mostra o chip na seção da bandeja.

Mover de volta para a pasta com posição "pasta 1, folha 2".
Expected: a página mostra a posição e `/aparelho/AP001` volta a dizer "Bandeja vazia".

- [ ] **Step 4: Commit**

```bash
git add app/chip lib/actions.ts
git commit -m "feat: ficha do chip e movimentacao entre pasta, gaveta e bandeja"
```

---

## Task 8: Tarefas de aquecimento do dia

**Files:**
- Create: `app/aquecimento/page.tsx`
- Modify: `lib/queries.ts`
- Modify: `lib/actions.ts`

**Interfaces:**
- Consumes: `gerarTarefasDoDia`, `listarCatalogo`, `contasSaudaveis`.
- Produces em `lib/queries.ts`: `tarefasDoDia(dia: string): Promise<TarefaDoDia[]>`, `contasParaSorteio(): Promise<ContaParaSorteio[]>`, `paresRecentes(dia: string): Promise<Par[]>`, tipo `TarefaDoDia`. Em `lib/actions.ts`: `gerarAquecimentoDeHoje()`, `marcarTarefa(formData: FormData)`.

- [ ] **Step 1: Acrescentar as leituras de aquecimento**

No fim de `lib/queries.ts`, ajustando antes os imports do topo: acrescentar `gte`, `isNotNull` e `max` ao import de `drizzle-orm`; acrescentar `warmupTask` ao import de `./schema.ts`; acrescentar `ContaParaSorteio` e `Par` ao import de tipos de `./warmup.ts`; e acrescentar a linha `import { alias } from "drizzle-orm/pg-core"`.

```ts
export type TarefaDoDia = {
  id: number
  accountId: number
  deviceId: string
  slot: string
  numero: string
  acao: string
  categoria: string
  status: "pendente" | "feito" | "pulado"
  parNumero: string | null
  parDeviceId: string | null
}

/**
 * Contas elegíveis ao sorteio: ativas e sem incidente aberto. Carrega junto
 * há quantos dias terminou a última restrição, que é o que faz a conta recuar
 * uma faixa no plano de aquecimento.
 */
export async function contasParaSorteio(): Promise<ContaParaSorteio[]> {
  const saudaveis = await contasSaudaveis()
  if (saudaveis.length === 0) return []

  const ultimasVoltas = await db
    .select({
      accountId: incident.accountId,
      ultimoFim: max(incident.fim).as("ultimo_fim"),
    })
    .from(incident)
    .where(and(eq(incident.tipo, "restricao"), isNotNull(incident.fim)))
    .groupBy(incident.accountId)

  const MS_POR_DIA = 86_400_000

  return saudaveis.map((c) => {
    const volta = ultimasVoltas.find((v) => v.accountId === c.id)
    return {
      id: c.id,
      deviceId: c.deviceId,
      ativadaEm: c.ativadaEm,
      diasDesdeFimDeRestricao: volta?.ultimoFim
        ? Math.floor((Date.now() - new Date(volta.ultimoFim).getTime()) / MS_POR_DIA)
        : null,
    }
  })
}

/** Pares que já conversaram nos últimos 7 dias, para não repetir. */
export async function paresRecentes(dia: string): Promise<Par[]> {
  const desde = new Date(Date.parse(`${dia}T00:00:00Z`) - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10)

  const linhas = await db
    .select({ a: warmupTask.accountId, b: warmupTask.parAccountId })
    .from(warmupTask)
    .where(and(isNotNull(warmupTask.parAccountId), gte(warmupTask.data, desde)))

  return linhas.map((l) => ({ a: l.a, b: l.b! }))
}

export async function tarefasDoDia(dia: string): Promise<TarefaDoDia[]> {
  const par = alias(account, "par")
  const chipDoPar = alias(chip, "chip_do_par")

  return db
    .select({
      id: warmupTask.id,
      accountId: warmupTask.accountId,
      deviceId: account.deviceId,
      slot: account.slot,
      numero: chip.numero,
      acao: warmupAction.nome,
      categoria: warmupAction.categoria,
      status: warmupTask.status,
      parNumero: chipDoPar.numero,
      parDeviceId: par.deviceId,
    })
    .from(warmupTask)
    .innerJoin(account, eq(account.id, warmupTask.accountId))
    .innerJoin(chip, eq(chip.id, account.chipId))
    .innerJoin(warmupAction, eq(warmupAction.id, warmupTask.actionId))
    .leftJoin(par, eq(par.id, warmupTask.parAccountId))
    .leftJoin(chipDoPar, eq(chipDoPar.id, par.chipId))
    .where(eq(warmupTask.data, dia))
    .orderBy(asc(account.deviceId), asc(account.slot), asc(warmupTask.id))
}
```

- [ ] **Step 2: Acrescentar as ações de aquecimento**

No fim de `lib/actions.ts` (acrescentando `warmupTask` ao import do schema):

```ts
import { contasParaSorteio, listarCatalogo, paresRecentes } from "./queries.ts"
import { gerarTarefasDoDia } from "./warmup.ts"

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Sorteia as tarefas de hoje. É seguro chamar duas vezes: a constraint
 * warmup_task_unica descarta o que já existe para a mesma conta, ação e dia.
 */
export async function gerarAquecimentoDeHoje() {
  const dia = hojeISO()
  const [contas, catalogo, pares] = await Promise.all([
    contasParaSorteio(),
    listarCatalogo(),
    paresRecentes(dia),
  ])

  const tarefas = gerarTarefasDoDia(contas, catalogo, pares, new Date(), Math.random)
  if (tarefas.length > 0) {
    await db
      .insert(warmupTask)
      .values(tarefas.map((t) => ({ ...t, data: dia })))
      .onConflictDoNothing()
  }
  refresh()
}

export async function marcarTarefa(formData: FormData) {
  const status = texto(formData, "status") as "feito" | "pulado"
  await db
    .update(warmupTask)
    .set({ status, feitoEm: new Date() })
    .where(eq(warmupTask.id, Number(texto(formData, "tarefaId"))))
  refresh()
}
```

- [ ] **Step 3: Escrever a página de aquecimento**

Criar `app/aquecimento/page.tsx`:

```tsx
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { gerarAquecimentoDeHoje, marcarTarefa } from "@/lib/actions"
import { tarefasDoDia, type TarefaDoDia } from "@/lib/queries"

const NOME_DO_SLOT: Record<string, string> = {
  wa1: "WhatsApp 1",
  wa2: "WhatsApp 2",
  business: "Business",
}

export default async function Page() {
  const dia = new Date().toISOString().slice(0, 10)
  const tarefas = await tarefasDoDia(dia)

  const porAparelho = new Map<string, TarefaDoDia[]>()
  for (const t of tarefas) {
    const lista = porAparelho.get(t.deviceId) ?? []
    lista.push(t)
    porAparelho.set(t.deviceId, lista)
  }

  const pendentes = tarefas.filter((t) => t.status === "pendente").length

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-center gap-4">
        <h1 className="text-xl font-medium">Aquecimento de hoje</h1>
        <span className="text-muted-foreground text-sm">
          {pendentes} pendente(s) de {tarefas.length}
        </span>
        <form action={gerarAquecimentoDeHoje} className="ml-auto">
          <Button type="submit">Gerar tarefas de hoje</Button>
        </form>
      </header>

      {tarefas.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Nada sorteado ainda. Clique em &quot;Gerar tarefas de hoje&quot;.
        </p>
      )}

      {[...porAparelho.entries()].map(([deviceId, lista]) => (
        <section key={deviceId} className="flex flex-col gap-2">
          <h2 className="font-medium">Aparelho {deviceId}</h2>
          <ul className="flex flex-col gap-1">
            {lista.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <Badge variant="outline">{NOME_DO_SLOT[t.slot]}</Badge>
                <span className="text-muted-foreground w-32 shrink-0">{t.numero}</span>
                <span className="flex-1">
                  {t.acao}
                  {t.parNumero && (
                    <span className="text-muted-foreground">
                      {" "}
                      — com {t.parNumero} ({t.parDeviceId})
                    </span>
                  )}
                </span>
                {t.status === "pendente" ? (
                  <div className="flex gap-2">
                    <form action={marcarTarefa}>
                      <input type="hidden" name="tarefaId" value={t.id} />
                      <input type="hidden" name="status" value="feito" />
                      <Button type="submit" size="sm">
                        Feito
                      </Button>
                    </form>
                    <form action={marcarTarefa}>
                      <input type="hidden" name="tarefaId" value={t.id} />
                      <input type="hidden" name="status" value="pulado" />
                      <Button type="submit" size="sm" variant="outline">
                        Pular
                      </Button>
                    </form>
                  </div>
                ) : (
                  <Badge variant={t.status === "feito" ? "secondary" : "outline"}>
                    {t.status}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Testar na mão**

Run: `npm run dev`

Antes de testar, garantir massa suficiente: em `/cadastro`, criar um segundo aparelho `AP002` com ao menos uma conta ativa, para que as ações de conversa tenham par possível em aparelho diferente. Usar data de ativação de 20 dias atrás em pelo menos uma conta, para cair na faixa de 12 ações.

Abrir `http://localhost:3000/aquecimento` e clicar em "Gerar tarefas de hoje".
Expected: as tarefas aparecem agrupadas por aparelho. Contas recém-ativadas recebem 2 tarefas, só de perfil. A conta de 20 dias recebe 12 tarefas, incluindo conversa, mídia e grupo. Toda tarefa de conversa mostra um par de aparelho diferente.

Clicar em "Gerar tarefas de hoje" de novo.
Expected: a lista não duplica — a constraint descarta as repetidas.

Marcar uma tarefa como "Feito" e outra como "Pular".
Expected: os botões somem e viram etiqueta; o contador de pendentes diminui.

Confirmar que conta restrita não recebe tarefa: em `/aparelho/AP001`, registrar uma restrição numa conta; depois, no dia seguinte ou apagando as tarefas do dia com o comando abaixo, gerar de novo.

```bash
docker compose exec -T db psql -U postgres -d contingencia -c "delete from warmup_task where data = current_date"
```

Expected: ao gerar de novo, a conta restrita não aparece na lista.

- [ ] **Step 5: Rodar a verificação final**

Run: `npm test`
Expected: todos os testes do motor passam.

Run: `npx tsc --noEmit`
Expected: sem erro.

Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 6: Commit**

```bash
git add app/aquecimento lib/queries.ts lib/actions.ts
git commit -m "feat: geracao e acompanhamento das tarefas diarias de aquecimento"
```

---

## Cobertura do spec

| Requisito do spec | Task |
|---|---|
| Seis tabelas e constraints | 1 |
| Estado de incidente derivado | 1 (constraint), 3 (leitura), 6 (interface) |
| Faixas por idade e sorteio com peso | 2 |
| Par em aparelho diferente, sem repetir em 7 dias | 2 |
| Recuo de faixa após restrição | 2, 8 |
| Catálogo por seed | 3 |
| Painel com contadores e duas listas | 5 |
| Busca por ID no cabeçalho | 5 |
| Ficha do aparelho com slots, bandeja, histórico e bans | 6 |
| Registrar e encerrar restrição, resultado da análise do ban | 6 |
| Ban perdido aposenta conta e chip, libera o slot | 6 |
| Ficha do chip e movimentação entre pasta, gaveta e bandeja | 7 |
| Cadastro de aparelho, chip e conta | 4 |
| Tarefas do dia agrupadas por aparelho, marcar feito e pulado | 8 |
