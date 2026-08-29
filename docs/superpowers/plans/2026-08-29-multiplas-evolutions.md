# Múltiplas Evolutions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastrar N servidores Evolution no banco e fazer toda chamada à Evolution usar o servidor da conta, com "Verificar todas" e os dropdowns de instância consultando todos os servidores ativos e juntando o resultado.

**Architecture:** Nova tabela `evolution_server` (CRUD por tela `/servidores`). `account` ganha `evolutionServerId` nullable ao lado do `instance_name` que já existe. O cliente `lib/evolution.ts` deixa de ler `process.env` e recebe `{url, apiKey}` por parâmetro. `listarInstancias` passa a receber uma lista de servidores, consulta em paralelo e marca cada instância com seu `serverId`. `acharInstancia` devolve `{serverId, name}`.

**Tech Stack:** Next.js 16 (App Router, server components + server actions), Drizzle ORM + Postgres, `node --test` para testes de funções puras, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-08-29-multiplas-evolutions-design.md`

## Global Constraints

- Uma conta vive em **exatamente um** servidor (`account.evolutionServerId`, nullable).
- Conta só sincroniza com `evolutionServerId` **e** `instance_name` preenchidos **e** servidor `ativo = true`; caso contrário grava `evolutionStatus: "desconhecido"`, `proxyStatus: "sem_conexao"`.
- `.env` `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` **não são mais lidos** por nenhum código. Tabela nasce vazia.
- API key guardada em claro no banco; na UI aparece **mascarada**: `"••••" + apiKey.slice(-4)` (ou `"••••"` se `length < 4`).
- URL normalizada em toda escrita: `.trim().replace(/\/$/, "")`. Recusar se não começar com `http://` ou `https://`.
- Valor do dropdown de instância: `"<serverId>::<name>"`. Parser faz split **no primeiro** `::` (`name` pode conter `::`). Sem `::` no valor ⇒ tratar como vazio.
- `acharInstancia` casa por sufixo de dígitos, mínimo 10 dígitos, contra `number` **e** `ownerJid`; devolve resultado **só quando exatamente uma** instância casa em todo o pool (2+ em qualquer servidor ⇒ `null`).
- `listarInstancias`: `Promise.allSettled`; servidor que falha é ignorado (`console.warn`), os outros entram.
- Server actions de formulário seguem o padrão existente em `lib/actions.ts`: assinatura `(estado: EstadoDoForm, formData: FormData) => Promise<EstadoDoForm>`, corpo dentro de `comMensagem(async () => { ... })`, helpers `texto()` / `textoOpcional()`. Actions sem retorno de estado usam `refresh()` de `next/cache` no fim.
- Toda migração: `npx drizzle-kit generate` depois `npx drizzle-kit migrate`. Nunca escrever SQL de migração à mão.
- Commits pequenos e frequentes, um por task no mínimo. Mensagens em português, prefixo `feat:` / `test:` / `refactor:`. Terminar com a linha `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- `EVOLUTION_API_KEY` de teste já é setada no topo de `lib/evolution.test.ts` — não remover.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `lib/schema.ts` | + tabela `evolutionServer`, + coluna `account.evolutionServerId` |
| `drizzle/0004_*.sql` + `drizzle/meta/*` | migração gerada |
| `lib/evolution.ts` | cliente HTTP puro por servidor; `listarInstancias(servidores[])`; `acharInstancia → {serverId,name}`; sem `process.env` |
| `lib/evolution.test.ts` | casos de `acharInstancia` e `listarInstancias` multi-servidor; parser do valor do dropdown |
| `lib/evolution-actions.ts` | `contextoDaConta`; `verificarSemRefresh` / `definirInstancia` / `verificarConexoes` / `gerarQrCode` por servidor |
| `lib/queries.ts` | `listarServidoresEvolution`, `servidoresEvolutionAtivos`; fichas com servidor |
| `lib/actions.ts` | 4 actions de servidor; `ativarConta` grava servidor+instância; mensagem de constraint |
| `app/servidores/page.tsx` | tela de servidores |
| `components/servidor-form.tsx` | forms de criar/editar/alternar/remover servidor |
| `components/app-sidebar.tsx` | item "Servidores" na sidebar |
| `app/cadastro/page.tsx` | dropdown de instância multi-servidor |
| `app/aparelho/[id]/page.tsx` + `components/aparelho-form.tsx` | `DefinirInstancia` multi-servidor |

---

## Task 1: Tabela `evolution_server` + coluna em `account`

**Files:**
- Modify: `lib/schema.ts`
- Create: `drizzle/0004_*.sql` (gerada) + arquivos em `drizzle/meta/`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces:
  - `evolutionServer` pgTable com colunas `id` (serial PK), `nome` (text notNull), `url` (text notNull), `apiKey` (text notNull, coluna `api_key`), `ativo` (boolean notNull default true), `createdAt` (timestamptz notNull defaultNow, coluna `created_at`).
  - `uniqueIndex("evolution_server_url")` em `url`.
  - `account.evolutionServerId` (integer, nullable, coluna `evolution_server_id`, `.references(() => evolutionServer.id)`).
  - Tipos inferidos: `typeof evolutionServer.$inferSelect`.

- [ ] **Step 1: Adicionar a tabela e a coluna no schema**

Em `lib/schema.ts`, depois da tabela `warmupTask` (ou no fim do arquivo, antes de nada que dependa disso — a ordem não importa pro Drizzle desde que `evolutionServer` seja declarada antes de ser referenciada por `account`; mova a declaração para **antes** de `export const account`):

```ts
export const evolutionServer = pgTable(
  "evolution_server",
  {
    id: serial("id").primaryKey(),
    nome: text("nome").notNull(),
    url: text("url").notNull(),
    apiKey: text("api_key").notNull(),
    ativo: boolean("ativo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("evolution_server_url").on(t.url)],
)
```

No topo do arquivo, garantir que `boolean` está importado de `drizzle-orm/pg-core`:

```ts
import {
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
```

Na tabela `account`, adicionar a coluna logo depois de `instanceName`:

```ts
    instanceName: text("instance_name"),
    evolutionServerId: integer("evolution_server_id").references(() => evolutionServer.id),
```

`evolutionServer` precisa estar declarada **acima** de `account` no arquivo. Se estiver abaixo, mova o bloco.

- [ ] **Step 2: Gerar a migração**

Run: `npx drizzle-kit generate`
Expected: cria `drizzle/0004_<nome>.sql` contendo `CREATE TABLE "evolution_server"`, `CREATE UNIQUE INDEX "evolution_server_url"` e `ALTER TABLE "account" ADD COLUMN "evolution_server_id" integer` com a FK. Também atualiza `drizzle/meta/_journal.json` e cria um snapshot.

- [ ] **Step 3: Inspecionar o SQL gerado**

Run: `cat drizzle/0004_*.sql`
Expected: confere que tem `CREATE TABLE "evolution_server"` com as 6 colunas, o índice único em `url`, e o `ALTER TABLE "account" ADD COLUMN "evolution_server_id" integer REFERENCES "evolution_server"("id")`. Nada de `DROP`.

- [ ] **Step 4: Aplicar a migração**

Run: `npx drizzle-kit migrate`
Expected: `migrations applied successfully!`

- [ ] **Step 5: Confirmar no banco**

Run: `node --env-file=.env.local -e "const{Client}=require('pg');const c=new Client(process.env.DATABASE_URL);c.connect().then(()=>c.query(\"select column_name from information_schema.columns where table_name='evolution_server'\")).then(r=>{console.log(r.rows.map(x=>x.column_name));return c.query(\"select column_name from information_schema.columns where table_name='account' and column_name='evolution_server_id'\")}).then(r=>{console.log(r.rows);return c.end()})"`
Expected: primeira linha lista `id, nome, url, api_key, ativo, created_at`; segunda mostra `[ { column_name: 'evolution_server_id' } ]`.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add lib/schema.ts drizzle/
git commit -m "feat: tabela evolution_server e coluna account.evolution_server_id

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `acharInstancia` devolve `{serverId, name}`

**Files:**
- Modify: `lib/evolution.ts`
- Modify: `lib/evolution.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores (só o tipo `InstanciaEvolution` que já existe em `lib/evolution.ts`).
- Produces:
  - `InstanciaEvolution` ganha `serverId: number` e `serverNome: string`.
  - `acharInstancia(numeroChip: string, instancias: InstanciaEvolution[]): { serverId: number; name: string } | null`.

**Contexto:** `lib/evolution.ts` hoje tem:
```ts
export type InstanciaEvolution = {
  name: string
  numero: string | null
  status: "aberta" | "conectando" | "fechada" | "desconhecido"
  digitos: string[]
}
export function acharInstancia(numeroChip: string, instancias: InstanciaEvolution[]): string | null {
  const alvo = numeroChip.replace(/\D/g, "")
  if (alvo.length < MIN_DIGITOS) return null
  const casa = (a: string, b: string) =>
    a.length >= MIN_DIGITOS && b.length >= MIN_DIGITOS && (a.endsWith(b) || b.endsWith(a))
  const achados = instancias.filter((i) => i.digitos.some((d) => casa(alvo, d)))
  return achados.length === 1 ? achados[0].name : null
}
```
`MIN_DIGITOS` é `10`, já definido no arquivo.

- [ ] **Step 1: Reescrever os testes de `acharInstancia` (falhando)**

Em `lib/evolution.test.ts`, substituir o helper `inst` e os 4 testes de `acharInstancia` por:

```ts
function inst(
  name: string,
  digitos: string[],
  serverId = 1,
  serverNome = "Servidor",
): InstanciaEvolution {
  return { serverId, serverNome, name, numero: digitos[0] ?? null, status: "aberta", digitos }
}

test("acharInstancia: match único devolve serverId e name do servidor certo", () => {
  const instancias = [
    inst("39fernanda", ["5563992026453"], 1, "Evo A"),
    inst("02- 5563981263783", ["5563981263783", "556381263783"], 2, "Evo B"),
  ]
  assert.deepEqual(acharInstancia("63981263783", instancias), {
    serverId: 2,
    name: "02- 5563981263783",
  })
})

test("acharInstancia: mesmo número em dois servidores → null", () => {
  const instancias = [
    inst("a", ["5563981263783"], 1, "Evo A"),
    inst("b", ["5563981263783"], 2, "Evo B"),
  ]
  assert.equal(acharInstancia("63981263783", instancias), null)
})

test("acharInstancia: nenhuma casa → null", () => {
  assert.equal(acharInstancia("63999999999", [inst("x", ["5563981263783"])]), null)
})

test("acharInstancia: número curto demais → null", () => {
  assert.equal(acharInstancia("12345", [inst("x", ["12345"])]), null)
})
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npm test`
Expected: FAIL nos testes de `acharInstancia` — `acharInstancia` ainda devolve string, não objeto; e `InstanciaEvolution` não tem `serverId`/`serverNome` (erro de tipo no `inst`).

- [ ] **Step 3: Atualizar o tipo e a função**

Em `lib/evolution.ts`:

```ts
export type InstanciaEvolution = {
  serverId: number
  serverNome: string
  name: string
  numero: string | null
  status: "aberta" | "conectando" | "fechada" | "desconhecido"
  digitos: string[]
}

export function acharInstancia(
  numeroChip: string,
  instancias: InstanciaEvolution[],
): { serverId: number; name: string } | null {
  const alvo = numeroChip.replace(/\D/g, "")
  if (alvo.length < MIN_DIGITOS) return null

  const casa = (a: string, b: string) =>
    a.length >= MIN_DIGITOS && b.length >= MIN_DIGITOS && (a.endsWith(b) || b.endsWith(a))

  const achados = instancias.filter((i) => i.digitos.some((d) => casa(alvo, d)))
  return achados.length === 1
    ? { serverId: achados[0].serverId, name: achados[0].name }
    : null
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test`
Expected: os 4 testes de `acharInstancia` PASSAM. Os testes de `listarInstancias` (`buscarProxy`, etc.) podem falhar de compilação porque `listarInstancias` ainda produz `InstanciaEvolution` sem `serverId` — isso é resolvido na Task 3. Se `npm test` inteiro não compilar, seguir mesmo assim para a Task 3 (as duas tasks juntas deixam o arquivo consistente). Se preferir manter verde: aplicar Task 3 na sequência antes de commitar.

- [ ] **Step 5: Commit (junto com a Task 3)**

Não commitar isolado se `npm test` não compila. Seguir direto para a Task 3 e commitar as duas juntas.

---

## Task 3: `listarInstancias` recebe lista de servidores

**Files:**
- Modify: `lib/evolution.ts`
- Modify: `lib/evolution.test.ts`

**Interfaces:**
- Consumes: `InstanciaEvolution` com `serverId`/`serverNome` (Task 2).
- Produces:
  - `type ServidorEvolution = { url: string; apiKey: string }`
  - `type ServidorComId = ServidorEvolution & { id: number; nome: string }`
  - `chamarEvolution<T>(servidor: ServidorEvolution, caminho: string, init?: RequestInit): Promise<T | null>` (privada)
  - `buscarStatusConexao(servidor: ServidorEvolution, instanceName: string): Promise<"aberta"|"conectando"|"fechada"|"desconhecido">`
  - `buscarProxy(servidor: ServidorEvolution, instanceName: string): Promise<"sem_conexao"|"ativa"|"inativa">`
  - `pedirQrCode(servidor: ServidorEvolution, instanceName: string): Promise<string>`
  - `listarInstancias(servidores: ServidorComId[]): Promise<InstanciaEvolution[]>`
  - `baseUrl()` **removida**.

**Contexto:** hoje `lib/evolution.ts` tem `baseUrl()` que lê `process.env.EVOLUTION_API_URL`, e `chamarEvolution(caminho, init?)` que usa `baseUrl()` e `process.env.EVOLUTION_API_KEY`. `listarInstancias()` não recebe parâmetro e chama `/instance/fetchInstances`. O teste mocka `globalThis.fetch` por pathname via `mockFetch()`.

- [ ] **Step 1: Escrever o teste de `listarInstancias` multi-servidor (falhando)**

Em `lib/evolution.test.ts`, adicionar depois dos testes de `acharInstancia`:

```ts
test("listarInstancias: junta instâncias de dois servidores, cada uma com seu serverId", async () => {
  globalThis.fetch = (async (entrada: string | URL) => {
    const u = new URL(String(entrada))
    if (u.host === "a.test" && u.pathname === "/instance/fetchInstances") {
      return Response.json([
        { name: "insta", number: "5563981263783", connectionStatus: "open" },
      ])
    }
    if (u.host === "b.test" && u.pathname === "/instance/fetchInstances") {
      return Response.json([
        { name: "instb", number: "5563992026453", connectionStatus: "close" },
      ])
    }
    throw new Error(`não mockado: ${u.href}`)
  }) as typeof fetch

  const r = await listarInstancias([
    { id: 1, nome: "Evo A", url: "http://a.test", apiKey: "k1" },
    { id: 2, nome: "Evo B", url: "http://b.test", apiKey: "k2" },
  ])

  assert.equal(r.length, 2)
  const a = r.find((x) => x.name === "insta")!
  const b = r.find((x) => x.name === "instb")!
  assert.equal(a.serverId, 1)
  assert.equal(a.serverNome, "Evo A")
  assert.equal(a.status, "aberta")
  assert.equal(b.serverId, 2)
  assert.equal(b.status, "fechada")
})

test("listarInstancias: servidor que falha é ignorado, o outro entra", async () => {
  globalThis.fetch = (async (entrada: string | URL) => {
    const u = new URL(String(entrada))
    if (u.host === "ok.test") {
      return Response.json([{ name: "viva", number: "5563981263783", connectionStatus: "open" }])
    }
    throw new Error("servidor caiu")
  }) as typeof fetch

  const r = await listarInstancias([
    { id: 1, nome: "OK", url: "http://ok.test", apiKey: "k" },
    { id: 2, nome: "Morto", url: "http://morto.test", apiKey: "k" },
  ])

  assert.equal(r.length, 1)
  assert.equal(r[0].name, "viva")
  assert.equal(r[0].serverId, 1)
})
```

- [ ] **Step 2: Ajustar os testes existentes de `buscarStatusConexao` / `buscarProxy` / `pedirQrCode`**

Esses testes hoje chamam `buscarStatusConexao("5511999998888")`. Passar a config de servidor como primeiro argumento. Fazer um helper no topo do arquivo (depois das linhas `process.env.EVOLUTION_API_*`):

```ts
const SERVIDOR = { url: "http://evolution.test", apiKey: "chave-de-teste" }
```

E trocar em todos os testes:
- `buscarStatusConexao("5511999998888")` → `buscarStatusConexao(SERVIDOR, "5511999998888")`
- `buscarProxy("5511999998888")` → `buscarProxy(SERVIDOR, "5511999998888")`
- `pedirQrCode("5511999998888")` → `pedirQrCode(SERVIDOR, "5511999998888")`

O `mockFetch` já compara só `pathname`, então continua funcionando com `http://evolution.test`.

O teste `"normalizarNumero: remove tudo que não é dígito"` fica igual — `normalizarNumero` não muda.

- [ ] **Step 3: Rodar os testes e ver falhar**

Run: `npm test`
Expected: FAIL — `listarInstancias` não aceita argumento e não põe `serverId`; as funções `buscar*` ainda têm assinatura de 1 argumento.

- [ ] **Step 4: Reescrever o cliente em `lib/evolution.ts`**

Remover `baseUrl()`. Trocar `chamarEvolution` e as funções públicas:

```ts
export type ServidorEvolution = { url: string; apiKey: string }
export type ServidorComId = ServidorEvolution & { id: number; nome: string }

/** Chamada crua contra uma Evolution. Erro de rede ou resposta não-ok → `null`. */
async function chamarEvolution<T>(
  servidor: ServidorEvolution,
  caminho: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const base = servidor.url.replace(/\/$/, "")
    const resposta = await fetch(`${base}${caminho}`, {
      ...init,
      headers: { apikey: servidor.apiKey, ...init?.headers },
    })
    if (!resposta.ok) return null
    return (await resposta.json()) as T
  } catch {
    return null
  }
}

export async function buscarStatusConexao(
  servidor: ServidorEvolution,
  instanceName: string,
): Promise<"aberta" | "conectando" | "fechada" | "desconhecido"> {
  const dados = await chamarEvolution<ConnectionStateApi>(
    servidor,
    `/instance/connectionState/${instanceName}`,
  )
  return mapearEstado(dados?.instance?.state)
}

export async function buscarProxy(
  servidor: ServidorEvolution,
  instanceName: string,
): Promise<"sem_conexao" | "ativa" | "inativa"> {
  const dados = await chamarEvolution<ProxyApi>(servidor, `/proxy/find/${instanceName}`)
  if (!dados?.host) return "sem_conexao"
  return dados.enabled === false ? "inativa" : "ativa"
}

export async function pedirQrCode(
  servidor: ServidorEvolution,
  instanceName: string,
): Promise<string> {
  const dados = await chamarEvolution<ConnectApi>(servidor, `/instance/connect/${instanceName}`, {
    method: "POST",
  })
  if (!dados?.base64) throw new Error("Evolution API não retornou QR code.")
  return dados.base64
}

export async function listarInstancias(
  servidores: ServidorComId[],
): Promise<InstanciaEvolution[]> {
  const porServidor = await Promise.allSettled(
    servidores.map(async (s) => {
      const dados = await chamarEvolution<InstanciaApi[]>(s, `/instance/fetchInstances`)
      if (!Array.isArray(dados)) {
        console.warn(`listarInstancias: ${s.nome} não devolveu lista`)
        return []
      }
      return dados
        .filter((i): i is InstanciaApi & { name: string } => typeof i.name === "string")
        .map((i) => {
          const doNumber = (i.number ?? "").replace(/\D/g, "")
          const doOwner = (i.ownerJid ?? "").replace(/\D/g, "")
          return {
            serverId: s.id,
            serverNome: s.nome,
            name: i.name,
            numero: i.number ?? i.ownerJid?.replace(/@.*/, "") ?? null,
            status: mapearEstado(i.connectionStatus),
            digitos: [doNumber, doOwner].filter((d) => d.length >= 10),
          } satisfies InstanciaEvolution
        })
    }),
  )

  return porServidor
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .sort((a, b) => a.serverNome.localeCompare(b.serverNome) || a.name.localeCompare(b.name))
}
```

Manter `normalizarNumero`, `mapearEstado`, `InstanciaApi`, `ConnectionStateApi`, `ProxyApi`, `ConnectApi`, `MIN_DIGITOS` como estão. `normalizarNumero` continua exportada (usada em testes).

- [ ] **Step 5: Rodar os testes**

Run: `npm test`
Expected: TODOS passam — `acharInstancia` (Task 2), `listarInstancias` novos, `buscarStatusConexao`/`buscarProxy`/`pedirQrCode` com a nova assinatura, `normalizarNumero`.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: **vai falhar** em `lib/evolution-actions.ts`, `app/cadastro/page.tsx`, `app/aparelho/[id]/page.tsx`, `components/aparelho-form.tsx` — todos chamam as funções antigas. Isso é esperado; as próximas tasks corrigem. Anotar os arquivos com erro e seguir.

- [ ] **Step 7: Commit**

```bash
git add lib/evolution.ts lib/evolution.test.ts
git commit -m "feat: cliente Evolution recebe servidor por parametro, listarInstancias junta varios

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Queries de servidor

**Files:**
- Modify: `lib/queries.ts`

**Interfaces:**
- Consumes: `evolutionServer` (Task 1); `ServidorComId` de `lib/evolution.ts` (Task 3).
- Produces:
  - `type ServidorNaLista = { id: number; nome: string; url: string; apiKeyMascara: string; ativo: boolean; contasVinculadas: number }`
  - `listarServidoresEvolution(): Promise<ServidorNaLista[]>`
  - `servidoresEvolutionAtivos(): Promise<ServidorComId[]>`

**Contexto:** `lib/queries.ts` importa de `./schema.ts` e usa `db` de `./db.ts`. Padrão de import no topo: `import { account, chip, device, incident, warmupAction, warmupTask } from "./schema.ts"`. Usa `drizzle-orm` (`and`, `asc`, `count`, `eq`, `sql`, etc.).

- [ ] **Step 1: Adicionar as duas queries**

No topo, incluir `evolutionServer` no import de `./schema.ts` e `eq`, `count`, `asc` já estão importados de `drizzle-orm` (confirmar; se `count` faltar, adicionar). Importar o tipo:

```ts
import type { ServidorComId } from "./evolution.ts"
```

No fim do arquivo:

```ts
export type ServidorNaLista = {
  id: number
  nome: string
  url: string
  apiKeyMascara: string
  ativo: boolean
  contasVinculadas: number
}

function mascararKey(apiKey: string): string {
  return apiKey.length >= 4 ? `••••${apiKey.slice(-4)}` : "••••"
}

/** Lista pra tela /servidores: key mascarada e contagem de contas usando cada um. */
export async function listarServidoresEvolution(): Promise<ServidorNaLista[]> {
  const [servidores, contagem] = await Promise.all([
    db.select().from(evolutionServer).orderBy(asc(evolutionServer.nome)),
    db
      .select({ serverId: account.evolutionServerId, n: count() })
      .from(account)
      .groupBy(account.evolutionServerId),
  ])

  return servidores.map((s) => ({
    id: s.id,
    nome: s.nome,
    url: s.url,
    apiKeyMascara: mascararKey(s.apiKey),
    ativo: s.ativo,
    contasVinculadas: contagem.find((c) => c.serverId === s.id)?.n ?? 0,
  }))
}

/** Servidores ativos com a key em claro — uso interno de actions/sync. */
export async function servidoresEvolutionAtivos(): Promise<ServidorComId[]> {
  const linhas = await db
    .select()
    .from(evolutionServer)
    .where(eq(evolutionServer.ativo, true))
    .orderBy(asc(evolutionServer.nome))
  return linhas.map((s) => ({ id: s.id, nome: s.nome, url: s.url, apiKey: s.apiKey }))
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: `lib/queries.ts` sem novos erros (os erros pré-existentes de `evolution-actions.ts` e páginas continuam — serão resolvidos adiante).

- [ ] **Step 3: Smoke test das queries**

Run: `node --env-file=.env.local --input-type=module -e "import { listarServidoresEvolution, servidoresEvolutionAtivos } from './lib/queries.ts'; console.log('lista:', await listarServidoresEvolution()); console.log('ativos:', await servidoresEvolutionAtivos()); process.exit(0)"`
Expected: `lista: []` e `ativos: []` (tabela vazia), sem erro de SQL.

- [ ] **Step 4: Commit**

```bash
git add lib/queries.ts
git commit -m "feat: queries listarServidoresEvolution e servidoresEvolutionAtivos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Actions de CRUD de servidor

**Files:**
- Modify: `lib/actions.ts`

**Interfaces:**
- Consumes: `evolutionServer` (Task 1).
- Produces (todas server actions `"use server"` já no topo do arquivo):
  - `criarServidorEvolution(estado: EstadoDoForm, formData: FormData): Promise<EstadoDoForm>`
  - `editarServidorEvolution(estado: EstadoDoForm, formData: FormData): Promise<EstadoDoForm>`
  - `alternarServidorEvolution(formData: FormData): Promise<void>`
  - `removerServidorEvolution(estado: EstadoDoForm, formData: FormData): Promise<EstadoDoForm>`
  - Chave `evolution_server_url` em `MENSAGEM_DA_CONSTRAINT`.

**Contexto:** `lib/actions.ts` já tem: `EstadoDoForm`, `MENSAGEM_DA_CONSTRAINT` (record), `comMensagem`, `texto`, `textoOpcional`, `ErroDeValidacao`, e importa `{ account, chip, device, incident, warmupTask }` de `./schema.ts` e `{ and, eq, isNull, sql }` de `drizzle-orm`, `{ refresh }` de `next/cache`.

- [ ] **Step 1: Helper de normalização + validação de URL**

Perto dos outros helpers (`texto`, `textoOpcional`):

```ts
function urlDeServidor(formData: FormData): string {
  const bruta = texto(formData, "url").replace(/\/$/, "")
  if (!/^https?:\/\//i.test(bruta)) {
    throw new ErroDeValidacao("A URL deve começar com http:// ou https://")
  }
  return bruta
}
```

- [ ] **Step 2: Adicionar a mensagem de constraint**

Em `MENSAGEM_DA_CONSTRAINT`, acrescentar a linha:

```ts
  evolution_server_url: "Já existe um servidor com essa URL.",
```

- [ ] **Step 3: Incluir `evolutionServer` no import de schema**

```ts
import { account, chip, device, evolutionServer, incident, warmupTask } from "./schema.ts"
```

- [ ] **Step 4: As quatro actions**

No fim do arquivo:

```ts
export async function criarServidorEvolution(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db.insert(evolutionServer).values({
      nome: texto(formData, "nome"),
      url: urlDeServidor(formData),
      apiKey: texto(formData, "apiKey"),
    })
    return { aviso: "Servidor cadastrado." }
  })
}

export async function editarServidorEvolution(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    const novaKey = textoOpcional(formData, "apiKey")
    await db
      .update(evolutionServer)
      .set({
        nome: texto(formData, "nome"),
        url: urlDeServidor(formData),
        ...(novaKey ? { apiKey: novaKey } : {}),
      })
      .where(eq(evolutionServer.id, Number(texto(formData, "serverId"))))
    return { aviso: "Servidor atualizado." }
  })
}

export async function alternarServidorEvolution(formData: FormData) {
  const id = Number(texto(formData, "serverId"))
  const [atual] = await db
    .select({ ativo: evolutionServer.ativo })
    .from(evolutionServer)
    .where(eq(evolutionServer.id, id))
  if (atual) {
    await db
      .update(evolutionServer)
      .set({ ativo: !atual.ativo })
      .where(eq(evolutionServer.id, id))
  }
  refresh()
}

export async function removerServidorEvolution(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    const id = Number(texto(formData, "serverId"))
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(account)
      .where(eq(account.evolutionServerId, id))
    if (n > 0) {
      throw new ErroDeValidacao(
        `${n} conta(s) usam este servidor. Desative em vez de remover.`,
      )
    }
    await db.delete(evolutionServer).where(eq(evolutionServer.id, id))
    return { aviso: "Servidor removido." }
  })
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: `lib/actions.ts` sem novos erros.

- [ ] **Step 6: Smoke test — cria, edita, tenta remover, remove**

Run: `node --env-file=.env.local --input-type=module -e "import { criarServidorEvolution, removerServidorEvolution } from './lib/actions.ts'; const fd=new FormData(); fd.set('nome','Teste'); fd.set('url','https://x.test/'); fd.set('apiKey','abc123'); console.log(await criarServidorEvolution(null, fd)); const { db } = await import('./lib/db.ts'); const { evolutionServer } = await import('./lib/schema.ts'); const [s] = await db.select().from(evolutionServer); console.log('salvo:', s.nome, s.url); const rf=new FormData(); rf.set('serverId', String(s.id)); console.log(await removerServidorEvolution(null, rf)); process.exit(0)"`
Expected: `{ aviso: 'Servidor cadastrado.' }`, `salvo: Teste https://x.test` (sem barra final), `{ aviso: 'Servidor removido.' }`.

- [ ] **Step 7: Commit**

```bash
git add lib/actions.ts
git commit -m "feat: actions de CRUD de servidor Evolution

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `evolution-actions.ts` por servidor

**Files:**
- Modify: `lib/evolution-actions.ts`

**Interfaces:**
- Consumes: `buscarStatusConexao`, `buscarProxy`, `pedirQrCode`, `listarInstancias`, `acharInstancia`, `ServidorEvolution` de `lib/evolution.ts` (Task 3); `servidoresEvolutionAtivos` de `lib/queries.ts` (Task 4); `evolutionServer` de `lib/schema.ts` (Task 1).
- Produces:
  - `contextoDaConta(accountId: number): Promise<{ servidor: ServidorEvolution; instanceName: string } | null>` (privada)
  - `verificarConexao(accountId: number): Promise<void>` (inalterada por fora)
  - `verificarConexoes(accountIds: number[]): Promise<void>` (inalterada por fora)
  - `definirInstancia(formData: FormData): Promise<void>` — lê `accountId` e `instancia` (`"<serverId>::<name>"`)
  - `gerarQrCode(accountId: number): Promise<string>`

**Contexto atual do arquivo:** importa `{ and, eq, inArray, isNull }` de `drizzle-orm`, `{ refresh }` de `next/cache`, `{ db }`, `{ account, chip }` de `./schema.ts`, e de `./evolution.ts`: `{ acharInstancia, buscarProxy, buscarStatusConexao, listarInstancias, pedirQrCode }`. Tem `instanceNameDaConta`, `verificarSemRefresh`, `verificarConexao`, `TAMANHO_LOTE`, `autoAssociarInstancias`, `verificarConexoes`, `definirInstancia`, `gerarQrCode`.

- [ ] **Step 1: Ajustar imports**

```ts
import { and, eq, inArray, isNull } from "drizzle-orm"
import { refresh } from "next/cache"

import { db } from "./db.ts"
import {
  acharInstancia,
  buscarProxy,
  buscarStatusConexao,
  listarInstancias,
  pedirQrCode,
  type ServidorEvolution,
} from "./evolution.ts"
import { servidoresEvolutionAtivos } from "./queries.ts"
import { account, chip, evolutionServer } from "./schema.ts"
```

- [ ] **Step 2: Trocar `instanceNameDaConta` por `contextoDaConta`**

Remover `instanceNameDaConta`. Adicionar:

```ts
/**
 * Servidor + nome da instância de uma conta. `null` se faltar servidor ou
 * instância, ou se o servidor estiver desativado.
 */
async function contextoDaConta(
  accountId: number,
): Promise<{ servidor: ServidorEvolution; instanceName: string } | null> {
  const [linha] = await db
    .select({
      instanceName: account.instanceName,
      url: evolutionServer.url,
      apiKey: evolutionServer.apiKey,
      ativo: evolutionServer.ativo,
    })
    .from(account)
    .leftJoin(evolutionServer, eq(evolutionServer.id, account.evolutionServerId))
    .where(eq(account.id, accountId))
  if (!linha) throw new Error("Conta não encontrada.")
  if (!linha.instanceName || !linha.url || !linha.apiKey || !linha.ativo) return null
  return { servidor: { url: linha.url, apiKey: linha.apiKey }, instanceName: linha.instanceName }
}
```

- [ ] **Step 3: `verificarSemRefresh` usa o contexto**

```ts
async function verificarSemRefresh(accountId: number): Promise<void> {
  const ctx = await contextoDaConta(accountId)

  if (!ctx) {
    await db
      .update(account)
      .set({
        evolutionStatus: "desconhecido",
        proxyStatus: "sem_conexao",
        statusVerificadoEm: new Date(),
      })
      .where(eq(account.id, accountId))
    return
  }

  const [evolutionStatus, proxyStatus] = await Promise.all([
    buscarStatusConexao(ctx.servidor, ctx.instanceName),
    buscarProxy(ctx.servidor, ctx.instanceName),
  ])

  await db
    .update(account)
    .set({ evolutionStatus, proxyStatus, statusVerificadoEm: new Date() })
    .where(eq(account.id, accountId))
}
```

- [ ] **Step 4: `autoAssociarInstancias` — grava servidor + instância**

```ts
async function autoAssociarInstancias(accountIds: number[]): Promise<void> {
  if (accountIds.length === 0) return

  const semInstancia = await db
    .select({ id: account.id, numero: chip.numero })
    .from(account)
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(and(inArray(account.id, accountIds), isNull(account.instanceName)))

  if (semInstancia.length === 0) return

  const servidores = await servidoresEvolutionAtivos()
  if (servidores.length === 0) return

  const instancias = await listarInstancias(servidores)
  if (instancias.length === 0) return

  for (const conta of semInstancia) {
    const achado = acharInstancia(conta.numero, instancias)
    if (achado) {
      await db
        .update(account)
        .set({ evolutionServerId: achado.serverId, instanceName: achado.name })
        .where(eq(account.id, conta.id))
    }
  }
}
```

`verificarConexoes` fica igual (já chama `autoAssociarInstancias` no início e depois o loop de `verificarSemRefresh`). `verificarConexao` idem.

- [ ] **Step 5: `definirInstancia` — parseia `"<serverId>::<name>"`**

```ts
export async function definirInstancia(formData: FormData): Promise<void> {
  const accountId = Number(formData.get("accountId"))
  if (!Number.isInteger(accountId)) throw new Error("Conta inválida.")

  const bruto = formData.get("instancia")
  const valor = typeof bruto === "string" ? bruto.trim() : ""
  const sep = valor.indexOf("::")

  let evolutionServerId: number | null = null
  let instanceName: string | null = null
  if (sep > 0) {
    const id = Number(valor.slice(0, sep))
    const nome = valor.slice(sep + 2)
    if (Number.isInteger(id) && nome) {
      const [existe] = await db
        .select({ id: evolutionServer.id })
        .from(evolutionServer)
        .where(eq(evolutionServer.id, id))
      if (existe) {
        evolutionServerId = id
        instanceName = nome
      }
    }
  }

  await db
    .update(account)
    .set({ evolutionServerId, instanceName })
    .where(eq(account.id, accountId))
  await verificarSemRefresh(accountId)
  refresh()
}
```

- [ ] **Step 6: `gerarQrCode`**

```ts
export async function gerarQrCode(accountId: number): Promise<string> {
  const ctx = await contextoDaConta(accountId)
  if (!ctx) {
    throw new Error("Associe esta conta a um servidor e uma instância da Evolution primeiro.")
  }
  return pedirQrCode(ctx.servidor, ctx.instanceName)
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: `lib/evolution-actions.ts` sem erros. Ainda restam erros em `app/cadastro/page.tsx`, `app/aparelho/[id]/page.tsx`, `components/aparelho-form.tsx` (Tasks 8–9).

- [ ] **Step 8: Rodar testes (nada quebrou nos puros)**

Run: `npm test`
Expected: 33+ testes passam (nenhum toca `evolution-actions`).

- [ ] **Step 9: Commit**

```bash
git add lib/evolution-actions.ts
git commit -m "feat: evolution-actions resolve servidor da conta e associa servidor+instancia

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Tela `/servidores` + sidebar

**Files:**
- Create: `app/servidores/page.tsx`
- Create: `components/servidor-form.tsx`
- Modify: `components/app-sidebar.tsx`

**Interfaces:**
- Consumes: `listarServidoresEvolution` (Task 4); `criarServidorEvolution`, `editarServidorEvolution`, `alternarServidorEvolution`, `removerServidorEvolution` (Task 5); `FormAcao` de `components/form-acao.tsx`; `PageHeader`, `Button`, `Input`, `Label` (existentes).
- Produces: rota `/servidores`.

**Contexto:** `FormAcao` (`components/form-acao.tsx`) recebe `acao: (estado, formData) => Promise<EstadoDoForm>` e `children`, renderiza `<form action={enviar}>` e mostra `estado.erro`/`estado.aviso`. Componentes UI em `components/ui/`. `PageHeader` recebe `titulo`, `subtitulo`, `acoes?`. Ver `app/cadastro/page.tsx` como referência de página com forms.

- [ ] **Step 1: `components/servidor-form.tsx`**

```tsx
"use client"

import { FormAcao } from "@/components/form-acao"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  alternarServidorEvolution,
  criarServidorEvolution,
  editarServidorEvolution,
  removerServidorEvolution,
} from "@/lib/actions"

export function CriarServidor() {
  return (
    <FormAcao acao={criarServidorEvolution} className="flex flex-col gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="sv-nome">Nome</Label>
        <Input id="sv-nome" name="nome" required placeholder="Evo Principal" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sv-url">URL</Label>
        <Input id="sv-url" name="url" required placeholder="https://evo.exemplo.com.br" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sv-key">API key</Label>
        <Input id="sv-key" name="apiKey" type="password" required />
      </div>
      <Button type="submit" className="self-start">
        Cadastrar servidor
      </Button>
    </FormAcao>
  )
}

export function EditarServidor({
  servidor,
}: {
  servidor: { id: number; nome: string; url: string; apiKeyMascara: string }
}) {
  return (
    <FormAcao acao={editarServidorEvolution} className="flex flex-col gap-3">
      <input type="hidden" name="serverId" value={servidor.id} />
      <div className="grid gap-1.5">
        <Label htmlFor={`sv-nome-${servidor.id}`}>Nome</Label>
        <Input id={`sv-nome-${servidor.id}`} name="nome" defaultValue={servidor.nome} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`sv-url-${servidor.id}`}>URL</Label>
        <Input id={`sv-url-${servidor.id}`} name="url" defaultValue={servidor.url} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`sv-key-${servidor.id}`}>API key</Label>
        <Input
          id={`sv-key-${servidor.id}`}
          name="apiKey"
          type="password"
          placeholder={`${servidor.apiKeyMascara} — deixe vazio para manter`}
        />
      </div>
      <Button type="submit" size="sm" variant="outline" className="self-start">
        Salvar
      </Button>
    </FormAcao>
  )
}

export function AlternarServidor({ id, ativo }: { id: number; ativo: boolean }) {
  return (
    <form action={alternarServidorEvolution}>
      <input type="hidden" name="serverId" value={id} />
      <Button type="submit" size="sm" variant="outline">
        {ativo ? "Desativar" : "Ativar"}
      </Button>
    </form>
  )
}

export function RemoverServidor({ id }: { id: number }) {
  return (
    <FormAcao acao={removerServidorEvolution}>
      <input type="hidden" name="serverId" value={id} />
      <Button type="submit" size="sm" variant="destructive">
        Remover
      </Button>
    </FormAcao>
  )
}
```

- [ ] **Step 2: `app/servidores/page.tsx`**

```tsx
import { Server } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import {
  AlternarServidor,
  CriarServidor,
  EditarServidor,
  RemoverServidor,
} from "@/components/servidor-form"
import { StatusBadge } from "@/components/status-badge"
import { listarServidoresEvolution } from "@/lib/queries"

export const dynamic = "force-dynamic"

export default async function Page() {
  const servidores = await listarServidoresEvolution()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Servidores"
        subtitulo="As Evolutions que o sistema consulta. Cada conta é associada a um servidor."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          {servidores.length === 0 ? (
            <EmptyState
              Icone={Server}
              Ilustracao="/vazio-cadastro.png"
              titulo="Nenhum servidor cadastrado"
              descricao="Cadastre uma Evolution para começar a sincronizar."
            />
          ) : (
            servidores.map((s) => (
              <div
                key={s.id}
                className="bg-card border-border flex flex-col gap-3 rounded-xl border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{s.nome}</div>
                    <div className="text-muted-foreground truncate text-sm">{s.url}</div>
                    <div className="text-muted-foreground text-xs">
                      key {s.apiKeyMascara} · {s.contasVinculadas} conta(s)
                    </div>
                  </div>
                  <span
                    className={
                      s.ativo
                        ? "text-xs font-medium text-emerald-600"
                        : "text-muted-foreground text-xs font-medium"
                    }
                  >
                    {s.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <EditarServidor servidor={s} />
                <div className="flex flex-wrap gap-2">
                  <AlternarServidor id={s.id} ativo={s.ativo} />
                  <RemoverServidor id={s.id} />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-card border-border h-fit rounded-xl border p-5">
          <h2 className="mb-4 font-medium">Novo servidor</h2>
          <CriarServidor />
        </div>
      </div>
    </div>
  )
}
```

Nota: se `StatusBadge` não for usado, não importar. O import de `StatusBadge` acima **não é usado** — remover essa linha. (Mantido aqui só pra lembrar que existe; não incluir.)

- [ ] **Step 3: Item na sidebar**

Em `components/app-sidebar.tsx`, no import de lucide adicionar `Server`:

```ts
import { CircuitBoard, LayoutDashboard, PlusCircle, Server, Smartphone, Thermometer } from "lucide-react"
```

No grupo `"Operação"`, adicionar como último item:

```ts
      { href: "/servidores", nome: "Servidores", Icone: Server },
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint app/servidores/page.tsx components/servidor-form.tsx components/app-sidebar.tsx`
Expected: sem erros nesses arquivos. (Erros pendentes em `cadastro` e `aparelho/[id]` continuam.)

- [ ] **Step 5: Build**

Run: `npx next build`
Expected: **vai falhar** em `app/cadastro/page.tsx` / `app/aparelho/[id]/page.tsx` ainda. Se falhar só nesses, seguir. Se falhar em `/servidores`, corrigir antes de commitar.

- [ ] **Step 6: Commit**

```bash
git add app/servidores/ components/servidor-form.tsx components/app-sidebar.tsx
git commit -m "feat: tela /servidores e item na sidebar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `/cadastro` — dropdown de instância multi-servidor

**Files:**
- Modify: `app/cadastro/page.tsx`
- Modify: `lib/actions.ts` (função `ativarConta`)

**Interfaces:**
- Consumes: `servidoresEvolutionAtivos`, `listarInstancias` (Tasks 3–4).
- Produces: `ativarConta` grava `evolutionServerId` + `instanceName` a partir de `formData.get("instancia")` (`"<serverId>::<name>"`).

**Contexto:** `app/cadastro/page.tsx` hoje importa `{ listarInstancias } from "@/lib/evolution"` e faz `const instancias = await listarInstancias()`. O form "Ativar conta" tem um `<select name="instanceName">`. `ativarConta` em `lib/actions.ts` roda numa transação: `tx.insert(account).values({ deviceId, slot, chipId, ativadaEm, instanceName: textoOpcional(formData, "instanceName") })` e depois `tx.update(chip).set({ status: "em_uso" })`.

- [ ] **Step 1: Página — buscar servidores e instâncias**

Trocar o import e a busca:

```ts
import { listarInstancias } from "@/lib/evolution"
import { chipsLivres, servidoresEvolutionAtivos } from "@/lib/queries"
```

```ts
  const servidores = await servidoresEvolutionAtivos()
  const instancias = await listarInstancias(servidores)
```

- [ ] **Step 2: Página — o `<select>` agrupado**

Trocar o bloco do select de instância (hoje `name="instanceName"`) por:

```tsx
            <div className="grid gap-1.5">
              <Label htmlFor="co-instancia">Instância na Evolution</Label>
              <select
                id="co-instancia"
                name="instancia"
                defaultValue=""
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="">— associar depois —</option>
                {servidores.map((s) => (
                  <optgroup key={s.id} label={s.nome}>
                    {instancias
                      .filter((i) => i.serverId === s.id)
                      .map((i) => (
                        <option key={`${i.serverId}::${i.name}`} value={`${i.serverId}::${i.name}`}>
                          {i.name}
                          {i.numero ? ` — ${i.numero}` : ""} ({i.status})
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {servidores.length === 0 && (
                <p className="text-muted-foreground text-xs">
                  Cadastre um servidor Evolution em /servidores primeiro.
                </p>
              )}
            </div>
```

- [ ] **Step 3: `ativarConta` grava servidor + instância**

Em `lib/actions.ts`, dentro de `ativarConta`, trocar o `.values({...})` do insert:

```ts
      const instancia = textoOpcional(formData, "instancia")
      let evolutionServerId: number | null = null
      let instanceName: string | null = null
      if (instancia) {
        const sep = instancia.indexOf("::")
        if (sep > 0) {
          const id = Number(instancia.slice(0, sep))
          const nome = instancia.slice(sep + 2)
          if (Number.isInteger(id) && nome) {
            evolutionServerId = id
            instanceName = nome
          }
        }
      }

      await tx.insert(account).values({
        deviceId: texto(formData, "deviceId"),
        slot: texto(formData, "slot") as "wa1" | "wa2" | "business",
        chipId,
        ativadaEm: texto(formData, "ativadaEm"),
        evolutionServerId,
        instanceName,
      })
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint app/cadastro/page.tsx lib/actions.ts`
Expected: sem erros nesses. Resta `app/aparelho/[id]/page.tsx` + `components/aparelho-form.tsx`.

- [ ] **Step 5: Commit**

```bash
git add app/cadastro/page.tsx lib/actions.ts
git commit -m "feat: cadastro escolhe servidor+instancia no ativar conta

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `/aparelho/[id]` — `DefinirInstancia` multi-servidor

**Files:**
- Modify: `components/aparelho-form.tsx`
- Modify: `app/aparelho/[id]/page.tsx`
- Modify: `lib/queries.ts` (`fichaDoAparelho`)

**Interfaces:**
- Consumes: `InstanciaEvolution` com `serverId`/`serverNome`, `listarInstancias`, `servidoresEvolutionAtivos` (Tasks 3–4); `definirInstancia` (Task 6).
- Produces: `DefinirInstancia` recebe `instanciaAtual: { serverId: number; nome: string } | null` e `instancias: InstanciaEvolution[]`.

**Contexto:** `components/aparelho-form.tsx` já tem `DefinirInstancia({ accountId, instanceAtual, instancias })` usando `<form action={definirInstancia}>` com `<select name="instanceName">`. Importa `type { InstanciaEvolution } from "@/lib/evolution"`. `app/aparelho/[id]/page.tsx` faz `const instancias = await listarInstancias()` e passa `instanceAtual={c.instanceName}`. `fichaDoAparelho` em `lib/queries.ts` faz `.select({ ...CAMPOS_DA_CONTA, status: account.status, instanceName: account.instanceName })` e o tipo `FichaAparelho.contas[]` tem `instanceName: string | null`.

- [ ] **Step 1: `fichaDoAparelho` traz o servidor**

Em `lib/queries.ts`, no tipo `FichaAparelho`:

```ts
  contas: (ContaNaLista & {
    status: "ativa" | "aposentada"
    instanceName: string | null
    evolutionServerId: number | null
    evolutionServerNome: string | null
    incidenteAberto: ContaComIncidente | null
  })[]
```

No select de `contas` dentro de `fichaDoAparelho`:

```ts
  const contas = await db
    .select({
      ...CAMPOS_DA_CONTA,
      status: account.status,
      instanceName: account.instanceName,
      evolutionServerId: account.evolutionServerId,
      evolutionServerNome: evolutionServer.nome,
    })
    .from(account)
    .innerJoin(chip, eq(chip.id, account.chipId))
    .leftJoin(evolutionServer, eq(evolutionServer.id, account.evolutionServerId))
    .where(and(eq(account.deviceId, id), eq(account.status, "ativa")))
    .orderBy(asc(account.slot))
```

Garantir que `evolutionServer` está no import de `./schema.ts` deste arquivo (foi adicionado na Task 4).

- [ ] **Step 2: `DefinirInstancia` multi-servidor**

Em `components/aparelho-form.tsx`, substituir o componente `DefinirInstancia` por:

```tsx
export function DefinirInstancia({
  accountId,
  instanciaAtual,
  instancias,
}: {
  accountId: number
  instanciaAtual: { serverId: number; nome: string } | null
  instancias: InstanciaEvolution[]
}) {
  const servidores = [...new Map(instancias.map((i) => [i.serverId, i.serverNome])).entries()]
  const valorAtual = instanciaAtual
    ? `${instanciaAtual.serverId}::${instanciaAtual.nome}`
    : ""
  const naLista = instancias.some(
    (i) => `${i.serverId}::${i.name}` === valorAtual,
  )

  return (
    <form action={definirInstancia} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <select
        name="instancia"
        defaultValue={valorAtual}
        className="border-input bg-background h-8 rounded-md border px-2 text-sm"
        aria-label="Instância na Evolution"
      >
        <option value="">— sem instância —</option>
        {instanciaAtual && !naLista && (
          <option value={valorAtual}>
            {instanciaAtual.nome} (não encontrada no servidor)
          </option>
        )}
        {servidores.map(([serverId, serverNome]) => (
          <optgroup key={serverId} label={serverNome}>
            {instancias
              .filter((i) => i.serverId === serverId)
              .map((i) => (
                <option key={`${i.serverId}::${i.name}`} value={`${i.serverId}::${i.name}`}>
                  {i.name}
                  {i.numero ? ` — ${i.numero}` : ""} ({i.status})
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline">
        Salvar instância
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Página passa servidores + instância atual**

Em `app/aparelho/[id]/page.tsx`:

```ts
import { listarInstancias } from "@/lib/evolution"
import { servidoresEvolutionAtivos } from "@/lib/queries"
```

```ts
  const servidores = await servidoresEvolutionAtivos()
  const instancias = await listarInstancias(servidores)
```

Na renderização de cada conta, trocar o uso de `DefinirInstancia`:

```tsx
                <DefinirInstancia
                  accountId={c.id}
                  instanciaAtual={
                    c.evolutionServerId && c.instanceName
                      ? { serverId: c.evolutionServerId, nome: c.instanceName }
                      : null
                  }
                  instancias={instancias}
                />
```

Se a ficha exibir o servidor em texto, usar `c.evolutionServerNome`.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint app/aparelho/[id]/page.tsx components/aparelho-form.tsx lib/queries.ts`
Expected: **sem erros em nenhum arquivo do projeto** — este era o último ponto pendente.

- [ ] **Step 5: Testes + build**

Run: `npm test && npx next build`
Expected: todos os testes passam; build completo sem erro; rota `/servidores` aparece na listagem de rotas.

- [ ] **Step 6: Commit**

```bash
git add "app/aparelho/[id]/page.tsx" components/aparelho-form.tsx lib/queries.ts
git commit -m "feat: DefinirInstancia e ficha do aparelho multi-servidor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Smoke test ao vivo + docs

**Files:**
- Modify: `docs/superpowers/pendencias-conhecidas.md`
- Modify: `docs/superpowers/specs/2026-08-25-evolution-api-integracao-design.md`

**Interfaces:**
- Consumes: tudo.
- Produces: nada de código.

- [ ] **Step 1: Cadastrar os dois servidores reais via smoke script**

Run:
```bash
node --env-file=.env.local --input-type=module -e "
import { criarServidorEvolution } from './lib/actions.ts'
for (const [nome,url,key] of [
  ['Evo Principal','https://evo.eliborges.com.br','a2bf62e83438b56a3393189f8442d881'],
  ['Evolideres','https://evolideres.eliborges.com.br','COLOQUE_A_KEY_DA_EVOLIDERES'],
]) { const fd=new FormData(); fd.set('nome',nome); fd.set('url',url); fd.set('apiKey',key); console.log(await criarServidorEvolution(null, fd)) }
process.exit(0)"
```
Expected: dois `{ aviso: 'Servidor cadastrado.' }`. (Se não tiver a key da Evolideres, cadastrar só a Principal — o teste do `allSettled` cobre servidor que falha.)

- [ ] **Step 2: `listarInstancias` + `acharInstancia` ao vivo**

Run:
```bash
node --env-file=.env.local --input-type=module -e "
import { listarInstancias, acharInstancia } from './lib/evolution.ts'
import { servidoresEvolutionAtivos } from './lib/queries.ts'
const s = await servidoresEvolutionAtivos()
const ins = await listarInstancias(s)
console.log(ins.length, 'instancias')
console.log(ins.slice(0,5).map(i => i.serverNome+' / '+i.name+' ('+i.status+')'))
for (const chip of ['63981263783','63920014682'])
  console.log(chip, '->', acharInstancia(chip, ins))
process.exit(0)"
```
Expected: lista as instâncias com o nome do servidor; `63981263783 -> { serverId: <id>, name: '02- 5563981263783' }`; `63920014682 -> null`.

- [ ] **Step 3: Limpar os servidores de teste se foram criados fora de produção**

Se este ambiente for local e não for pra manter os servidores: remover via `removerServidorEvolution`. Se for o ambiente real do operador, deixar.

- [ ] **Step 4: Atualizar `pendencias-conhecidas.md`**

Trocar o parágrafo **"Contas existentes começam sem instância."** por:

```markdown
**Contas existentes começam sem servidor e sem instância.** Depois das
migrações `0003`/`0004`, toda conta tem `evolution_server_id` e
`instance_name` nulos. "Verificar todas" tenta associar sozinho pelo número
do chip contra todas as Evolutions ativas (`acharInstancia`), mas só no
match único. O resto o operador resolve na ficha do aparelho. Enquanto
faltar servidor ou instância, a sincronização fica em "desconhecido".
```

- [ ] **Step 5: Atualizar o spec de 2026-08-25**

Em `docs/superpowers/specs/2026-08-25-evolution-api-integracao-design.md`, no bloco "Cliente Evolution", adicionar no fim:

```markdown
> **Atualizado em 2026-08-29 (múltiplas Evolutions).** As funções não leem
> mais `EVOLUTION_API_URL`/`KEY` — recebem `{ url, apiKey }` do servidor por
> parâmetro. Os servidores vivem na tabela `evolution_server` (tela
> `/servidores`). `listarInstancias` recebe a lista de servidores ativos,
> consulta em paralelo e marca cada instância com `serverId`. Ver
> `docs/superpowers/specs/2026-08-29-multiplas-evolutions-design.md`.
```

- [ ] **Step 6: Commit**

```bash
git add docs/
git commit -m "docs: pendencias e spec da Evolution refletindo multiplos servidores

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**

| Requisito do spec | Task |
|---|---|
| Tabela `evolution_server` (6 colunas, unique url) | 1 |
| `account.evolutionServerId` nullable FK | 1 |
| Migração `0004` gerada, sem backfill | 1 |
| `ServidorEvolution` / `ServidorComId` | 3 |
| `chamarEvolution(servidor, ...)`, remove `baseUrl` | 3 |
| `buscarStatusConexao`/`buscarProxy`/`pedirQrCode` por servidor | 3 |
| `listarInstancias(servidores[])` + `allSettled` + `serverId` | 3 |
| `InstanciaEvolution` ganha `serverId`/`serverNome` | 2, 3 |
| `acharInstancia` → `{serverId, name}`, match único no pool inteiro | 2 |
| `contextoDaConta` (join, null se inativo/incompleto) | 6 |
| `verificarSemRefresh` grava desconhecido sem contexto | 6 |
| `definirInstancia` parseia `"<serverId>::<name>"` | 6 |
| `verificarConexoes` auto-associa servidor+instância | 6 |
| `gerarQrCode` por servidor | 6 |
| `listarServidoresEvolution` + máscara + contagem | 4 |
| `servidoresEvolutionAtivos` | 4 |
| 4 actions de CRUD + validação de URL + mensagem de constraint | 5 |
| `removerServidorEvolution` recusa com conta vinculada | 5 |
| `editarServidorEvolution` mantém key se campo vazio | 5 |
| Tela `/servidores` (lista, form, editar, alternar, remover) | 7 |
| `components/servidor-form.tsx` | 7 |
| Item "Servidores" na sidebar | 7 |
| `/cadastro` dropdown agrupado por servidor, grava os dois | 8 |
| `ativarConta` grava `evolutionServerId` + `instanceName` | 8 |
| `/aparelho/[id]` `DefinirInstancia` multi-servidor + "não encontrada" | 9 |
| `fichaDoAparelho` traz servidor | 9 |
| Testes `acharInstancia` / `listarInstancias` / parser | 2, 3 |
| Smoke test ao vivo | 10 |
| Docs atualizadas | 10 |

Sem lacunas.

**2. Placeholder scan:** o único `COLOQUE_A_KEY_DA_EVOLIDERES` na Task 10 Step 1 é um valor que só o operador tem (segredo real), com instrução explícita do que fazer se não tiver — não é placeholder de lógica. Todos os steps de código têm bloco pronto.

**3. Type consistency:**
- `acharInstancia` devolve `{ serverId: number; name: string } | null` — Task 2 define, Task 6 consome com `achado.serverId` / `achado.name`. ✓
- `InstanciaEvolution.serverId` / `.serverNome` — Task 2 e 3 definem, Tasks 8/9 consomem via `i.serverId` / `i.serverNome`. ✓
- `DefinirInstancia` prop mudou de `instanceAtual: string | null` para `instanciaAtual: { serverId: number; nome: string } | null` — Task 9 define e a página passa consistente. ⚠️ Nome da prop: **`instanciaAtual`** (com "a"), campo interno **`nome`**. Task 9 Step 2 e Step 3 batem.
- Valor do dropdown: `name="instancia"` em Tasks 8 e 9; `definirInstancia` (Task 6) lê `formData.get("instancia")`; `ativarConta` (Task 8) lê `textoOpcional(formData, "instancia")`. ✓ (o form antigo usava `name="instanceName"` / `name="instanceName"` — trocado nas duas telas).
- `contextoDaConta` retorna `{ servidor: ServidorEvolution; instanceName: string }` — Task 6 usa `ctx.servidor` / `ctx.instanceName`. ✓
- `servidoresEvolutionAtivos` → `ServidorComId[]` (`{id, nome, url, apiKey}`) — `listarInstancias` (Task 3) espera exatamente isso. ✓

Consistente.
