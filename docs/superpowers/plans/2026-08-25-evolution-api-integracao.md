# Integração Evolution API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saber, por conta WhatsApp, se está conectada na Evolution API, se o proxy dela está ativo (testado de verdade), e permitir reconectar via QR code — mais duas páginas de listagem (`/aparelhos`, `/chips`) que hoje não existem.

**Architecture:** Três colunas novas em `account` guardam o último status conhecido (sem histórico). A instância na Evolution já existe hoje, criada fora do sistema, nomeada com o número do WhatsApp — `lib/evolution.ts` normaliza `chip.numero` pra bater com esse nome. `lib/evolution-actions.ts` são server actions que resolvem o número, chamam a Evolution, gravam o resultado e disparam `refresh()`, igual ao resto do app. Duas páginas de lista novas (`/aparelhos`, `/chips`, cada uma com "Verificar todas") e um painel de conexão nas fichas existentes (`/aparelho/[id]`, `/chip/[id]`) consomem os dados via `lib/queries.ts`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Drizzle ORM + Postgres, `undici` (`ProxyAgent`) para teste real de conectividade de proxy, `node:test` para os testes.

**Spec:** [docs/superpowers/specs/2026-08-25-evolution-api-integracao-design.md](../specs/2026-08-25-evolution-api-integracao-design.md)

## Global Constraints

- Instância Evolution = `normalizarNumero(chip.numero)` (só dígitos). Instâncias já existem, criadas fora do sistema — o sistema nunca cria (`POST /instance/create`), só lê.
- Credenciais em `.env.local`: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` (nunca commitadas — `.env*` já está no `.gitignore`).
- Verificação é manual (botão individual ou "Verificar todas"), sem cron nem webhook.
- Erro de rede/API nunca lança pra fora de `lib/evolution.ts` — vira `"desconhecido"` ou `"sem_conexao"`, a página nunca quebra.
- Teste de proxy é conectividade real (via `undici.ProxyAgent`) contra a própria `EVOLUTION_API_URL`, não um site externo. Timeout 5s.
- Botões de verificação desabilitam durante o pending — evita clique duplo disparando chamadas concorrentes.
- Mutações usam `refresh()` de `"next/cache"` depois de escrever no banco — é o padrão já usado em `lib/actions.ts`, não `revalidatePath`.
- Português em toda UI, nomes de variáveis e mensagens — igual ao resto do código.

---

## File Structure

- `lib/schema.ts` — modificar: 2 enums novos + 3 colunas em `account`.
- `drizzle/0001_*.sql` — gerado por `drizzle-kit generate`, não escrito à mão.
- `lib/evolution.ts` — novo: `normalizarNumero` + cliente HTTP puro contra a Evolution API.
- `lib/evolution.test.ts` — novo: testes do cliente com `fetch` mockado.
- `lib/evolution-actions.ts` — novo: server actions (`"use server"`) que resolvem o número da conta e gravam no banco.
- `lib/queries.ts` — modificar: `ContaNaLista` ganha os 3 campos de conexão; `listarAparelhosComResumo`, `listarChipsComResumo`; `contadores` ganha `conectadosNaEvolution`.
- `components/conexao-badge.tsx` — novo: badge de status + proxy + "verificado há Xmin" (componente puro, sem `"use client"`).
- `components/verificar-conexao.tsx` — novo: botão client que chama `verificarConexao` (uma conta).
- `components/verificar-todas.tsx` — novo: botão client que chama `verificarConexoes` (lista de contas).
- `components/reconectar-dialog.tsx` — novo: botão + dialog client que chama `gerarQrCode`/`verificarConexao`.
- `components/app-sidebar.tsx` — modificar: itens "Aparelhos" e "Chips".
- `app/aparelhos/page.tsx` — novo: lista de aparelhos.
- `app/chips/page.tsx` — novo: lista de chips.
- `app/page.tsx` — modificar: StatCard "Conectados na Evolution".
- `app/aparelho/[id]/page.tsx` — modificar: painel de conexão por conta.
- `app/chip/[id]/page.tsx` — modificar: painel de conexão da conta vinculada.
- `package.json` — modificar: dependência `undici`, script `test` inclui `lib/evolution.test.ts`.

---

### Task 1: Schema — colunas de status Evolution

**Files:**
- Modify: `lib/schema.ts`
- Create: `drizzle/0001_*.sql` (gerado)

**Interfaces:**
- Produces: `account.evolutionStatus: "desconhecido"|"aberta"|"conectando"|"fechada"`, `account.proxyStatus: "sem_conexao"|"ativa"|"inativa"`, `account.statusVerificadoEm: Date | null` — usados por todas as tasks seguintes.

- [ ] **Step 1: Adicionar os enums e as colunas em `lib/schema.ts`**

Em `lib/schema.ts`, logo depois de `export const warmupTaskStatus = ...` (linha 21), adicionar:

```ts
export const evolutionStatus = pgEnum("evolution_status", [
  "desconhecido",
  "aberta",
  "conectando",
  "fechada",
])
export const proxyStatus = pgEnum("proxy_status", ["sem_conexao", "ativa", "inativa"])
```

Dentro de `export const account = pgTable(...)`, no bloco de colunas (depois de `status: accountStatus("status").notNull().default("ativa"),`), adicionar:

```ts
    evolutionStatus: evolutionStatus("evolution_status").notNull().default("desconhecido"),
    proxyStatus: proxyStatus("proxy_status").notNull().default("sem_conexao"),
    statusVerificadoEm: timestamp("status_verificado_em", { withTimezone: true }),
```

- [ ] **Step 2: Gerar a migração**

Run: `npm run db:generate`

Expected: cria `drizzle/0001_<nome>.sql` com `CREATE TYPE "evolution_status"...`, `CREATE TYPE "proxy_status"...` e `ALTER TABLE "account" ADD COLUMN ...` para as 3 colunas.

- [ ] **Step 3: Conferir a migração gerada**

Leia o arquivo `drizzle/0001_*.sql` gerado e confirme que contém exatamente 2 `CREATE TYPE` e 3 `ADD COLUMN` em `account` — nenhuma outra tabela deve aparecer no diff.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`

Expected: sem erros. `account.$inferSelect` agora inclui os 3 campos novos automaticamente.

- [ ] **Step 5: Commit**

```bash
git add lib/schema.ts drizzle/
git commit -m "feat: colunas de status de conexão Evolution na account"
```

---

### Task 2: Cliente Evolution API (`lib/evolution.ts`)

**Files:**
- Create: `lib/evolution.ts`
- Create: `lib/evolution.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nenhuma (usa `fetch` global e `process.env.EVOLUTION_API_URL`/`EVOLUTION_API_KEY`).
- Produces:
  - `normalizarNumero(numero: string): string`
  - `buscarStatusConexao(instanceName: string): Promise<"aberta"|"conectando"|"fechada"|"desconhecido">`
  - `buscarProxy(instanceName: string): Promise<"sem_conexao"|"ativa"|"inativa">`
  - `pedirQrCode(instanceName: string): Promise<string>` (lança erro se a API não devolver `base64`)

- [ ] **Step 1: Instalar `undici`**

Run: `npm install undici`

- [ ] **Step 2: Escrever os testes de `normalizarNumero` e `buscarStatusConexao` (falhando)**

Create `lib/evolution.test.ts`:

```ts
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"

import {
  buscarProxy,
  buscarStatusConexao,
  normalizarNumero,
  pedirQrCode,
} from "./evolution.ts"

process.env.EVOLUTION_API_URL = "http://evolution.test"
process.env.EVOLUTION_API_KEY = "chave-de-teste"

const fetchOriginal = globalThis.fetch

afterEach(() => {
  globalThis.fetch = fetchOriginal
})

function mockFetch(porCaminho: Record<string, () => Response>) {
  globalThis.fetch = (async (entrada: string | URL) => {
    const caminho = new URL(String(entrada)).pathname
    const resposta = porCaminho[caminho]
    if (!resposta) throw new Error(`Caminho não mockado: ${caminho}`)
    return resposta()
  }) as typeof fetch
}

test("normalizarNumero: remove tudo que não é dígito", () => {
  assert.equal(normalizarNumero("+55 (11) 99999-8888"), "5511999998888")
  assert.equal(normalizarNumero("5511999998888"), "5511999998888")
})

test("buscarStatusConexao: open vira aberta", async () => {
  mockFetch({
    "/instance/connectionState/5511999998888": () =>
      Response.json({ instance: { state: "open" } }),
  })
  assert.equal(await buscarStatusConexao("5511999998888"), "aberta")
})

test("buscarStatusConexao: connecting vira conectando", async () => {
  mockFetch({
    "/instance/connectionState/5511999998888": () =>
      Response.json({ instance: { state: "connecting" } }),
  })
  assert.equal(await buscarStatusConexao("5511999998888"), "conectando")
})

test("buscarStatusConexao: close vira fechada", async () => {
  mockFetch({
    "/instance/connectionState/5511999998888": () =>
      Response.json({ instance: { state: "close" } }),
  })
  assert.equal(await buscarStatusConexao("5511999998888"), "fechada")
})

test("buscarStatusConexao: erro de rede vira desconhecido", async () => {
  globalThis.fetch = (async () => {
    throw new Error("network down")
  }) as typeof fetch
  assert.equal(await buscarStatusConexao("5511999998888"), "desconhecido")
})

test("buscarStatusConexao: resposta sem instance vira desconhecido", async () => {
  mockFetch({ "/instance/connectionState/5511999998888": () => Response.json({}) })
  assert.equal(await buscarStatusConexao("5511999998888"), "desconhecido")
})
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `node --test lib/evolution.test.ts`
Expected: FAIL — `lib/evolution.ts` ainda não existe.

- [ ] **Step 4: Implementar `normalizarNumero`, `chamarEvolution` e `buscarStatusConexao`**

Create `lib/evolution.ts`:

```ts
/** Instância na Evolution é nomeada com o número do WhatsApp, sem formatação.
 * `chip.numero` pode estar salvo com parênteses/traço/DDI — normalizar cobre
 * os dois formatos e sempre compara maçã com maçã contra a Evolution. */
export function normalizarNumero(numero: string): string {
  return numero.replace(/\D/g, "")
}

function baseUrl(): string {
  const url = process.env.EVOLUTION_API_URL
  if (!url) throw new Error("EVOLUTION_API_URL não configurada")
  return url.replace(/\/$/, "")
}

/** Chamada crua contra a Evolution API. Erro de rede ou resposta não-ok vira `null`,
 * nunca lança — quem chama decide o que `null` significa (desconhecido, sem proxy, etc). */
async function chamarEvolution<T>(caminho: string, init?: RequestInit): Promise<T | null> {
  try {
    const resposta = await fetch(`${baseUrl()}${caminho}`, {
      ...init,
      headers: { apikey: process.env.EVOLUTION_API_KEY ?? "", ...init?.headers },
    })
    if (!resposta.ok) return null
    return (await resposta.json()) as T
  } catch {
    return null
  }
}

type ConnectionStateApi = { instance?: { state?: string } }

export async function buscarStatusConexao(
  instanceName: string,
): Promise<"aberta" | "conectando" | "fechada" | "desconhecido"> {
  const dados = await chamarEvolution<ConnectionStateApi>(
    `/instance/connectionState/${instanceName}`,
  )
  const estado = dados?.instance?.state
  if (estado === "open") return "aberta"
  if (estado === "connecting") return "conectando"
  if (estado === "close") return "fechada"
  return "desconhecido"
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `node --test lib/evolution.test.ts`
Expected: os testes de `normalizarNumero` e `buscarStatusConexao` PASS (os de `buscarProxy`/`pedirQrCode` ainda não existem).

- [ ] **Step 6: Escrever os testes de `buscarProxy` (falhando)**

Adicionar em `lib/evolution.test.ts`, depois dos testes de `buscarStatusConexao`. O teste de conectividade agora é contra a própria `EVOLUTION_API_URL` (`http://evolution.test`, pathname `/`), não um site externo:

```ts
test("buscarProxy: sem proxy configurado vira sem_conexao", async () => {
  mockFetch({ "/proxy/find/5511999998888": () => Response.json({ enabled: false }) })
  assert.equal(await buscarProxy("5511999998888"), "sem_conexao")
})

test("buscarProxy: configurado e conectividade ok vira ativa", async () => {
  mockFetch({
    "/proxy/find/5511999998888": () =>
      Response.json({ host: "1.2.3.4", port: 8080, protocol: "http" }),
    "/": () => new Response("ok", { status: 200 }),
  })
  assert.equal(await buscarProxy("5511999998888"), "ativa")
})

test("buscarProxy: configurado mas conectividade falha vira inativa", async () => {
  let chamada = 0
  globalThis.fetch = (async (entrada: string | URL) => {
    const caminho = new URL(String(entrada)).pathname
    chamada++
    if (caminho === "/proxy/find/5511999998888") {
      return Response.json({ host: "1.2.3.4", port: 8080, protocol: "http" })
    }
    throw new Error("proxy indisponível")
  }) as typeof fetch
  assert.equal(await buscarProxy("5511999998888"), "inativa")
  assert.equal(chamada, 2)
})
```

- [ ] **Step 7: Rodar os testes e confirmar que falham**

Run: `node --test lib/evolution.test.ts`
Expected: FAIL — `buscarProxy` não existe.

- [ ] **Step 8: Implementar `buscarProxy`**

Adicionar em `lib/evolution.ts`:

```ts
import { ProxyAgent } from "undici"

type ProxyApi = {
  enabled?: boolean
  host?: string
  port?: number | string
  protocol?: string
  username?: string | null
  password?: string | null
}

/** Testa se o proxy salvo na Evolution de fato funciona: uma requisição de saída
 * de verdade através dele contra a própria Evolution API (não terceiro), com
 * timeout curto pra não travar a UI. */
async function testarProxy(proxy: {
  host: string
  port: string
  protocol: string
  username?: string | null
  password?: string | null
}): Promise<boolean> {
  const auth = proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : ""
  const agente = new ProxyAgent(`${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`)
  try {
    const resposta = await fetch(baseUrl(), {
      dispatcher: agente,
      signal: AbortSignal.timeout(5000),
    } as RequestInit)
    return resposta.ok
  } catch {
    return false
  } finally {
    await agente.close()
  }
}

export async function buscarProxy(
  instanceName: string,
): Promise<"sem_conexao" | "ativa" | "inativa"> {
  const dados = await chamarEvolution<ProxyApi>(`/proxy/find/${instanceName}`)
  if (!dados?.host) return "sem_conexao"

  const funcionou = await testarProxy({
    host: dados.host,
    port: String(dados.port ?? "80"),
    protocol: dados.protocol ?? "http",
    username: dados.username,
    password: dados.password,
  })
  return funcionou ? "ativa" : "inativa"
}
```

- [ ] **Step 9: Rodar os testes e confirmar que passam**

Run: `node --test lib/evolution.test.ts`
Expected: todos os testes de `normalizarNumero`, `buscarStatusConexao` e `buscarProxy` PASS.

- [ ] **Step 10: Escrever os testes de `pedirQrCode` (falhando)**

Adicionar em `lib/evolution.test.ts`:

```ts
test("pedirQrCode: devolve o base64 da resposta", async () => {
  mockFetch({
    "/instance/connect/5511999998888": () =>
      Response.json({ base64: "data:image/png;base64,ABC123" }),
  })
  assert.equal(await pedirQrCode("5511999998888"), "data:image/png;base64,ABC123")
})

test("pedirQrCode: sem base64 na resposta lança erro", async () => {
  mockFetch({ "/instance/connect/5511999998888": () => Response.json({}) })
  await assert.rejects(() => pedirQrCode("5511999998888"), /não retornou QR code/)
})
```

- [ ] **Step 11: Rodar os testes e confirmar que falham**

Run: `node --test lib/evolution.test.ts`
Expected: FAIL — `pedirQrCode` não existe.

- [ ] **Step 12: Implementar `pedirQrCode`**

Adicionar em `lib/evolution.ts`:

```ts
type ConnectApi = { base64?: string }

export async function pedirQrCode(instanceName: string): Promise<string> {
  const dados = await chamarEvolution<ConnectApi>(`/instance/connect/${instanceName}`, {
    method: "POST",
  })
  if (!dados?.base64) throw new Error("Evolution API não retornou QR code.")
  return dados.base64
}
```

- [ ] **Step 13: Atualizar o script de teste em `package.json`**

Em `package.json`, trocar:

```json
    "test": "node --test lib/warmup.test.ts"
```

por:

```json
    "test": "node --test lib/warmup.test.ts lib/evolution.test.ts"
```

- [ ] **Step 14: Rodar a suíte inteira e confirmar que passa**

Run: `npm test`
Expected: todos os testes de `lib/warmup.test.ts` e `lib/evolution.test.ts` PASS.

- [ ] **Step 15: Typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 16: Commit**

```bash
git add lib/evolution.ts lib/evolution.test.ts package.json package-lock.json
git commit -m "feat: cliente Evolution API com teste real de conectividade de proxy"
```

---

### Task 3: Server actions (`lib/evolution-actions.ts`)

**Files:**
- Create: `lib/evolution-actions.ts`

**Interfaces:**
- Consumes: `normalizarNumero`, `buscarStatusConexao`, `buscarProxy`, `pedirQrCode` de `lib/evolution.ts` (Task 2); `account`, `chip` de `lib/schema.ts` (Task 1); `db` de `lib/db.ts`.
- Produces: `verificarConexao(accountId: number): Promise<void>`, `verificarConexoes(accountIds: number[]): Promise<void>`, `gerarQrCode(accountId: number): Promise<string>` — usados pelos componentes client da Task 5.

- [ ] **Step 1: Implementar as actions**

Create `lib/evolution-actions.ts`:

```ts
"use server"

import { eq } from "drizzle-orm"
import { refresh } from "next/cache"

import { db } from "./db.ts"
import { buscarProxy, buscarStatusConexao, normalizarNumero, pedirQrCode } from "./evolution.ts"
import { account, chip } from "./schema.ts"

/** Instância na Evolution é nomeada com o número — nunca com o ID da conta.
 * Toda action que fala com a Evolution passa por aqui pra resolver o nome. */
async function instanceNameDaConta(accountId: number): Promise<string> {
  const [linha] = await db
    .select({ numero: chip.numero })
    .from(account)
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(eq(account.id, accountId))
  if (!linha) throw new Error("Conta não encontrada.")
  return normalizarNumero(linha.numero)
}

async function verificarSemRefresh(accountId: number): Promise<void> {
  const instanceName = await instanceNameDaConta(accountId)
  const [evolutionStatus, proxyStatus] = await Promise.all([
    buscarStatusConexao(instanceName),
    buscarProxy(instanceName),
  ])

  await db
    .update(account)
    .set({ evolutionStatus, proxyStatus, statusVerificadoEm: new Date() })
    .where(eq(account.id, accountId))
}

/** Consulta status + proxy de uma conta e grava o resultado. Sem cron, sem
 * webhook — é sempre um clique do operador que dispara isto. */
export async function verificarConexao(accountId: number): Promise<void> {
  await verificarSemRefresh(accountId)
  refresh()
}

/** Mesma coisa, em lote — base do botão "Verificar todas" das páginas de
 * lista. Um único `refresh()` no final, não um por conta. */
export async function verificarConexoes(accountIds: number[]): Promise<void> {
  await Promise.all(accountIds.map((id) => verificarSemRefresh(id)))
  refresh()
}

/** Só busca o QR code pro dialog — não grava nada. A conexão de fato só é
 * confirmada quando o operador clica "Já escaneei" e `verificarConexao` roda. */
export async function gerarQrCode(accountId: number): Promise<string> {
  const instanceName = await instanceNameDaConta(accountId)
  return pedirQrCode(instanceName)
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/evolution-actions.ts
git commit -m "feat: server actions para verificar conexão (individual e em lote) e gerar QR code"
```

---

### Task 4: Queries — resumo de aparelhos, chips e contador

**Files:**
- Modify: `lib/queries.ts`

**Interfaces:**
- Consumes: `account.evolutionStatus`/`proxyStatus`/`statusVerificadoEm` (Task 1).
- Produces:
  - `ContaNaLista` ganha `evolutionStatus`, `proxyStatus`, `statusVerificadoEm`.
  - `type AparelhoResumo` e `listarAparelhosComResumo(): Promise<AparelhoResumo[]>`
  - `type ChipResumo` e `listarChipsComResumo(): Promise<ChipResumo[]>`
  - `contadores()` ganha o campo `conectadosNaEvolution: number`

- [ ] **Step 1: Adicionar os 3 campos de conexão em `ContaNaLista` e `CAMPOS_DA_CONTA`**

Em `lib/queries.ts`, o tipo `ContaNaLista` (linhas 8-16) passa a ser:

```ts
export type ContaNaLista = {
  id: number
  deviceId: string
  slot: string
  chipId: string
  numero: string
  operadora: string
  ativadaEm: string
  evolutionStatus: "desconhecido" | "aberta" | "conectando" | "fechada"
  proxyStatus: "sem_conexao" | "ativa" | "inativa"
  statusVerificadoEm: Date | null
}
```

E `CAMPOS_DA_CONTA` (linhas 25-33) ganha as 3 colunas:

```ts
const CAMPOS_DA_CONTA = {
  id: account.id,
  deviceId: account.deviceId,
  slot: account.slot,
  chipId: account.chipId,
  numero: chip.numero,
  operadora: chip.operadora,
  ativadaEm: account.ativadaEm,
  evolutionStatus: account.evolutionStatus,
  proxyStatus: account.proxyStatus,
  statusVerificadoEm: account.statusVerificadoEm,
}
```

Isso propaga os 3 campos pra `ContaNaLista`, `ContaComIncidente`, `contasSaudaveis`, `contasComIncidenteAberto` e `fichaDoAparelho` automaticamente — são campos a mais em tipos já usados, sem quebrar nenhum consumidor existente.

- [ ] **Step 2: Adicionar `conectadosNaEvolution` em `contadores()`**

Dentro de `contadores()` (linha ~92), adicionar antes do `return`:

```ts
  const [conectados] = await db
    .select({ n: count() })
    .from(account)
    .where(and(eq(account.status, "ativa"), eq(account.evolutionStatus, "aberta")))
```

E no `return`, adicionar `conectadosNaEvolution: conectados.n,`.

- [ ] **Step 3: Adicionar `listarAparelhosComResumo`**

No final de `lib/queries.ts`, adicionar:

```ts
export type AparelhoResumo = {
  id: string
  apelido: string | null
  status: "ativo" | "quarentena" | "aposentado"
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
export async function listarAparelhosComResumo(): Promise<AparelhoResumo[]> {
  const [devices, contas, abertos, historico] = await Promise.all([
    db.select().from(device).orderBy(asc(device.id)),
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
    totalBans: historico.filter((h) => h.deviceId === d.id && h.tipo === "ban").length,
    contas: contas
      .filter((c) => c.deviceId === d.id)
      .map((c) => ({
        ...c,
        incidenteAberto: abertos.find((a) => a.id === c.id)?.tipo ?? null,
      })),
  }))
}

export type ChipResumo = {
  id: string
  numero: string
  operadora: string
  status: "novo" | "em_uso" | "aposentado"
  local: "pasta" | "gaveta" | "bandeja"
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
export async function listarChipsComResumo(): Promise<ChipResumo[]> {
  const [chips, contas] = await Promise.all([
    db.select().from(chip).orderBy(asc(chip.id)),
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
    local: c.local,
    conta: contas.find((a) => a.chipId === c.id) ?? null,
  }))
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: sem erros. `count`, `and`, `eq`, `asc` já estão importados do `drizzle-orm` no topo do arquivo (usados em outras queries) — nada a acrescentar no import.

- [ ] **Step 5: Commit**

```bash
git add lib/queries.ts
git commit -m "feat: queries de resumo por aparelho e por chip com status de conexão"
```

---

### Task 5: Componentes de UI (badge, botões de verificar, dialog de QR)

**Files:**
- Create: `components/conexao-badge.tsx`
- Create: `components/verificar-conexao.tsx`
- Create: `components/verificar-todas.tsx`
- Create: `components/reconectar-dialog.tsx`

**Interfaces:**
- Consumes: `verificarConexao`, `verificarConexoes`, `gerarQrCode` de `lib/evolution-actions.ts` (Task 3); `tempoDecorrido` de `lib/tempo.ts`; `Button`, `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` de `components/ui/`.
- Produces: `<ConexaoBadge status proxy statusVerificadoEm />`, `<VerificarConexao accountId />`, `<VerificarTodas accountIds />`, `<ReconectarDialog accountId />` — usados nas Tasks 6 e 7.

- [ ] **Step 1: `ConexaoBadge`**

Create `components/conexao-badge.tsx`:

```tsx
import { tempoDecorrido } from "@/lib/tempo"

type Status = "desconhecido" | "aberta" | "conectando" | "fechada"
type Proxy = "sem_conexao" | "ativa" | "inativa"

const STATUS_TEXTO: Record<Status, string> = {
  desconhecido: "Nunca verificado",
  aberta: "Conectado",
  conectando: "Conectando",
  fechada: "Desconectado",
}

const STATUS_COR: Record<Status, string> = {
  desconhecido: "bg-muted text-muted-foreground",
  aberta: "bg-status-ok/10 text-status-ok",
  conectando: "bg-status-restricao/10 text-status-restricao",
  fechada: "bg-status-ban/10 text-status-ban",
}

const PROXY_TEXTO: Record<Proxy, string> = {
  sem_conexao: "sem proxy",
  ativa: "proxy ativo",
  inativa: "proxy inativo",
}

export function ConexaoBadge({
  status,
  proxy,
  statusVerificadoEm,
}: {
  status: Status
  proxy: Proxy
  statusVerificadoEm: Date | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COR[status]}`}
      >
        {STATUS_TEXTO[status]}
      </span>
      <span className="text-muted-foreground text-xs">{PROXY_TEXTO[proxy]}</span>
      {statusVerificadoEm && (
        <span className="text-muted-foreground text-xs tabular-nums">
          verificado há {tempoDecorrido(statusVerificadoEm)}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `VerificarConexao`**

Create `components/verificar-conexao.tsx`:

```tsx
"use client"

import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import { verificarConexao } from "@/lib/evolution-actions"

export function VerificarConexao({ accountId }: { accountId: number }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => verificarConexao(accountId))}
    >
      {pending ? "Verificando…" : "Verificar"}
    </Button>
  )
}
```

- [ ] **Step 3: `VerificarTodas`**

Create `components/verificar-todas.tsx`:

```tsx
"use client"

import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import { verificarConexoes } from "@/lib/evolution-actions"

export function VerificarTodas({ accountIds }: { accountIds: number[] }) {
  const [pending, startTransition] = useTransition()

  if (accountIds.length === 0) return null

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => verificarConexoes(accountIds))}
    >
      {pending ? "Verificando…" : `Verificar todas (${accountIds.length})`}
    </Button>
  )
}
```

- [ ] **Step 4: `ReconectarDialog`**

Create `components/reconectar-dialog.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { gerarQrCode, verificarConexao } from "@/lib/evolution-actions"

export function ReconectarDialog({ accountId }: { accountId: number }) {
  const [aberto, setAberto] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function abrir() {
    setAberto(true)
    setQr(null)
    setErro(null)
    startTransition(async () => {
      try {
        setQr(await gerarQrCode(accountId))
      } catch {
        setErro("Não foi possível gerar o QR code.")
      }
    })
  }

  function jaEscaneei() {
    startTransition(async () => {
      await verificarConexao(accountId)
      setAberto(false)
    })
  }

  return (
    <>
      <Button size="sm" disabled={pending} onClick={abrir}>
        Reconectar
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reconectar conta {accountId}</DialogTitle>
          </DialogHeader>
          {pending && !qr && !erro && (
            <p className="text-muted-foreground text-sm">Gerando QR code…</p>
          )}
          {erro && <p className="text-destructive text-sm">{erro}</p>}
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL, não faz sentido pelo next/image
            <img
              src={qr}
              alt="QR code para reconectar o WhatsApp"
              className="mx-auto size-64"
            />
          )}
          {qr && (
            <Button onClick={jaEscaneei} disabled={pending}>
              Já escaneei, verificar
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 5: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add components/conexao-badge.tsx components/verificar-conexao.tsx components/verificar-todas.tsx components/reconectar-dialog.tsx
git commit -m "feat: badge de conexão, botões de verificar (individual e em lote) e dialog de reconexão por QR code"
```

---

### Task 6: Páginas de lista `/aparelhos` e `/chips` + navegação + painel

**Files:**
- Create: `app/aparelhos/page.tsx`
- Create: `app/chips/page.tsx`
- Modify: `components/app-sidebar.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `listarAparelhosComResumo`, `listarChipsComResumo`, `contadores` (Task 4); `ConexaoBadge`, `VerificarConexao`, `VerificarTodas` (Task 5).

- [ ] **Step 1: `/aparelhos`**

Create `app/aparelhos/page.tsx`:

```tsx
import { Smartphone } from "lucide-react"
import Link from "next/link"

import { ConexaoBadge } from "@/components/conexao-badge"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { StatusBadge, StatusDeCadastro } from "@/components/status-badge"
import { VerificarConexao } from "@/components/verificar-conexao"
import { VerificarTodas } from "@/components/verificar-todas"
import { listarAparelhosComResumo } from "@/lib/queries"
import { NOME_DO_SLOT } from "@/lib/slots"
import { cn, LINK } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function Page() {
  const aparelhos = await listarAparelhosComResumo()
  const todasAsContas = aparelhos.flatMap((a) => a.contas.map((c) => c.id))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Aparelhos"
        subtitulo="Panorama de cada aparelho: contas ativas, conexão e histórico de bans."
        acoes={<VerificarTodas accountIds={todasAsContas} />}
      />

      {aparelhos.length === 0 ? (
        <EmptyState
          Icone={Smartphone}
          titulo="Nenhum aparelho cadastrado"
          descricao="Cadastre um aparelho para começar."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {aparelhos.map((a) => (
            <div
              key={a.id}
              className="bg-card border-border flex flex-col gap-3 rounded-xl border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/aparelho/${a.id}`} className={cn(LINK, "font-medium")}>
                    {a.id}
                  </Link>
                  <div className="text-muted-foreground truncate text-sm">
                    {a.apelido ?? "Sem apelido"}
                  </div>
                </div>
                <StatusDeCadastro valor={a.status} />
              </div>

              <div className="text-muted-foreground text-xs tracking-wide uppercase">
                Bans no histórico:{" "}
                <span className="text-foreground font-medium tabular-nums">{a.totalBans}</span>
              </div>

              {a.contas.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma conta ativa.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {a.contas.map((c) => (
                    <div
                      key={c.id}
                      className="border-border flex flex-col gap-1.5 rounded-lg border p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium tabular-nums">{c.numero}</span>
                        <span className="text-muted-foreground text-xs">
                          {NOME_DO_SLOT[c.slot]}
                        </span>
                      </div>
                      <StatusBadge
                        estado={c.incidenteAberto ? (c.incidenteAberto === "ban" ? "ban" : "restricao") : "ok"}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <ConexaoBadge
                          status={c.evolutionStatus}
                          proxy={c.proxyStatus}
                          statusVerificadoEm={c.statusVerificadoEm}
                        />
                        <VerificarConexao accountId={c.id} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `/chips`**

Create `app/chips/page.tsx`:

```tsx
import { CircuitBoard } from "lucide-react"
import Link from "next/link"

import { ConexaoBadge } from "@/components/conexao-badge"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { StatusDeCadastro } from "@/components/status-badge"
import { VerificarConexao } from "@/components/verificar-conexao"
import { VerificarTodas } from "@/components/verificar-todas"
import { listarChipsComResumo } from "@/lib/queries"
import { NOME_DO_SLOT } from "@/lib/slots"
import { cn, LINK } from "@/lib/utils"

export const dynamic = "force-dynamic"

const LOCAL_TEXTO: Record<string, string> = {
  pasta: "Pasta",
  gaveta: "Gaveta",
  bandeja: "Bandeja",
}

export default async function Page() {
  const chips = await listarChipsComResumo()
  const todasAsContas = chips.flatMap((c) => (c.conta ? [c.conta.id] : []))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Chips"
        subtitulo="Cada chip, o número, onde está guardado e a conexão da conta que ele gerou."
        acoes={<VerificarTodas accountIds={todasAsContas} />}
      />

      {chips.length === 0 ? (
        <EmptyState
          Icone={CircuitBoard}
          titulo="Nenhum chip cadastrado"
          descricao="Cadastre um chip para começar."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {chips.map((c) => (
            <div
              key={c.id}
              className="bg-card border-border flex flex-col gap-2 rounded-xl border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/chip/${c.id}`} className={cn(LINK, "font-medium")}>
                    {c.id}
                  </Link>
                  <div className="text-sm tabular-nums">{c.numero}</div>
                  <div className="text-muted-foreground truncate text-xs">{c.operadora}</div>
                </div>
                <StatusDeCadastro valor={c.status} />
              </div>

              <div className="text-muted-foreground text-xs tracking-wide uppercase">
                {LOCAL_TEXTO[c.local]}
              </div>

              {c.conta ? (
                <div className="border-border flex flex-col gap-1.5 rounded-lg border p-2.5">
                  <div className="text-muted-foreground text-xs">
                    <Link href={`/aparelho/${c.conta.deviceId}`} className={LINK}>
                      {c.conta.deviceId}
                    </Link>{" "}
                    — {NOME_DO_SLOT[c.conta.slot]}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ConexaoBadge
                      status={c.conta.evolutionStatus}
                      proxy={c.conta.proxyStatus}
                      statusVerificadoEm={c.conta.statusVerificadoEm}
                    />
                    <VerificarConexao accountId={c.conta.id} />
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhuma conta vinculada.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Navegação na sidebar**

Em `components/app-sidebar.tsx`, trocar o import do topo:

```ts
import { LayoutDashboard, PlusCircle, Smartphone, Thermometer } from "lucide-react"
```

por (adicionando `CircuitBoard`):

```ts
import { CircuitBoard, LayoutDashboard, PlusCircle, Smartphone, Thermometer } from "lucide-react"
```

E o grupo `"Operação"` em `GRUPOS`, de:

```ts
  {
    rotulo: "Operação",
    itens: [
      { href: "/aquecimento", nome: "Aquecimento", Icone: Thermometer },
      { href: "/cadastro", nome: "Cadastro", Icone: PlusCircle },
    ],
  },
```

para:

```ts
  {
    rotulo: "Operação",
    itens: [
      { href: "/aparelhos", nome: "Aparelhos", Icone: Smartphone },
      { href: "/chips", nome: "Chips", Icone: CircuitBoard },
      { href: "/aquecimento", nome: "Aquecimento", Icone: Thermometer },
      { href: "/cadastro", nome: "Cadastro", Icone: PlusCircle },
    ],
  },
```

- [ ] **Step 4: StatCard no painel**

Em `app/page.tsx`, no import de ícones (linha 1), trocar:

```ts
import { CircuitBoard, Search, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react"
```

por:

```ts
import { CircuitBoard, Search, ShieldAlert, ShieldCheck, Smartphone, Wifi } from "lucide-react"
```

No grid de StatCards, trocar `className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"` por
`className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"`, e adicionar um card depois do `StatCard` de "Chips livres":

```tsx
        <StatCard
          rotulo="Conectados na Evolution"
          valor={numeros.conectadosNaEvolution}
          detalhe="contas com WhatsApp aberto"
          Icone={Wifi}
        />
```

- [ ] **Step 5: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 6: Rodar o app e conferir visualmente**

Run: `npm run dev`, abrir `/`, `/aparelhos`, `/chips` no navegador. Confirmar: sidebar mostra "Aparelhos" e "Chips"; painel mostra o 5º StatCard; as duas páginas novas renderizam sem erro mesmo sem nenhuma conta verificada ainda (tudo "Nunca verificado" / "sem proxy"); "Verificar todas" aparece só quando há pelo menos 1 conta ativa na página.

- [ ] **Step 7: Commit**

```bash
git add app/aparelhos/page.tsx app/chips/page.tsx components/app-sidebar.tsx app/page.tsx
git commit -m "feat: páginas /aparelhos e /chips, navegação e stat card de conexão"
```

---

### Task 7: Painel de conexão nas fichas existentes

**Files:**
- Modify: `app/aparelho/[id]/page.tsx`
- Modify: `app/chip/[id]/page.tsx`

**Interfaces:**
- Consumes: `ConexaoBadge`, `VerificarConexao`, `ReconectarDialog` (Task 5); `fichaDoAparelho`/`fichaDoChip` de `lib/queries.ts` já trazem os 3 campos de conexão (Task 1 adicionou as colunas, Task 4 propagou pelo `ContaNaLista`/`CAMPOS_DA_CONTA`, sem precisar tocar em `fichaDoAparelho`/`fichaDoChip`).

- [ ] **Step 1: Painel de conexão em `/aparelho/[id]`**

Em `app/aparelho/[id]/page.tsx`, adicionar aos imports:

```ts
import { ConexaoBadge } from "@/components/conexao-badge"
import { ReconectarDialog } from "@/components/reconectar-dialog"
import { VerificarConexao } from "@/components/verificar-conexao"
```

No card de cada slot ocupado (dentro do `.map((slot) => { ... })`, no `return` de quando `c` existe), depois do bloco `<div className="mt-auto pt-1">...</div>` (linhas 153-162), adicionar:

```tsx
              <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                <ConexaoBadge
                  status={c.evolutionStatus}
                  proxy={c.proxyStatus}
                  statusVerificadoEm={c.statusVerificadoEm}
                />
                {c.evolutionStatus === "fechada" ? (
                  <ReconectarDialog accountId={c.id} />
                ) : (
                  <VerificarConexao accountId={c.id} />
                )}
              </div>
```

- [ ] **Step 2: Painel de conexão em `/chip/[id]`**

Em `app/chip/[id]/page.tsx`, adicionar aos imports:

```ts
import { ConexaoBadge } from "@/components/conexao-badge"
import { ReconectarDialog } from "@/components/reconectar-dialog"
import { VerificarConexao } from "@/components/verificar-conexao"
```

`fichaDoChip` devolve `conta: (typeof account.$inferSelect) | null` (já inclui os 3 campos novos desde a Task 1, sem mudar `lib/queries.ts` para este caso). Na seção `<div>Conta gerada</div>` (linhas 120-143), depois do bloco condicional `{ficha.conta ? (...) : (...)}`, adicionar um segundo bloco condicional para a conexão, só quando há conta:

```tsx
        {ficha.conta && (
          <div>
            <div className="text-muted-foreground text-xs tracking-wide uppercase">
              Conexão Evolution
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ConexaoBadge
                status={ficha.conta.evolutionStatus}
                proxy={ficha.conta.proxyStatus}
                statusVerificadoEm={ficha.conta.statusVerificadoEm}
              />
              {ficha.conta.evolutionStatus === "fechada" ? (
                <ReconectarDialog accountId={ficha.conta.id} />
              ) : (
                <VerificarConexao accountId={ficha.conta.id} />
              )}
            </div>
          </div>
        )}
```

Esse novo `<div>` fica dentro da mesma `<section>` de "Status"/"Conta gerada" (a `<section className="bg-card border-border flex flex-wrap items-start gap-x-10 gap-y-4 rounded-xl border px-4 py-3 text-sm">`), como um terceiro item irmão dos dois já existentes.

- [ ] **Step 3: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 4: Rodar o app e conferir visualmente**

Run: `npm run dev`, abrir uma ficha de aparelho com conta ativa e a ficha do chip correspondente. Confirmar: badge de conexão aparece nos dois, com "verificado há Xmin" depois do primeiro clique; botão "Verificar" funciona e atualiza o badge; forçar `evolutionStatus = 'fechada'` manualmente no banco (via `psql` ou client) pra conferir que o botão vira "Reconectar" e o dialog abre.

- [ ] **Step 5: Commit**

```bash
git add app/aparelho/[id]/page.tsx app/chip/[id]/page.tsx
git commit -m "feat: painel de conexão e reconexão por QR code nas fichas de aparelho e chip"
```

---

## Depois do plano

Adicionar `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` em `.env.local` (não commitado) antes de testar contra a Evolution API de verdade. Sem isso, `verificarConexao`/`verificarConexoes` gravam `evolutionStatus: "desconhecido"` e `proxyStatus: "sem_conexao"` pra tudo — a UI funciona, mas sempre nesse estado.

Confirmar com dado real se `chip.numero` no banco precisa mesmo de `normalizarNumero` (formatado) ou se já está só com dígitos — não muda o código (a normalização é inofensiva nos dois casos), só o quão necessária ela é.
