# Reativar Chip, Editar Origem, Ativar Conta Sem Colisão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir reativar um chip cancelado, editar a origem de chip/aparelho já cadastrados, e reduzir o formulário "Ativar conta" pra só oferecer aparelho+slot que realmente têm vaga.

**Architecture:** Uma action simples nova (`reativarChip`) no padrão sem-falha-esperada. Duas actions existentes (`editarChip`, `editarAparelho`) ganham um campo a mais no `.set(...)`. Uma query nova (`slotsLivres`) substitui a lista de aparelhos ativos que hoje alimenta dois `<select>` separados por um só, e `ativarConta` passa a decompor um campo `destino` combinado em vez de ler `deviceId`/`slot` direto do formulário.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Drizzle ORM + Postgres.

**Spec:** [docs/superpowers/specs/2026-08-27-reativar-origem-ativar-conta-design.md](../specs/2026-08-27-reativar-origem-ativar-conta-design.md)

## Global Constraints

- `reativarChip` não usa `comMensagem`/`EstadoDoForm` — não há falha esperada, mesmo padrão de `mudarStatusDoAparelho`.
- `editarChip`/`editarAparelho` continuam no padrão `comMensagem`/`EstadoDoForm` que já usam.
- `ativarConta` continua no padrão `comMensagem`/`EstadoDoForm` que já usa — só troca como lê `deviceId`/`slot` do `FormData`.
- Reativar conta não ganha ação própria — o chip liberado por `cancelarConta` (já grava `chip.status = 'novo'`) volta a aparecer em `chipsLivres()` e usa o formulário "Ativar conta" normal.
- Sem JavaScript client-side novo — o select combinado de aparelho+slot resolve a dependência no servidor.
- Português em toda UI, nomes de variáveis e mensagens.
- Sem teste automatizado novo — verificação é `tsc`/`lint`/`build` limpos, os testes existentes continuam passando, checagem visual no navegador.

---

## File Structure

- `lib/actions.ts` — modificar: `editarChip`/`editarAparelho` gravam `origem`; `ativarConta` lê `destino` em vez de `deviceId`+`slot`; nova `reativarChip`.
- `lib/queries.ts` — modificar: nova `slotsLivres()` + `import { SLOTS } from "./slots.ts"`.
- `components/chip-form.tsx` — modificar: `EditarChip` ganha prop/campo `origem`; nova `ReativarChip`.
- `components/aparelho-form.tsx` — modificar: `EditarAparelho` ganha prop/campo `origem`.
- `app/chip/[id]/page.tsx` — modificar: passa `origem` pro `EditarChip`; `ReativarChip` só quando `status === 'aposentado'`, `CancelarChip` só quando não estiver.
- `app/aparelho/[id]/page.tsx` — modificar: passa `origem` pro `EditarAparelho`.
- `app/cadastro/page.tsx` — modificar: select combinado de aparelho+slot no lugar dos dois separados; remove imports que ficam sem uso (`db`, `device`, `asc`, `eq`).

---

### Task 1: Reativar chip

**Files:**
- Modify: `lib/actions.ts`
- Modify: `components/chip-form.tsx`
- Modify: `app/chip/[id]/page.tsx`

**Interfaces:**
- Produces: `reativarChip(formData: FormData): Promise<void>` — `formData`: `chipId`. `<ReativarChip chipId />`.

- [ ] **Step 1: `reativarChip` em `lib/actions.ts`**

No final do arquivo, adicionar:

```ts
export async function reativarChip(formData: FormData) {
  await db
    .update(chip)
    .set({ status: "novo" })
    .where(eq(chip.id, texto(formData, "chipId")))
  refresh()
}
```

- [ ] **Step 2: `ReativarChip` em `components/chip-form.tsx`**

Adicionar ao import do topo: trocar

```ts
import { cancelarChip, editarChip } from "@/lib/actions"
```

por

```ts
import { cancelarChip, editarChip, reativarChip } from "@/lib/actions"
```

No final do arquivo, adicionar:

```tsx
export function ReativarChip({ chipId }: { chipId: string }) {
  return (
    <form action={reativarChip}>
      <input type="hidden" name="chipId" value={chipId} />
      <Button type="submit" size="sm" variant="outline">
        Reativar chip
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Ficha do chip mostra um botão ou outro**

Em `app/chip/[id]/page.tsx`, trocar o import (linha 6):

```ts
import { CancelarChip, EditarChip } from "@/components/chip-form"
```

por:

```ts
import { CancelarChip, EditarChip, ReativarChip } from "@/components/chip-form"
```

E trocar o bloco (linhas 247-253):

```tsx
      <section className="bg-card border-border rounded-xl border p-4">
        <h2 className="mb-3 font-medium">Editar chip</h2>
        <EditarChip chipId={ficha.chip.id} numero={ficha.chip.numero} operadora={ficha.chip.operadora} />
        <div className="mt-4">
          <CancelarChip chipId={ficha.chip.id} />
        </div>
      </section>
```

por:

```tsx
      <section className="bg-card border-border rounded-xl border p-4">
        <h2 className="mb-3 font-medium">Editar chip</h2>
        <EditarChip chipId={ficha.chip.id} numero={ficha.chip.numero} operadora={ficha.chip.operadora} />
        <div className="mt-4">
          {ficha.chip.status === "aposentado" ? (
            <ReativarChip chipId={ficha.chip.id} />
          ) : (
            <CancelarChip chipId={ficha.chip.id} />
          )}
        </div>
      </section>
```

- [ ] **Step 4: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 5: Rodar o app e conferir visualmente**

Run: `npm run dev`. Abrir a ficha de um chip com status `aposentado` (cancele um pra testar, ou force no banco) e confirmar que aparece "Reativar chip" em vez de "Cancelar chip"; clicar e confirmar que o status volta pra "Novo" e o chip aparece de novo no cadastro em "Chip" (`chipsLivres`).

- [ ] **Step 6: Commit**

```bash
git add lib/actions.ts components/chip-form.tsx "app/chip/[id]/page.tsx"
git commit -m "feat: reativar chip cancelado"
```

---

### Task 2: Editar origem

**Files:**
- Modify: `lib/actions.ts`
- Modify: `components/chip-form.tsx`
- Modify: `components/aparelho-form.tsx`
- Modify: `app/chip/[id]/page.tsx`
- Modify: `app/aparelho/[id]/page.tsx`

**Interfaces:**
- Consumes: `device.origem`/`chip.origem` (já existem no schema).
- Produces: `editarChip`/`editarAparelho` passam a exigir `origem` no `FormData`. `<EditarChip origem />`, `<EditarAparelho origem />`.

- [ ] **Step 1: `editarChip` grava `origem`**

Em `lib/actions.ts`, trocar `editarChip` (linhas 315-326):

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
```

por:

```ts
export async function editarChip(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db
      .update(chip)
      .set({
        numero: texto(formData, "numero"),
        operadora: texto(formData, "operadora"),
        origem: texto(formData, "origem") as "propria" | "externa",
      })
      .where(eq(chip.id, texto(formData, "chipId")))
    return { aviso: "Chip atualizado." }
  })
}
```

- [ ] **Step 2: `editarAparelho` grava `origem`**

Trocar `editarAparelho` (linhas 328-342):

```ts
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

por:

```ts
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
        origem: texto(formData, "origem") as "propria" | "externa",
      })
      .where(eq(device.id, texto(formData, "deviceId")))
    return { aviso: "Aparelho atualizado." }
  })
}
```

- [ ] **Step 3: `EditarChip` ganha o campo de origem**

Em `components/chip-form.tsx`, trocar `EditarChip` (linhas 9-39):

```tsx
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
```

por:

```tsx
export function EditarChip({
  chipId,
  numero,
  operadora,
  origem,
}: {
  chipId: string
  numero: string
  operadora: string
  origem: "propria" | "externa"
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
      <div className="grid gap-1.5">
        <Label htmlFor={`ec-origem-${chipId}`}>Origem</Label>
        <select
          id={`ec-origem-${chipId}`}
          name="origem"
          defaultValue={origem}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="propria">Própria</option>
          <option value="externa">Externa</option>
        </select>
      </div>
      <Button type="submit" size="sm" variant="outline" className="self-start">
        Salvar
      </Button>
    </FormAcao>
  )
}
```

- [ ] **Step 4: `EditarAparelho` ganha o campo de origem**

Em `components/aparelho-form.tsx`, trocar `EditarAparelho` (linhas 64-89):

```tsx
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

por:

```tsx
export function EditarAparelho({
  deviceId,
  apelido,
  notas,
  origem,
}: {
  deviceId: string
  apelido: string | null
  notas: string | null
  origem: "propria" | "externa"
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
      <div className="grid gap-1.5">
        <Label htmlFor={`ea-origem-${deviceId}`}>Origem</Label>
        <select
          id={`ea-origem-${deviceId}`}
          name="origem"
          defaultValue={origem}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="propria">Própria</option>
          <option value="externa">Externa</option>
        </select>
      </div>
      <Button type="submit" size="sm" variant="outline" className="self-start">
        Salvar
      </Button>
    </FormAcao>
  )
}
```

- [ ] **Step 5: Passar `origem` nos call sites**

Em `app/chip/[id]/page.tsx` (linha 249), trocar:

```tsx
        <EditarChip chipId={ficha.chip.id} numero={ficha.chip.numero} operadora={ficha.chip.operadora} />
```

por:

```tsx
        <EditarChip
          chipId={ficha.chip.id}
          numero={ficha.chip.numero}
          operadora={ficha.chip.operadora}
          origem={ficha.chip.origem}
        />
```

Em `app/aparelho/[id]/page.tsx` (linhas 122-126), trocar:

```tsx
        <EditarAparelho
          deviceId={ficha.device.id}
          apelido={ficha.device.apelido}
          notas={ficha.device.notas}
        />
```

por:

```tsx
        <EditarAparelho
          deviceId={ficha.device.id}
          apelido={ficha.device.apelido}
          notas={ficha.device.notas}
          origem={ficha.device.origem}
        />
```

- [ ] **Step 6: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 7: Rodar o app e conferir visualmente**

Run: `npm run dev`. Abrir a ficha de um chip e de um aparelho, trocar a origem no formulário de editar, salvar, confirmar que persiste (badge "Externo" aparece/some conforme o valor, inclusive nos filtros de `/aparelhos` e `/chips`).

- [ ] **Step 8: Commit**

```bash
git add lib/actions.ts components/chip-form.tsx components/aparelho-form.tsx "app/chip/[id]/page.tsx" "app/aparelho/[id]/page.tsx"
git commit -m "feat: editar origem de chip e aparelho ja cadastrados"
```

---

### Task 3: Ativar conta sem colisão

**Files:**
- Modify: `lib/queries.ts`
- Modify: `lib/actions.ts`
- Modify: `app/cadastro/page.tsx`

**Interfaces:**
- Produces: `type SlotLivre = {deviceId, apelido, slot}`, `slotsLivres(): Promise<SlotLivre[]>`.
- Consumes/Modifica: `ativarConta` passa a ler `destino` (`"<deviceId>|<slot>"`) em vez de `deviceId`+`slot` separados.

- [ ] **Step 1: `slotsLivres` em `lib/queries.ts`**

No topo do arquivo, trocar:

```ts
import { db } from "./db.ts"
import { account, chip, device, incident, warmupAction, warmupTask } from "./schema.ts"
import type { AcaoCatalogo, ContaParaSorteio, Par } from "./warmup.ts"
```

por:

```ts
import { db } from "./db.ts"
import { account, chip, device, incident, warmupAction, warmupTask } from "./schema.ts"
import { SLOTS } from "./slots.ts"
import type { AcaoCatalogo, ContaParaSorteio, Par } from "./warmup.ts"
```

No final do arquivo, adicionar:

```ts
export type SlotLivre = { deviceId: string; apelido: string | null; slot: string }

/** Toda combinação aparelho+slot sem conta ativa — o que "Ativar conta"
 * pode de fato oferecer. Aparelho com os 3 slots ocupados simplesmente não
 * contribui nenhuma linha, então some da lista sozinho. */
export async function slotsLivres(): Promise<SlotLivre[]> {
  const [devices, ocupados] = await Promise.all([
    db
      .select({ id: device.id, apelido: device.apelido })
      .from(device)
      .where(eq(device.status, "ativo"))
      .orderBy(asc(device.id)),
    db
      .select({ deviceId: account.deviceId, slot: account.slot })
      .from(account)
      .where(eq(account.status, "ativa")),
  ])

  const livres: SlotLivre[] = []
  for (const d of devices) {
    for (const slot of SLOTS) {
      const ocupado = ocupados.some((o) => o.deviceId === d.id && o.slot === slot)
      if (!ocupado) livres.push({ deviceId: d.id, apelido: d.apelido, slot })
    }
  }
  return livres
}
```

- [ ] **Step 2: `ativarConta` lê `destino`**

Em `lib/actions.ts`, trocar `ativarConta` (linhas 112-129):

```ts
export async function ativarConta(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
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
    return { aviso: "Conta ativada." }
  })
}
```

por:

```ts
export async function ativarConta(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    const chipId = texto(formData, "chipId")
    const [deviceId, slot] = texto(formData, "destino").split("|")
    await db.transaction(async (tx) => {
      await tx.insert(account).values({
        deviceId,
        slot: slot as "wa1" | "wa2" | "business",
        chipId,
        ativadaEm: texto(formData, "ativadaEm"),
      })
      await tx.update(chip).set({ status: "em_uso" }).where(eq(chip.id, chipId))
    })
    return { aviso: "Conta ativada." }
  })
}
```

- [ ] **Step 3: `app/cadastro/page.tsx` — select combinado**

No topo do arquivo, trocar:

```ts
import { asc, eq } from "drizzle-orm"

import { FormAcao } from "@/components/form-acao"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ativarConta, criarAparelho, criarChip } from "@/lib/actions"
import { db } from "@/lib/db"
import { chipsLivres } from "@/lib/queries"
import { NOME_DO_SLOT } from "@/lib/slots"
import { device } from "@/lib/schema"
```

por:

```ts
import { FormAcao } from "@/components/form-acao"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ativarConta, criarAparelho, criarChip } from "@/lib/actions"
import { chipsLivres, slotsLivres } from "@/lib/queries"
import { NOME_DO_SLOT } from "@/lib/slots"
```

No corpo de `Page`, trocar:

```ts
export default async function Page() {
  const aparelhos = await db
    .select()
    .from(device)
    .where(eq(device.status, "ativo"))
    .orderBy(asc(device.id))
  const livres = await chipsLivres()
```

por:

```ts
export default async function Page() {
  const slots = await slotsLivres()
  const livres = await chipsLivres()
```

Trocar o bloco dos dois `<select>` de "Aparelho" e "Slot" (linhas 112-139):

```tsx
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
                <option value="wa1">{NOME_DO_SLOT.wa1}</option>
                <option value="wa2">{NOME_DO_SLOT.wa2}</option>
                <option value="business">{NOME_DO_SLOT.business}</option>
              </select>
            </div>
```

por:

```tsx
            <div className="grid gap-1.5">
              <Label htmlFor="co-destino">Aparelho e slot</Label>
              {slots.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nenhuma vaga livre em nenhum aparelho ativo.
                </p>
              ) : (
                <select
                  id="co-destino"
                  name="destino"
                  required
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                >
                  {slots.map((s) => (
                    <option key={`${s.deviceId}|${s.slot}`} value={`${s.deviceId}|${s.slot}`}>
                      {s.deviceId} {s.apelido ? `— ${s.apelido}` : ""} — {NOME_DO_SLOT[s.slot]}
                    </option>
                  ))}
                </select>
              )}
            </div>
```

- [ ] **Step 4: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros. Confirme que `db`/`device`/`asc`/`eq` não sobraram sem uso em `app/cadastro/page.tsx` — se o linter não acusar nada, os imports já saíram certos no Step 3.

- [ ] **Step 5: Rodar o app e conferir visualmente**

Run: `npm run dev`. Abrir `/cadastro`. Confirmar: o select "Aparelho e slot" só lista combinações livres; um aparelho com os 3 slots ocupados não aparece; ativar uma conta usando esse select grava o `deviceId`/`slot` certos (conferir na ficha do aparelho depois). Se possível, ocupar todos os slots de um aparelho de teste e confirmar que ele some do select.

- [ ] **Step 6: Commit**

```bash
git add lib/queries.ts lib/actions.ts app/cadastro/page.tsx
git commit -m "feat: ativar conta so oferece aparelho e slot com vaga"
```

---

### Task 4: Verificação final

**Files:** nenhum (só verificação, sem mudança de código).

**Interfaces:** nenhuma.

- [ ] **Step 1: Build completo**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: sem erros nas 3 etapas.

- [ ] **Step 2: Suíte de testes**

Run: `npm test`
Expected: os 29 testes existentes continuam passando.

- [ ] **Step 3: Checklist visual de ponta a ponta**

Run: `npm run dev`. Sequência: cancelar um chip, reativá-lo pela ficha, confirmar que volta a aparecer em "Ativar conta"; editar a origem de um chip e de um aparelho e confirmar que reflete nos badges/filtros de `/aparelhos` e `/chips`; ativar uma conta pelo select combinado, confirmar que aparelhos lotados não aparecem na lista.

- [ ] **Step 4: Commit final (se sobrar algo solto)**

Se o Step 3 não revelar nada pra corrigir, não há commit aqui. Se revelar um ajuste pequeno, corrigir e commitar isolado com uma mensagem que descreva o ajuste.
