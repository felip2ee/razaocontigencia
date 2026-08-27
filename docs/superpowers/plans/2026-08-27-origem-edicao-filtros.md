# Origem Externa, Edição e Filtros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Marcar aparelho/chip como próprio ou externo (excluindo externos do aquecimento, com contador próprio), permitir corrigir o aparelho de uma conta ativa sem perder histórico, editar chip/aparelho e cancelar chip/conta manualmente, e dar filtro + mais dados visíveis nas listas de aparelhos e chips.

**Architecture:** Dois enums novos (`device_origem`, `chip_origem`) e um campo em cada tabela — sem tabela nova, sem campo em `account` (externalidade é sempre derivada via join). Server actions novas seguem os dois padrões já existentes no arquivo: `comMensagem`/`EstadoDoForm` para o que pode falhar de forma esperada (slot ocupado), ação simples + `refresh()` para o que não falha. Consultas ganham parâmetros de filtro opcionais sem mudar o formato de retorno existente.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Drizzle ORM + Postgres, `node:test` para os testes existentes (nenhum teste novo de UI/schema é esperado neste plano).

**Spec:** [docs/superpowers/specs/2026-08-27-origem-edicao-filtros-design.md](../specs/2026-08-27-origem-edicao-filtros-design.md)

## Global Constraints

- Origem nunca vira campo em `account` — é sempre `device.origem = 'externa' OR chip.origem = 'externa'` calculado no join.
- Cancelamento (chip/aparelho/conta) reaproveita os status terminais que já existem (`aposentado`/`aposentada`) — sem enum novo, sem hard delete.
- Nenhuma mudança em `incident`, `warmup_task`, nem em como o histórico é referenciado por `accountId`.
- Português em toda UI, nomes de variáveis e mensagens — igual ao resto do código.
- Mutações que podem falhar de forma esperada (ex: slot já ocupado) usam o padrão `comMensagem`/`EstadoDoForm` + `FormAcao`, igual a `criarAparelho`/`criarChip`/`ativarConta`. Mutações que não falham de forma esperada usam `<form action={...}>` direto + `refresh()`, igual a `mudarStatusDoAparelho`/`moverChip`/`encerrarIncidente`.
- Sem auto-submit de filtro via JS — formulário GET com botão "Filtrar", mesmo padrão do campo de busca do painel.
- Sem teste automatizado novo de UI/schema — verificação é `tsc`/`lint`/`build` limpos, os 29 testes existentes continuam passando, e checagem visual no navegador.

---

## File Structure

- `lib/schema.ts` — modificar: 2 enums novos (`deviceOrigem`, `chipOrigem`) + 1 coluna em `device` e em `chip`.
- `drizzle/0002_*.sql` — gerado por `drizzle-kit generate`, não escrito à mão.
- `lib/actions.ts` — modificar: `criarAparelho`/`criarChip` gravam `origem`; 5 actions novas (`corrigirAparelho`, `editarChip`, `editarAparelho`, `cancelarChip`, `cancelarConta`).
- `lib/queries.ts` — modificar: `contasParaSorteio` exclui externos; `contadores` ganha `whatsappsExternos`; `AparelhoResumo`/`listarAparelhosComResumo` ganham `origem` do device e filtro opcional; `ChipResumo`/`listarChipsComResumo` ganham `origem`, `posicao` e filtro opcional.
- `components/status-badge.tsx` — modificar: `StatusDeCadastro` ganha prop opcional `colorido`.
- `components/origem-badge.tsx` — novo: pílula "Externo" reutilizável.
- `components/aparelho-form.tsx` — novo: `CorrigirAparelho`, `EditarAparelho`, `CancelarConta`.
- `components/chip-form.tsx` — novo: `EditarChip`, `CancelarChip`.
- `components/filtro-lista.tsx` — novo: formulário GET de status+origem, reusado por `/aparelhos` e `/chips`.
- `app/cadastro/page.tsx` — modificar: `<select name="origem">` nos formulários de aparelho e chip.
- `app/aparelho/[id]/page.tsx` — modificar: badge de origem, `EditarAparelho`, e por conta ativa `CorrigirAparelho` + `CancelarConta`.
- `app/chip/[id]/page.tsx` — modificar: badge de origem, `EditarChip`, `CancelarChip`.
- `app/aparelhos/page.tsx` — modificar: `chipId` visível por conta, badge de origem, `FiltroLista`.
- `app/chips/page.tsx` — modificar: `posicao` visível, `StatusDeCadastro colorido`, badge de origem, `FiltroLista`.
- `app/page.tsx` — modificar: 6º `StatCard` "WhatsApps externos".

---

### Task 1: Schema — origem própria/externa

**Files:**
- Modify: `lib/schema.ts`
- Create: `drizzle/0002_*.sql` (gerado)

**Interfaces:**
- Produces: `device.origem: "propria"|"externa"`, `chip.origem: "propria"|"externa"` — usados por todas as tasks seguintes.

- [ ] **Step 1: Adicionar os enums e as colunas em `lib/schema.ts`**

Depois de `export const proxyStatus = pgEnum("proxy_status", ["sem_conexao", "ativa", "inativa"])` (linha 28), adicionar:

```ts
export const deviceOrigem = pgEnum("device_origem", ["propria", "externa"])
export const chipOrigem = pgEnum("chip_origem", ["propria", "externa"])
```

Dentro de `export const device = pgTable(...)`, depois de `status: deviceStatus("status").notNull().default("ativo"),`, adicionar:

```ts
  origem: deviceOrigem("origem").notNull().default("propria"),
```

Dentro de `export const chip = pgTable(...)`, depois de `status: chipStatus("status").notNull().default("novo"),`, adicionar:

```ts
  origem: chipOrigem("origem").notNull().default("propria"),
```

- [ ] **Step 2: Gerar a migração**

Run: `npm run db:generate`

Expected: cria `drizzle/0002_<nome>.sql` com 2 `CREATE TYPE` e 2 `ALTER TABLE ADD COLUMN` (um em `device`, um em `chip`).

- [ ] **Step 3: Conferir a migração gerada**

Leia o arquivo `drizzle/0002_*.sql` e confirme: exatamente 2 `CREATE TYPE` (`device_origem`, `chip_origem`) e 2 `ADD COLUMN origem` — um em `device`, um em `chip`. Nenhuma outra tabela no diff.

- [ ] **Step 4: Aplicar a migração e typecheck**

Run: `npm run db:migrate && npm run typecheck`
Expected: sem erros. `device.$inferSelect`/`chip.$inferSelect` agora incluem `origem`.

- [ ] **Step 5: Commit**

```bash
git add lib/schema.ts drizzle/
git commit -m "feat: coluna origem (propria/externa) em device e chip"
```

---

### Task 2: Server actions — corrigir, editar, cancelar

**Files:**
- Modify: `lib/actions.ts`

**Interfaces:**
- Consumes: `device.origem`/`chip.origem` (Task 1).
- Produces:
  - `criarAparelho`/`criarChip` passam a gravar `origem`.
  - `corrigirAparelho(estadoAnterior, formData): Promise<EstadoDoForm>` — `formData`: `accountId`, `deviceId`, `slot`.
  - `editarChip(estadoAnterior, formData): Promise<EstadoDoForm>` — `formData`: `chipId`, `numero`, `operadora`.
  - `editarAparelho(estadoAnterior, formData): Promise<EstadoDoForm>` — `formData`: `deviceId`, `apelido`, `notas`.
  - `cancelarChip(formData: FormData): Promise<void>` — `formData`: `chipId`.
  - `cancelarConta(formData: FormData): Promise<void>` — `formData`: `accountId`.
  - Usados pelos componentes das Tasks 4, 5 e 6.

- [ ] **Step 1: `criarAparelho`/`criarChip` gravam `origem`**

Em `lib/actions.ts`, `criarAparelho` (linhas 78-90) passa a:

```ts
export async function criarAparelho(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db.insert(device).values({
      id: texto(formData, "id"),
      apelido: textoOpcional(formData, "apelido"),
      notas: textoOpcional(formData, "notas"),
      origem: texto(formData, "origem") as "propria" | "externa",
    })
    return { aviso: "Aparelho cadastrado." }
  })
}
```

`criarChip` (linhas 92-105) passa a:

```ts
export async function criarChip(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db.insert(chip).values({
      id: texto(formData, "id"),
      operadora: texto(formData, "operadora"),
      numero: texto(formData, "numero"),
      posicao: textoOpcional(formData, "posicao"),
      origem: texto(formData, "origem") as "propria" | "externa",
    })
    return { aviso: "Chip cadastrado." }
  })
}
```

- [ ] **Step 2: `corrigirAparelho`**

No final de `lib/actions.ts`, adicionar:

```ts
/**
 * Corrige o aparelho/slot de uma conta já ativa, sem tocar em chipId,
 * ativadaEm nem no histórico — o histórico é todo por accountId, que não
 * muda. A constraint account_slot_ativo recusa se o destino já estiver
 * ocupado; a mensagem já existe em MENSAGEM_DA_CONSTRAINT.
 */
export async function corrigirAparelho(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db
      .update(account)
      .set({
        deviceId: texto(formData, "deviceId"),
        slot: texto(formData, "slot") as "wa1" | "wa2" | "business",
      })
      .where(eq(account.id, Number(texto(formData, "accountId"))))
    return { aviso: "Aparelho da conta corrigido." }
  })
}
```

- [ ] **Step 3: `editarChip` e `editarAparelho`**

Adicionar:

```ts
export async function editarChip(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db
      .update(chip)
      .set({ numero: texto(formData, "numero"), operadora: texto(formData, "operadora") })
      .where(eq(chip.id, texto(formData, "chipId")))
    return { aviso: "Chip atualizado." }
  })
}

export async function editarAparelho(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db
      .update(device)
      .set({
        apelido: textoOpcional(formData, "apelido"),
        notas: textoOpcional(formData, "notas"),
      })
      .where(eq(device.id, texto(formData, "deviceId")))
    return { aviso: "Aparelho atualizado." }
  })
}
```

- [ ] **Step 4: `cancelarChip` e `cancelarConta`**

Adicionar, no mesmo padrão de `mudarStatusDoAparelho` (ação simples, sem `comMensagem`):

```ts
export async function cancelarChip(formData: FormData) {
  await db
    .update(chip)
    .set({ status: "aposentado" })
    .where(eq(chip.id, texto(formData, "chipId")))
  refresh()
}

export async function cancelarConta(formData: FormData) {
  await db
    .update(account)
    .set({ status: "aposentada" })
    .where(eq(account.id, Number(texto(formData, "accountId"))))
  refresh()
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add lib/actions.ts
git commit -m "feat: actions de corrigir aparelho, editar chip/aparelho e cancelar chip/conta"
```

---

### Task 3: Queries — exclusão do aquecimento, contador e filtros

**Files:**
- Modify: `lib/queries.ts`

**Interfaces:**
- Consumes: `device.origem`/`chip.origem` (Task 1).
- Produces:
  - `contasParaSorteio()` exclui contas externas.
  - `contadores()` ganha `whatsappsExternos: number`.
  - `AparelhoResumo` ganha `origem: "propria" | "externa"`; `listarAparelhosComResumo(filtro?: { status?: string; origem?: string })`.
  - `ChipResumo` ganha `origem: "propria" | "externa"` e `posicao: string | null`; `listarChipsComResumo(filtro?: { status?: string; origem?: string })`.

- [ ] **Step 1: Excluir externos de `contasSaudaveis`/`contasParaSorteio`**

`contasParaSorteio` (linhas 213-239) chama `contasSaudaveis()`, que hoje só faz join com `chip`. Para excluir externos do sorteio sem mudar `contasSaudaveis` (usada também pelo painel, onde externos DEVEM continuar aparecendo), a exclusão entra depois, dentro de `contasParaSorteio`.

Em `lib/queries.ts`, adicionar ao import do topo (linha 5): `device` já está importado — conferir que `device.origem`/`chip.origem` ficam acessíveis. Trocar `contasParaSorteio` (linhas 213-239) por:

```ts
export async function contasParaSorteio(): Promise<ContaParaSorteio[]> {
  const saudaveis = await contasSaudaveis()
  if (saudaveis.length === 0) return []

  const externos = await db
    .select({ id: account.id })
    .from(account)
    .innerJoin(device, eq(device.id, account.deviceId))
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(
      and(
        eq(account.status, "ativa"),
        sql`(${device.origem} = 'externa' or ${chip.origem} = 'externa')`,
      ),
    )
  const idsExternos = new Set(externos.map((e) => e.id))
  const elegiveis = saudaveis.filter((c) => !idsExternos.has(c.id))
  if (elegiveis.length === 0) return []

  const ultimasVoltas = await db
    .select({
      accountId: incident.accountId,
      ultimoFim: max(incident.fim).as("ultimo_fim"),
    })
    .from(incident)
    .where(and(eq(incident.tipo, "restricao"), isNotNull(incident.fim)))
    .groupBy(incident.accountId)

  const MS_POR_DIA = 86_400_000

  return elegiveis.map((c) => {
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
```

- [ ] **Step 2: `contadores()` ganha `whatsappsExternos`**

Em `contadores()` (linhas 98-116), adicionar antes do `return`:

```ts
  const [externos] = await db
    .select({ n: count() })
    .from(account)
    .innerJoin(device, eq(device.id, account.deviceId))
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(
      and(
        eq(account.status, "ativa"),
        sql`(${device.origem} = 'externa' or ${chip.origem} = 'externa')`,
      ),
    )
```

E no `return`, adicionar `whatsappsExternos: externos.n,`.

- [ ] **Step 3: `AparelhoResumo`/`listarAparelhosComResumo` ganham `origem` e filtro**

Trocar o tipo `AparelhoResumo` (linhas 282-297) e `listarAparelhosComResumo` (linhas 301-337) por:

```ts
export type AparelhoResumo = {
  id: string
  apelido: string | null
  status: "ativo" | "quarentena" | "aposentado"
  origem: "propria" | "externa"
  totalBans: number
  contas: {
    id: number
    slot: string
    chipId: string
    numero: string
    incidenteAberto: "restricao" | "ban" | null
    evolutionStatus: "desconhecido" | "aberta" | "conectando" | "fechada"
    proxyStatus: "sem_conexao" | "ativa" | "inativa"
    statusVerificadoEm: Date | null
  }[]
}

/** Um card por aparelho, com as contas ativas nele e o total de bans no
 * histórico — a visão que faltava entre a ficha individual e o painel geral. */
export async function listarAparelhosComResumo(filtro?: {
  status?: string
  origem?: string
}): Promise<AparelhoResumo[]> {
  const condicoesDevice = []
  if (filtro?.status) condicoesDevice.push(eq(device.status, filtro.status as "ativo" | "quarentena" | "aposentado"))
  if (filtro?.origem) condicoesDevice.push(eq(device.origem, filtro.origem as "propria" | "externa"))

  const [devices, contas, abertos, historico] = await Promise.all([
    db
      .select()
      .from(device)
      .where(condicoesDevice.length > 0 ? and(...condicoesDevice) : undefined)
      .orderBy(asc(device.id)),
    db
      .select({
        id: account.id,
        deviceId: account.deviceId,
        slot: account.slot,
        chipId: account.chipId,
        numero: chip.numero,
        evolutionStatus: account.evolutionStatus,
        proxyStatus: account.proxyStatus,
        statusVerificadoEm: account.statusVerificadoEm,
      })
      .from(account)
      .innerJoin(chip, eq(chip.id, account.chipId))
      .where(eq(account.status, "ativa")),
    contasComIncidenteAberto(),
    db
      .select({ deviceId: account.deviceId, tipo: incident.tipo })
      .from(incident)
      .innerJoin(account, eq(account.id, incident.accountId)),
  ])

  return devices.map((d) => ({
    id: d.id,
    apelido: d.apelido,
    status: d.status,
    origem: d.origem,
    totalBans: historico.filter((h) => h.deviceId === d.id && h.tipo === "ban").length,
    contas: contas
      .filter((c) => c.deviceId === d.id)
      .map((c) => ({
        ...c,
        incidenteAberto: abertos.find((a) => a.id === c.id)?.tipo ?? null,
      })),
  }))
}
```

- [ ] **Step 4: `ChipResumo`/`listarChipsComResumo` ganham `origem`, `posicao` e filtro**

Trocar o tipo `ChipResumo` (linhas 339-353) e `listarChipsComResumo` (linhas 356-381) por:

```ts
export type ChipResumo = {
  id: string
  numero: string
  operadora: string
  status: "novo" | "em_uso" | "aposentado"
  origem: "propria" | "externa"
  local: "pasta" | "gaveta" | "bandeja"
  posicao: string | null
  conta: {
    id: number
    deviceId: string
    slot: string
    evolutionStatus: "desconhecido" | "aberta" | "conectando" | "fechada"
    proxyStatus: "sem_conexao" | "ativa" | "inativa"
    statusVerificadoEm: Date | null
  } | null
}

/** Um card por chip, com a conta que ele gerou (se houver) e a conexão dela. */
export async function listarChipsComResumo(filtro?: {
  status?: string
  origem?: string
}): Promise<ChipResumo[]> {
  const condicoesChip = []
  if (filtro?.status) condicoesChip.push(eq(chip.status, filtro.status as "novo" | "em_uso" | "aposentado"))
  if (filtro?.origem) condicoesChip.push(eq(chip.origem, filtro.origem as "propria" | "externa"))

  const [chips, contas] = await Promise.all([
    db
      .select()
      .from(chip)
      .where(condicoesChip.length > 0 ? and(...condicoesChip) : undefined)
      .orderBy(asc(chip.id)),
    db
      .select({
        id: account.id,
        chipId: account.chipId,
        deviceId: account.deviceId,
        slot: account.slot,
        evolutionStatus: account.evolutionStatus,
        proxyStatus: account.proxyStatus,
        statusVerificadoEm: account.statusVerificadoEm,
      })
      .from(account)
      .where(eq(account.status, "ativa")),
  ])

  return chips.map((c) => ({
    id: c.id,
    numero: c.numero,
    operadora: c.operadora,
    status: c.status,
    origem: c.origem,
    local: c.local,
    posicao: c.posicao,
    conta: contas.find((a) => a.chipId === c.id) ?? null,
  }))
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sem erros. `and`, `eq`, `count`, `sql`, `asc` já estão importados no topo do arquivo.

- [ ] **Step 6: Commit**

```bash
git add lib/queries.ts
git commit -m "feat: exclusao de externos do aquecimento, contador e filtros de aparelhos/chips"
```

---

### Task 4: Cadastro — origem no formulário

**Files:**
- Modify: `app/cadastro/page.tsx`

**Interfaces:**
- Consumes: `criarAparelho`/`criarChip` exigindo `origem` no `FormData` (Task 2).

- [ ] **Step 1: `<select name="origem">` no formulário de aparelho**

Em `app/cadastro/page.tsx`, dentro do `FormAcao acao={criarAparelho}` (linhas 39-53), depois do campo `ap-notas` e antes do botão `Cadastrar aparelho`, adicionar:

```tsx
            <div className="grid gap-1.5">
              <Label htmlFor="ap-origem">Origem</Label>
              <select
                id="ap-origem"
                name="origem"
                defaultValue="propria"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="propria">Própria</option>
                <option value="externa">Externa (alugado/emprestado)</option>
              </select>
            </div>
```

- [ ] **Step 2: `<select name="origem">` no formulário de chip**

Dentro do `FormAcao acao={criarChip}` (linhas 61-79), depois do campo `ch-posicao` e antes do botão `Cadastrar chip`, adicionar o mesmo bloco (trocando `ap-origem`/`id`/`htmlFor` por `ch-origem`):

```tsx
            <div className="grid gap-1.5">
              <Label htmlFor="ch-origem">Origem</Label>
              <select
                id="ch-origem"
                name="origem"
                defaultValue="propria"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="propria">Própria</option>
                <option value="externa">Externa (alugado/emprestado)</option>
              </select>
            </div>
```

- [ ] **Step 3: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 4: Rodar o app e conferir visualmente**

Run: `npm run dev`. Abrir `/cadastro`, cadastrar um aparelho e um chip com origem "Externa" e confirmar que salva (conferir na ficha ou no banco).

- [ ] **Step 5: Commit**

```bash
git add app/cadastro/page.tsx
git commit -m "feat: campo de origem no cadastro de aparelho e chip"
```

---

### Task 5: Componentes de ação (badge de origem, corrigir, editar, cancelar)

**Files:**
- Create: `components/origem-badge.tsx`
- Create: `components/aparelho-form.tsx`
- Create: `components/chip-form.tsx`
- Modify: `components/status-badge.tsx`

**Interfaces:**
- Consumes: `corrigirAparelho`, `editarChip`, `editarAparelho`, `cancelarChip`, `cancelarConta` de `lib/actions.ts` (Task 2); `FormAcao` de `components/form-acao.tsx`; `Button`, `Input`, `Label` de `components/ui/`.
- Produces: `<OrigemBadge origem="propria"|"externa" />`, `<CorrigirAparelho accountId aparelhos={{id,apelido}[]} slotAtual />`, `<EditarAparelho deviceId apelido notas />`, `<CancelarConta accountId />`, `<EditarChip chipId numero operadora />`, `<CancelarChip chipId />`, `<StatusDeCadastro valor colorido? />` — usados pelas Tasks 6, 7, 8, 9.

- [ ] **Step 1: `OrigemBadge`**

Create `components/origem-badge.tsx`:

```tsx
export function OrigemBadge({ origem }: { origem: "propria" | "externa" }) {
  if (origem !== "externa") return null
  return (
    <span className="border-border text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
      Externo
    </span>
  )
}
```

- [ ] **Step 2: `StatusDeCadastro` ganha `colorido`**

Em `components/status-badge.tsx`, trocar o comentário acima de `CICLO` (linhas 33-38) por:

```ts
/**
 * Ciclo de vida do aparelho e do chip. Mesma pílula do StatusBadge. Por
 * padrão fica neutra de propósito — cor de status é reservada para saúde da
 * conta, e "quarentena" não é irmã de "restrição". A prop `colorido` existe
 * só para o painel de chips, onde a cor ajuda a achar um chip rápido.
 */
```

E trocar `StatusDeCadastro` (linhas 55-63) por:

```ts
const CICLO_COR: Record<string, string> = {
  novo: "bg-status-ok/10 text-status-ok",
  em_uso: "bg-status-restricao/10 text-status-restricao",
  aposentado: "bg-muted text-muted-foreground",
  ativo: "bg-status-ok/10 text-status-ok",
  quarentena: "bg-status-restricao/10 text-status-restricao",
}

export function StatusDeCadastro({
  valor,
  colorido,
}: {
  valor: string
  colorido?: boolean
}) {
  const Icone = CICLO_ICONE[valor] ?? Circle
  return (
    <span
      className={`${PILULA} ${colorido ? (CICLO_COR[valor] ?? "bg-muted text-foreground") : "bg-muted text-foreground"}`}
    >
      <Icone className="size-3" aria-hidden="true" />
      {CICLO[valor] ?? valor}
    </span>
  )
}
```

- [ ] **Step 3: `CorrigirAparelho` e `EditarAparelho`**

Create `components/aparelho-form.tsx`:

```tsx
"use client"

import { FormAcao } from "@/components/form-acao"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cancelarConta, corrigirAparelho, editarAparelho } from "@/lib/actions"
import { NOME_DO_SLOT } from "@/lib/slots"

export function CorrigirAparelho({
  accountId,
  aparelhos,
  slotAtual,
}: {
  accountId: number
  aparelhos: { id: string; apelido: string | null }[]
  slotAtual: string
}) {
  return (
    <FormAcao acao={corrigirAparelho} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <select
        name="deviceId"
        className="border-input bg-background h-8 rounded-md border px-2 text-sm"
        aria-label="Aparelho correto"
      >
        {aparelhos.map((a) => (
          <option key={a.id} value={a.id}>
            {a.id} {a.apelido ? `— ${a.apelido}` : ""}
          </option>
        ))}
      </select>
      <select
        name="slot"
        defaultValue={slotAtual}
        className="border-input bg-background h-8 rounded-md border px-2 text-sm"
        aria-label="Slot correto"
      >
        <option value="wa1">{NOME_DO_SLOT.wa1}</option>
        <option value="wa2">{NOME_DO_SLOT.wa2}</option>
        <option value="business">{NOME_DO_SLOT.business}</option>
      </select>
      <Button type="submit" size="sm" variant="outline">
        Corrigir aparelho
      </Button>
    </FormAcao>
  )
}

export function CancelarConta({ accountId }: { accountId: number }) {
  return (
    <form action={cancelarConta}>
      <input type="hidden" name="accountId" value={accountId} />
      <Button type="submit" size="sm" variant="outline">
        Cancelar conta
      </Button>
    </form>
  )
}

export function EditarAparelho({
  deviceId,
  apelido,
  notas,
}: {
  deviceId: string
  apelido: string | null
  notas: string | null
}) {
  return (
    <FormAcao acao={editarAparelho} className="flex flex-col gap-3">
      <input type="hidden" name="deviceId" value={deviceId} />
      <div className="grid gap-1.5">
        <Label htmlFor={`ea-apelido-${deviceId}`}>Apelido</Label>
        <Input id={`ea-apelido-${deviceId}`} name="apelido" defaultValue={apelido ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`ea-notas-${deviceId}`}>Notas</Label>
        <Input id={`ea-notas-${deviceId}`} name="notas" defaultValue={notas ?? ""} />
      </div>
      <Button type="submit" size="sm" variant="outline" className="self-start">
        Salvar
      </Button>
    </FormAcao>
  )
}
```

- [ ] **Step 4: `EditarChip` e `CancelarChip`**

Create `components/chip-form.tsx`:

```tsx
"use client"

import { FormAcao } from "@/components/form-acao"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cancelarChip, editarChip } from "@/lib/actions"

export function EditarChip({
  chipId,
  numero,
  operadora,
}: {
  chipId: string
  numero: string
  operadora: string
}) {
  return (
    <FormAcao acao={editarChip} className="flex flex-col gap-3">
      <input type="hidden" name="chipId" value={chipId} />
      <div className="grid gap-1.5">
        <Label htmlFor={`ec-numero-${chipId}`}>Número</Label>
        <Input id={`ec-numero-${chipId}`} name="numero" defaultValue={numero} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`ec-operadora-${chipId}`}>Operadora</Label>
        <Input
          id={`ec-operadora-${chipId}`}
          name="operadora"
          defaultValue={operadora}
          required
        />
      </div>
      <Button type="submit" size="sm" variant="outline" className="self-start">
        Salvar
      </Button>
    </FormAcao>
  )
}

export function CancelarChip({ chipId }: { chipId: string }) {
  return (
    <form action={cancelarChip}>
      <input type="hidden" name="chipId" value={chipId} />
      <Button type="submit" size="sm" variant="outline">
        Cancelar chip
      </Button>
    </form>
  )
}
```

- [ ] **Step 5: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add components/origem-badge.tsx components/aparelho-form.tsx components/chip-form.tsx components/status-badge.tsx
git commit -m "feat: componentes de badge de origem, corrigir aparelho, editar e cancelar"
```

---

### Task 6: Ficha do aparelho — corrigir, editar, cancelar, badge

**Files:**
- Modify: `app/aparelho/[id]/page.tsx`

**Interfaces:**
- Consumes: `OrigemBadge`, `CorrigirAparelho`, `CancelarConta`, `EditarAparelho` (Task 5); `fichaDoAparelho` já traz `device.origem` (Task 1 adicionou a coluna, `fichaDoAparelho` seleciona `device` inteiro via `db.select().from(device)`, sem precisar tocar em `lib/queries.ts`).

- [ ] **Step 1: Lista de aparelhos ativos para o destino de `CorrigirAparelho`**

Em `app/aparelho/[id]/page.tsx`, adicionar aos imports:

```ts
import { asc, eq } from "drizzle-orm"

import { CancelarConta, CorrigirAparelho, EditarAparelho } from "@/components/aparelho-form"
import { OrigemBadge } from "@/components/origem-badge"
import { db } from "@/lib/db"
import { device } from "@/lib/schema"
```

No corpo de `Page`, depois de `if (!ficha) notFound()` (linha 33), adicionar:

```ts
  const aparelhos = await db
    .select({ id: device.id, apelido: device.apelido })
    .from(device)
    .where(eq(device.status, "ativo"))
    .orderBy(asc(device.id))
```

- [ ] **Step 2: Badge de origem no `PageHeader`**

No bloco de informações do aparelho (linhas 62-96), depois do bloco `Status` (linhas 63-70), adicionar:

```tsx
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Origem
          </div>
          <div className="mt-0.5">
            <OrigemBadge origem={ficha.device.origem} />
            {ficha.device.origem === "propria" && (
              <span className="text-muted-foreground text-sm">Própria</span>
            )}
          </div>
        </div>
```

- [ ] **Step 3: `EditarAparelho` na tela**

Depois do bloco de informações do aparelho (fechamento da `div` da linha 96) e antes do grid de slots (linha 100), adicionar:

```tsx
      <section className="bg-card border-border rounded-xl border p-4">
        <h2 className="mb-3 font-medium">Editar aparelho</h2>
        <EditarAparelho
          deviceId={ficha.device.id}
          apelido={ficha.device.apelido}
          notas={ficha.device.notas}
        />
      </section>
```

- [ ] **Step 4: `CorrigirAparelho` e `CancelarConta` por conta ativa**

No card de cada slot ocupado (dentro do `.map((slot) => { ... })`, no `return` de quando `c` existe), depois do bloco `<div className="border-border flex flex-wrap items-center justify-between gap-2 border-t pt-2">...ConexaoBadge...</div>` (linhas 166-177), adicionar:

```tsx
              <div className="border-border flex flex-wrap items-center gap-2 border-t pt-2">
                <CorrigirAparelho
                  accountId={c.id}
                  aparelhos={aparelhos}
                  slotAtual={c.slot}
                />
                <CancelarConta accountId={c.id} />
              </div>
```

- [ ] **Step 5: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 6: Rodar o app e conferir visualmente**

Run: `npm run dev`. Abrir uma ficha de aparelho com conta ativa. Confirmar: badge de origem aparece; formulário "Editar aparelho" salva apelido/notas; "Corrigir aparelho" muda o aparelho/slot da conta (testar escolhendo um slot livre em outro aparelho, depois conferir que a conta sumiu do aparelho antigo e apareceu no novo com o mesmo `accountId`/histórico); "Cancelar conta" muda o status pra aposentada e a conta some do card.

- [ ] **Step 7: Commit**

```bash
git add "app/aparelho/[id]/page.tsx"
git commit -m "feat: corrigir aparelho, editar e cancelar conta na ficha do aparelho"
```

---

### Task 7: Ficha do chip — editar, cancelar, badge

**Files:**
- Modify: `app/chip/[id]/page.tsx`

**Interfaces:**
- Consumes: `OrigemBadge`, `EditarChip`, `CancelarChip` (Task 5); `fichaDoChip` já traz `chip.origem` (Task 1 adicionou a coluna, `fichaDoChip` seleciona `chip` inteiro via `db.select().from(chip)`, sem precisar tocar em `lib/queries.ts`).

- [ ] **Step 1: Adicionar aos imports**

```ts
import { CancelarChip, EditarChip } from "@/components/chip-form"
import { OrigemBadge } from "@/components/origem-badge"
```

- [ ] **Step 2: Badge de origem**

Na seção de status (linhas 114-166), depois do bloco `Status` (linhas 115-122), adicionar:

```tsx
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Origem
          </div>
          <div className="mt-1">
            <OrigemBadge origem={ficha.chip.origem} />
            {ficha.chip.origem === "propria" && (
              <span className="text-muted-foreground text-sm">Própria</span>
            )}
          </div>
        </div>
```

- [ ] **Step 3: `EditarChip` e `CancelarChip`**

Depois da seção `<section>` de "Mover" (fechamento na linha 232) e antes do fechamento do componente (linha 233), adicionar:

```tsx
      <section className="bg-card border-border rounded-xl border p-4">
        <h2 className="mb-3 font-medium">Editar chip</h2>
        <EditarChip chipId={ficha.chip.id} numero={ficha.chip.numero} operadora={ficha.chip.operadora} />
        <div className="mt-4">
          <CancelarChip chipId={ficha.chip.id} />
        </div>
      </section>
```

- [ ] **Step 4: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 5: Rodar o app e conferir visualmente**

Run: `npm run dev`. Abrir a ficha de um chip. Confirmar: badge de origem aparece; "Editar chip" salva número/operadora novos; "Cancelar chip" muda status pra aposentado.

- [ ] **Step 6: Commit**

```bash
git add "app/chip/[id]/page.tsx"
git commit -m "feat: editar e cancelar chip na ficha do chip"
```

---

### Task 8: Filtro de lista (componente compartilhado)

**Files:**
- Create: `components/filtro-lista.tsx`

**Interfaces:**
- Consumes: nenhuma.
- Produces: `<FiltroLista statusOpcoes={{valor,rotulo}[]} statusAtual origemAtual />` — GET form com `name="status"` e `name="origem"`, usado pelas Tasks 9 e 10.

- [ ] **Step 1: `FiltroLista`**

Create `components/filtro-lista.tsx`:

```tsx
export function FiltroLista({
  statusOpcoes,
  statusAtual,
  origemAtual,
}: {
  statusOpcoes: { valor: string; rotulo: string }[]
  statusAtual?: string
  origemAtual?: string
}) {
  return (
    <form className="flex flex-wrap items-center gap-2">
      <select
        name="status"
        defaultValue={statusAtual ?? ""}
        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        aria-label="Filtrar por status"
      >
        <option value="">Todos os status</option>
        {statusOpcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      <select
        name="origem"
        defaultValue={origemAtual ?? ""}
        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        aria-label="Filtrar por origem"
      >
        <option value="">Toda origem</option>
        <option value="propria">Própria</option>
        <option value="externa">Externa</option>
      </select>
      <button
        type="submit"
        className="border-input bg-background hover:bg-accent h-9 rounded-md border px-3 text-sm"
      >
        Filtrar
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/filtro-lista.tsx
git commit -m "feat: componente de filtro por status e origem"
```

---

### Task 9: `/aparelhos` — filtro, chipId visível, badge de origem

**Files:**
- Modify: `app/aparelhos/page.tsx`

**Interfaces:**
- Consumes: `FiltroLista` (Task 8); `OrigemBadge` (Task 5); `listarAparelhosComResumo(filtro?)` já aceita `{status?, origem?}` (Task 3).

- [ ] **Step 1: Ler `searchParams` e passar o filtro pra query**

Em `app/aparelhos/page.tsx`, trocar a assinatura de `Page` e a chamada de `listarAparelhosComResumo` (linhas 16-18):

```tsx
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const status = typeof params.status === "string" && params.status !== "" ? params.status : undefined
  const origem = typeof params.origem === "string" && params.origem !== "" ? params.origem : undefined

  const aparelhos = await listarAparelhosComResumo({ status, origem })
  const todasAsContas = aparelhos.flatMap((a) => a.contas.map((c) => c.id))
```

- [ ] **Step 2: Adicionar `FiltroLista` e `OrigemBadge` aos imports**

```ts
import { FiltroLista } from "@/components/filtro-lista"
import { OrigemBadge } from "@/components/origem-badge"
```

- [ ] **Step 3: Renderizar o filtro**

Depois do `<PageHeader ... />` (linhas 22-26) e antes do bloco `{aparelhos.length === 0 ? (` (linha 28), adicionar:

```tsx
      <FiltroLista
        statusOpcoes={[
          { valor: "ativo", rotulo: "Ativo" },
          { valor: "quarentena", rotulo: "Quarentena" },
          { valor: "aposentado", rotulo: "Aposentado" },
        ]}
        statusAtual={status}
        origemAtual={origem}
      />
```

- [ ] **Step 4: Badge de origem e `chipId` visível**

No cabeçalho do card do aparelho (linhas 42-52), depois de `<StatusDeCadastro valor={a.status} />`, adicionar `<OrigemBadge origem={a.origem} />`.

Na linha do número da conta (linhas 68-73), depois de `<span className="text-sm font-medium tabular-nums">{c.numero}</span>`, adicionar:

```tsx
                        <span className="text-muted-foreground text-xs">{c.chipId}</span>
```

- [ ] **Step 5: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 6: Rodar o app e conferir visualmente**

Run: `npm run dev`. Abrir `/aparelhos`. Confirmar: `chipId` aparece ao lado do número em cada conta; badge "Externo" aparece nos aparelhos marcados; filtro por status e origem funciona (muda a URL com `?status=...&origem=...` e a lista reflete).

- [ ] **Step 7: Commit**

```bash
git add app/aparelhos/page.tsx
git commit -m "feat: filtro, chipId visivel e badge de origem em /aparelhos"
```

---

### Task 10: `/chips` — filtro, posição visível, cor por status, badge de origem

**Files:**
- Modify: `app/chips/page.tsx`

**Interfaces:**
- Consumes: `FiltroLista` (Task 8); `OrigemBadge` (Task 5); `StatusDeCadastro` com `colorido` (Task 5); `listarChipsComResumo(filtro?)` já aceita `{status?, origem?}` e devolve `posicao`/`origem` (Task 3).

- [ ] **Step 1: Ler `searchParams` e passar o filtro pra query**

Trocar a assinatura de `Page` e a chamada de `listarChipsComResumo` (linhas 22-24):

```tsx
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const status = typeof params.status === "string" && params.status !== "" ? params.status : undefined
  const origem = typeof params.origem === "string" && params.origem !== "" ? params.origem : undefined

  const chips = await listarChipsComResumo({ status, origem })
  const todasAsContas = chips.flatMap((c) => (c.conta ? [c.conta.id] : []))
```

- [ ] **Step 2: Adicionar `FiltroLista` e `OrigemBadge` aos imports**

```ts
import { FiltroLista } from "@/components/filtro-lista"
import { OrigemBadge } from "@/components/origem-badge"
```

- [ ] **Step 3: Renderizar o filtro**

Depois do `<PageHeader ... />` (linhas 28-32) e antes do bloco `{chips.length === 0 ? (` (linha 34), adicionar:

```tsx
      <FiltroLista
        statusOpcoes={[
          { valor: "novo", rotulo: "Novo" },
          { valor: "em_uso", rotulo: "Em uso" },
          { valor: "aposentado", rotulo: "Aposentado" },
        ]}
        statusAtual={status}
        origemAtual={origem}
      />
```

- [ ] **Step 4: `colorido`, badge de origem e posição visível**

No cabeçalho do card do chip (linhas 48-57), trocar `<StatusDeCadastro valor={c.status} />` por `<StatusDeCadastro valor={c.status} colorido />`, e adicionar `<OrigemBadge origem={c.origem} />` logo depois.

Na linha do local (linhas 59-61), quando `c.local === "pasta"` e `c.posicao` existir, mostrar a posição junto:

```tsx
              <div className="text-muted-foreground text-xs tracking-wide uppercase">
                {LOCAL_TEXTO[c.local]}
                {c.local === "pasta" && c.posicao && (
                  <span className="text-foreground normal-case"> — {c.posicao}</span>
                )}
              </div>
```

- [ ] **Step 5: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 6: Rodar o app e conferir visualmente**

Run: `npm run dev`. Abrir `/chips`. Confirmar: badge de status colorida por ciclo (novo/em_uso/aposentado); badge "Externo" nos chips marcados; posição da pasta aparece direto no card quando o chip está na pasta e tem posição anotada; filtro por status e origem funciona.

- [ ] **Step 7: Commit**

```bash
git add app/chips/page.tsx
git commit -m "feat: filtro, posicao visivel, cor por status e badge de origem em /chips"
```

---

### Task 11: Painel — contador de WhatsApps externos

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `contadores()` já devolve `whatsappsExternos` (Task 3).

- [ ] **Step 1: Adicionar o ícone ao import**

Trocar (linha 1):

```ts
import { CircuitBoard, Search, ShieldAlert, ShieldCheck, Smartphone, Wifi } from "lucide-react"
```

por:

```ts
import { CircuitBoard, Globe, Search, ShieldAlert, ShieldCheck, Smartphone, Wifi } from "lucide-react"
```

- [ ] **Step 2: Grid ganha o 6º card**

Trocar `className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"` (linha 57) por
`className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"`, e adicionar um `StatCard` depois do de "Conectados na Evolution" (linhas 82-87):

```tsx
        <StatCard
          rotulo="WhatsApps externos"
          valor={numeros.whatsappsExternos}
          detalhe="fora do aquecimento"
          Icone={Globe}
        />
```

- [ ] **Step 3: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 4: Rodar o app e conferir visualmente**

Run: `npm run dev`. Abrir `/`. Confirmar: 6º StatCard aparece com a contagem certa de contas externas ativas.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: stat card de WhatsApps externos no painel"
```

---

### Task 12: Verificação final

**Files:** nenhum (só verificação, sem mudança de código).

**Interfaces:** nenhuma.

- [ ] **Step 1: Build completo**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: sem erros nas 3 etapas.

- [ ] **Step 2: Suíte de testes**

Run: `npm test`
Expected: os 29 testes existentes continuam passando — nenhum deles cobre este plano, mas confirma que nada quebrou por acidente.

- [ ] **Step 3: Checklist visual completo (fluxo de ponta a ponta)**

Run: `npm run dev`. Sequência: cadastrar um aparelho e um chip externos em `/cadastro`; ativar uma conta com o chip errado num aparelho; corrigir o aparelho da conta pela ficha (Task 6) e confirmar que o histórico de aquecimento/incidentes continua o mesmo `accountId`; gerar aquecimento do dia e confirmar que a conta externa não aparece nas tarefas sorteadas; conferir o contador "WhatsApps externos" no painel; editar número/operadora de um chip e apelido/notas de um aparelho; cancelar um chip e uma conta e confirmar que saem das listas ativas; filtrar `/aparelhos` e `/chips` por status e origem.

- [ ] **Step 4: Commit final (se sobrar algo solto)**

Se o Step 3 não revelar nada pra corrigir, não há commit aqui. Se revelar um ajuste pequeno, corrigir no componente/arquivo relevante e commitar isolado com uma mensagem que descreva o ajuste.
