# Reorganização das telas de aparelho e chip — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a ficha do aparelho e a ficha do chip responderem "quais chips este aparelho tem" e "em qual aparelho este chip está", e transformar todo formulário cru empilhado em botão nomeado que abre janela com título e explicação.

**Architecture:** Um catálogo de vocabulário em `lib/acoes.ts` passa a ser a única fonte dos nomes e das frases de cada operação. Um componente `DialogAcao` faz botão + janela + `useActionState` + erro dentro da janela + fechar no sucesso. Três arquivos em `components/acoes/` expõem cada ação como componente pronto, reusados sem duplicação por ficha do aparelho, ficha do chip e painel — é isso que faz restrição e ban existirem nas duas fichas.

**Tech Stack:** Next.js 16 App Router (server components + server actions), React 19 (`useActionState`), Drizzle ORM sobre Postgres, Tailwind v4, `@base-ui/react` (Dialog já embrulhado em `components/ui/dialog.tsx`), `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-04-organizacao-aparelho-chip-design.md`

## Global Constraints

- Todo texto de interface em português do Brasil. Nomes de variáveis, funções e tipos também são em português, seguindo o código existente (`fichaDoAparelho`, `contasSaudaveis`, `tempoDecorrido`).
- Nenhuma dependência nova. `@base-ui/react`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge` e `drizzle-orm` já estão no `package.json` e cobrem tudo neste plano.
- Todo rótulo de botão e toda frase de explicação vêm de `ACOES` em `lib/acoes.ts`. String literal de rótulo dentro de componente de tela é defeito.
- Toda action hospedada em janela tem a assinatura `(estado: EstadoDoForm, formData: FormData) => Promise<EstadoDoForm>` e roda dentro de `comMensagem`. Action que lança erro estoura a página inteira e é justamente o que este trabalho remove.
- O Postgres local está fora do ar nesta máquina. Nenhuma tarefa depende de rodar o banco. Verificação de cada tarefa é `npx tsc --noEmit`, `npm run lint`, `npm test` e `npx next build`. O roteiro manual de banco está no fim do plano.
- `npx tsc --noEmit` precisa de `rm -rf .next` antes quando a rota anterior foi removida ou renomeada, senão o typecheck reclama de tipos gerados obsoletos.
- Imports com extensão `.ts` dentro de `lib/` (`from "./schema.ts"`), sem extensão nos aliases `@/` (`from "@/components/ui/button"`). Siga o arquivo vizinho.
- `SLOTS`, `NOME_DO_SLOT` e `tipoDoSlot` vêm de `lib/slots.ts`. Não redeclarar slot em lugar nenhum.
- Prettier roda com `prettier-plugin-tailwindcss`. Rode `npm run format` antes de commitar se o lint reclamar de ordem de classe.

---

## Estrutura de arquivos

**Criar:**

| Arquivo | Responsabilidade |
|---|---|
| `lib/acoes.ts` | Catálogo de vocabulário: chave → rótulo do botão + frase da janela. Dado puro, sem React. |
| `lib/acoes.test.ts` | Garante que toda chave tem rótulo e frase, e que nenhum rótulo se repete. |
| `components/dialog-acao.tsx` | Botão + janela + formulário + erro + fechar no sucesso. Um componente, usado por todas as ações. |
| `components/acoes/conta.tsx` | Ações que agem sobre uma conta de WhatsApp. Usado pelas duas fichas e pelo painel. |
| `components/acoes/aparelho.tsx` | Ações que agem sobre o aparelho. |
| `components/acoes/chip.tsx` | Ações que agem sobre o chip. |

**Modificar:**

| Arquivo | O que muda |
|---|---|
| `lib/actions.ts` | `EstadoDoForm` ganha `ok`; `comMensagem` marca sucesso; cinco actions viram assinatura de formulário; `moverChip` libera a bandeja antes de ocupar. |
| `lib/evolution-actions.ts` | `definirInstancia` vira assinatura de formulário. |
| `lib/queries.ts` | `fichaDoChip` cresce; nasce `chipsParaBandeja`. |
| `app/aparelho/[id]/page.tsx` | Reescrita: dois blocos e cartões com no máximo três botões. |
| `app/chip/[id]/page.tsx` | Reescrita: bloco "Conta de WhatsApp" com as ações de queda. |
| `app/cadastro/page.tsx` | Sai o cartão "Ativar conta". |
| `app/page.tsx` | Passa a usar `components/acoes/conta.tsx`. |
| `app/chips/page.tsx` | Visão em blocos passa a mostrar aparelho e slot. |
| `package.json` | `test` inclui `lib/acoes.test.ts`. |

**Apagar:** `components/aparelho-form.tsx`, `components/chip-form.tsx`, `components/incident-form.tsx`.

---

### Task 1: Catálogo de vocabulário

**Files:**
- Create: `lib/acoes.ts`
- Test: `lib/acoes.test.ts`
- Modify: `package.json` (linha do script `test`)

**Interfaces:**
- Consumes: nada.
- Produces: `type ChaveDeAcao`, `type Acao = { rotulo: string; frase: string }`, `const ACOES: Record<ChaveDeAcao, Acao>`. Toda tarefa seguinte lê rótulo e frase daqui.

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/acoes.test.ts`:

```ts
import { strict as assert } from "node:assert"
import { test } from "node:test"

import { ACOES } from "./acoes.ts"

test("toda ação tem rótulo e frase preenchidos", () => {
  for (const [chave, acao] of Object.entries(ACOES)) {
    assert.ok(acao.rotulo.trim().length > 0, `${chave} está sem rótulo`)
    assert.ok(acao.frase.trim().length > 0, `${chave} está sem frase`)
  }
})

test("nenhum rótulo se repete entre ações", () => {
  const vistos = new Map<string, string>()
  for (const [chave, acao] of Object.entries(ACOES)) {
    const anterior = vistos.get(acao.rotulo)
    assert.equal(
      anterior,
      undefined,
      `"${acao.rotulo}" aparece em ${chave} e em ${anterior}`,
    )
    vistos.set(acao.rotulo, chave)
  }
})

test("as chaves que as telas usam existem", () => {
  for (const chave of [
    "registrar-queda",
    "voltou-ao-ar",
    "ban-recuperado",
    "ban-perdido",
    "ativar-conta",
    "trocar-chip-bandeja",
    "mover-chip",
  ] as const) {
    assert.ok(chave in ACOES, `falta a chave ${chave}`)
  }
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test lib/acoes.test.ts
```

Esperado: FAIL com `Cannot find module './acoes.ts'`.

- [ ] **Step 3: Criar o catálogo**

Criar `lib/acoes.ts`:

```ts
/**
 * O nome e a explicação de cada operação, num lugar só.
 *
 * Duas telas mostrando a mesma operação com nomes diferentes é o defeito que
 * este arquivo existe para impedir: "Voltou", "Análise devolveu", "Perdido" e
 * "Corrigir aparelho" eram rótulos que não diziam ao operador o que faziam, e
 * mudavam de tela para tela.
 */
export type ChaveDeAcao =
  | "registrar-queda"
  | "restricao"
  | "ban"
  | "voltou-ao-ar"
  | "ban-recuperado"
  | "ban-perdido"
  | "verificar-conexao"
  | "reconectar"
  | "associar-instancia"
  | "corrigir-cadastro"
  | "encerrar-conta"
  | "ativar-conta"
  | "editar-aparelho"
  | "mudar-situacao"
  | "trocar-chip-bandeja"
  | "editar-chip"
  | "mover-chip"
  | "aposentar-chip"
  | "reativar-chip"

export type Acao = {
  /** Texto do botão. Curto, verbo primeiro. */
  rotulo: string
  /** Uma frase dizendo o que a operação faz. Aparece dentro da janela. */
  frase: string
}

export const ACOES: Record<ChaveDeAcao, Acao> = {
  "registrar-queda": {
    rotulo: "Registrar queda",
    frase: "O número caiu. Escolha se foi restrição ou ban.",
  },
  restricao: {
    rotulo: "Restrição",
    frase:
      "Parou de mandar mensagem mas não foi banido. Sai do aquecimento até você marcar que voltou.",
  },
  ban: {
    rotulo: "Ban",
    frase:
      "O número foi banido. Vai para análise, e você marca depois se recuperou ou perdeu.",
  },
  "voltou-ao-ar": {
    rotulo: "Voltou ao ar",
    frase: "A restrição acabou e o número está mandando mensagem de novo.",
  },
  "ban-recuperado": {
    rotulo: "Número recuperado",
    frase: "A análise devolveu o número. A conta volta ao aquecimento.",
  },
  "ban-perdido": {
    rotulo: "Número perdido",
    frase:
      "A análise não devolveu. A conta e o chip são aposentados e o slot fica livre.",
  },
  "verificar-conexao": {
    rotulo: "Verificar conexão",
    frase: "Pergunta à Evolution se o WhatsApp desta conta está aberto.",
  },
  reconectar: {
    rotulo: "Reconectar",
    frase: "Gera o QR code para reconectar o WhatsApp desta conta.",
  },
  "associar-instancia": {
    rotulo: "Associar instância",
    frase:
      "Diz qual instância da Evolution corresponde a esta conta. Sem isso a verificação não sabe onde olhar.",
  },
  "corrigir-cadastro": {
    rotulo: "Corrigir cadastro",
    frase:
      "A conta foi cadastrada no aparelho ou no slot errado. Move o registro, não o chip.",
  },
  "encerrar-conta": {
    rotulo: "Encerrar conta",
    frase:
      "O WhatsApp deste slot não existe mais. Libera o slot e devolve o chip para a pasta.",
  },
  "ativar-conta": {
    rotulo: "Ativar conta",
    frase: "Um chip livre vira WhatsApp neste slot.",
  },
  "editar-aparelho": {
    rotulo: "Editar aparelho",
    frase: "Apelido, origem e notas do aparelho.",
  },
  "mudar-situacao": {
    rotulo: "Mudar situação",
    frase:
      "Ativo, em quarentena ou aposentado. Aparelho fora de ativo não recebe conta nova.",
  },
  "trocar-chip-bandeja": {
    rotulo: "Trocar chip da bandeja",
    frase:
      "O chip de internet 4G que fica na bandeja deste aparelho. Não é WhatsApp.",
  },
  "editar-chip": {
    rotulo: "Editar chip",
    frase: "Número, operadora e origem do chip.",
  },
  "mover-chip": {
    rotulo: "Mover chip",
    frase: "Onde o chip está guardado: pasta, gaveta ou bandeja de um aparelho.",
  },
  "aposentar-chip": {
    rotulo: "Aposentar chip",
    frase: "O chip não serve mais. Sai da lista de chips livres.",
  },
  "reativar-chip": {
    rotulo: "Reativar chip",
    frase: "Volta um chip aposentado para a pasta, disponível de novo.",
  },
}
```

- [ ] **Step 4: Incluir no script de teste**

Em `package.json`, trocar a linha do script `test` por:

```json
    "test": "node --test lib/warmup.test.ts lib/evolution.test.ts lib/acoes.test.ts"
```

- [ ] **Step 5: Rodar e ver passar**

```bash
npm test
```

Esperado: PASS, 38 testes (35 de antes + 3 novos), 0 falhas.

- [ ] **Step 6: Commit**

```bash
git add lib/acoes.ts lib/acoes.test.ts package.json
git commit -m "feat: catalogo de vocabulario das acoes"
```

---

### Task 2: Estado de sucesso e actions com assinatura de formulário

**Files:**
- Modify: `lib/actions.ts`
- Modify: `lib/evolution-actions.ts`
- Modify: `components/incident-form.tsx`, `components/aparelho-form.tsx`, `components/chip-form.tsx` (adaptação mecânica, estes arquivos morrem na Task 10)

**Interfaces:**
- Consumes: nada da Task 1.
- Produces: `EstadoDoForm = { erro?: string; aviso?: string; ok?: true } | null`. Sucesso sempre traz `ok: true`. As actions `encerrarIncidente`, `resolverBan`, `mudarStatusDoAparelho`, `moverChip`, `cancelarConta`, `reativarChip` e `definirInstancia` passam a ter a assinatura `(estado: EstadoDoForm, formData: FormData) => Promise<EstadoDoForm>`. `corrigirAparelho`, `editarChip`, `editarAparelho`, `cancelarChip`, `criarAparelho`, `criarChip`, `ativarConta`, `registrarIncidente` já têm essa assinatura e não mudam de forma.

- [ ] **Step 1: Marcar sucesso no estado**

Em `lib/actions.ts`, trocar o tipo e o `comMensagem`:

```ts
/**
 * O que uma action devolve para o formulário, via `useActionState`.
 *
 * `ok` existe porque a janela precisa saber que deu certo para se fechar
 * sozinha. Antes, sucesso sem aviso e "ainda não enviei" eram os dois `null`,
 * e a janela não tinha como distinguir um do outro.
 */
export type EstadoDoForm = { erro?: string; aviso?: string; ok?: true } | null
```

E dentro de `comMensagem`, trocar `return estado ?? null` por:

```ts
    return { ...(estado ?? {}), ok: true as const }
```

- [ ] **Step 2: Converter as actions que hoje não devolvem estado**

Em `lib/actions.ts`, substituir as cinco funções abaixo. Cada uma perde o `refresh()` no corpo, porque `comMensagem` já chama `refresh()` no sucesso.

```ts
/** Restrição acabou: carimba o fim. A duração é sempre calculada, nunca digitada. */
export async function encerrarIncidente(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db
      .update(incident)
      .set({ fim: new Date() })
      .where(
        and(eq(incident.id, Number(texto(formData, "incidentId"))), isNull(incident.fim)),
      )
  })
}

/**
 * Resultado da análise de um ban. Se o número foi perdido, a conta é aposentada
 * e o chip também, liberando o slot para um chip novo.
 */
export async function resolverBan(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    const incidentId = Number(texto(formData, "incidentId"))
    const resultado = texto(formData, "resultado") as "recuperada" | "perdida"

    await db.transaction(async (tx) => {
      const [oIncidente] = await tx
        .update(incident)
        .set({ resultado, fim: new Date() })
        .where(and(eq(incident.id, incidentId), isNull(incident.fim)))
        .returning({ accountId: incident.accountId })

      // Já encerrado por outro clique: nada a fazer, e a tela recarregada mostra
      // a situação real. Sem linha não há accountId, e seguir estouraria aqui.
      if (!oIncidente) return

      if (resultado === "perdida") {
        const [aConta] = await tx
          .update(account)
          .set({ status: "aposentada" })
          .where(eq(account.id, oIncidente.accountId))
          .returning({ chipId: account.chipId })
        await tx.update(chip).set({ status: "aposentado" }).where(eq(chip.id, aConta.chipId))
      }
    })
  })
}

export async function mudarStatusDoAparelho(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db
      .update(device)
      .set({ status: texto(formData, "status") as "ativo" | "quarentena" | "aposentado" })
      .where(eq(device.id, texto(formData, "deviceId")))
    return { aviso: "Situação do aparelho alterada." }
  })
}

export async function cancelarConta(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    const accountId = Number(texto(formData, "accountId"))
    await db.transaction(async (tx) => {
      const [conta] = await tx
        .update(account)
        .set({ status: "aposentada" })
        .where(eq(account.id, accountId))
        .returning({ chipId: account.chipId })
      if (conta) {
        await tx.update(chip).set({ status: "novo" }).where(eq(chip.id, conta.chipId))
      }
    })
    return { aviso: "Conta encerrada. O slot está livre." }
  })
}

export async function reativarChip(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db
      .update(chip)
      .set({ status: "novo" })
      .where(eq(chip.id, texto(formData, "chipId")))
    return { aviso: "Chip reativado." }
  })
}
```

- [ ] **Step 3: Converter `moverChip` e fazer a bandeja aceitar um chip só**

Ainda em `lib/actions.ts`, substituir `moverChip` inteira:

```ts
/**
 * Move o chip entre pasta, gaveta e bandeja de um aparelho. Os campos que não
 * pertencem ao destino são zerados para o registro não mentir sobre onde o
 * chip está.
 *
 * Bandeja é física: cabe um chip. Antes de ocupar, o chip que estava lá volta
 * para a pasta — senão dois chips ficam apontando para a mesma bandeja e
 * `fichaDoAparelho` mostra o primeiro que o banco devolver, em silêncio.
 */
export async function moverChip(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    const chipId = texto(formData, "chipId")
    const local = texto(formData, "local") as "pasta" | "gaveta" | "bandeja"
    const deviceId = textoOpcional(formData, "bandejaDeviceId")

    if (local === "bandeja" && !deviceId) {
      throw new ErroDeValidacao("Escolha o aparelho da bandeja.")
    }

    await db.transaction(async (tx) => {
      if (local === "bandeja" && deviceId) {
        await tx
          .update(chip)
          .set({ local: "pasta", bandejaDeviceId: null })
          .where(
            and(
              eq(chip.local, "bandeja"),
              eq(chip.bandejaDeviceId, deviceId),
              ne(chip.id, chipId),
            ),
          )
      }

      await tx
        .update(chip)
        .set({
          local,
          bandejaDeviceId: local === "bandeja" ? deviceId : null,
          posicao: local === "pasta" ? textoOpcional(formData, "posicao") : null,
        })
        .where(eq(chip.id, chipId))
    })

    return { aviso: "Chip movido." }
  })
}
```

Acrescentar `ne` ao import do drizzle no topo do arquivo:

```ts
import { and, eq, isNull, ne, sql } from "drizzle-orm"
```

- [ ] **Step 4: Converter `definirInstancia`**

Em `lib/evolution-actions.ts`, trocar a assinatura de `definirInstancia`. O corpo atual, que lê `accountId` e `instancia` do `formData`, valida o servidor e chama `verificarSemRefresh`, é preservado — só passa a devolver estado em vez de chamar `refresh()` no fim.

```ts
import type { EstadoDoForm } from "./actions.ts"

export async function definirInstancia(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  // ...corpo atual, sem a chamada final a refresh()...
  return { aviso: "Instância associada." }
}
```

Se `lib/evolution-actions.ts` não tiver um equivalente a `comMensagem`, envolver o corpo em `try/catch` e devolver `{ erro: "Não foi possível associar a instância." }` no catch, mais `refresh()` antes do `return` de sucesso — este arquivo não importa os helpers privados de `lib/actions.ts`.

- [ ] **Step 5: Ajustar os call sites existentes para o build continuar de pé**

Os três componentes abaixo usam `<form action={fn}>` com actions que agora exigem dois argumentos. Trocar por `FormAcao`, que já existe e já passa os dois. Mudança mecânica, sem redesenho — estes arquivos são apagados na Task 10.

- `components/incident-form.tsx`: os três `<form action={encerrarIncidente}>` e `<form action={resolverBan}>` viram `<FormAcao acao={...}>`.
- `components/aparelho-form.tsx`: `<form action={definirInstancia}>` e `<form action={cancelarConta}>` viram `<FormAcao acao={...}>`.
- `components/chip-form.tsx`: `<form action={reativarChip}>` vira `<FormAcao acao={reativarChip}>`.
- `app/aparelho/[id]/page.tsx`: o `<form action={mudarStatusDoAparelho}>` do cabeçalho vira `<FormAcao acao={mudarStatusDoAparelho}>`; acrescentar `import { FormAcao } from "@/components/form-acao"`.
- `app/chip/[id]/page.tsx`: o `<form action={moverChip}>` vira `<FormAcao acao={moverChip}>`; acrescentar o mesmo import.

`FormAcao` é client component e as páginas são server components; passar uma server action como prop `acao` funciona e já é o padrão usado em `/cadastro`.

- [ ] **Step 6: Verificar**

```bash
rm -rf .next && npx tsc --noEmit && npm run lint && npm test && npx next build
```

Esperado: typecheck sem erro, lint limpo, 38 testes passando, build concluído.

- [ ] **Step 7: Commit**

```bash
git add lib/actions.ts lib/evolution-actions.ts components/incident-form.tsx components/aparelho-form.tsx components/chip-form.tsx app/aparelho app/chip
git commit -m "refactor: actions de janela devolvem estado de sucesso"
```

---

### Task 3: O componente de janela

**Files:**
- Create: `components/dialog-acao.tsx`

**Interfaces:**
- Consumes: `EstadoDoForm` de `lib/actions.ts` (Task 2), com `ok`.
- Produces: `<DialogAcao rotulo titulo descricao confirmar? acao variant? size? className? children? />`. Todas as tarefas seguintes montam ações em cima dele.

- [ ] **Step 1: Escrever o componente**

Criar `components/dialog-acao.tsx`:

```tsx
"use client"

import { useActionState, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { EstadoDoForm } from "@/lib/actions"

/**
 * Botão nomeado que abre uma janela explicada.
 *
 * Antes, cada operação era um `<select>` e um botão soltos no meio do cartão,
 * sem nada dizendo o que aquilo fazia. Aqui o operador lê o título e a frase
 * antes de confirmar, e o erro do banco aparece dentro da janela em vez de
 * derrubar a página.
 *
 * Sem `children` visíveis (só inputs escondidos) vira janela de confirmação.
 */
export function DialogAcao({
  rotulo,
  titulo,
  descricao,
  confirmar = "Confirmar",
  acao,
  variant = "outline",
  size = "sm",
  className,
  children,
}: {
  rotulo: string
  titulo: string
  descricao: string
  confirmar?: string
  acao: (estado: EstadoDoForm, formData: FormData) => Promise<EstadoDoForm>
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost"
  size?: "default" | "sm" | "xs" | "lg"
  className?: string
  children?: React.ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const formulario = useRef<HTMLFormElement>(null)
  const ultimoEnvio = useRef<FormData | null>(null)

  const [estado, enviar, pendente] = useActionState(
    async (anterior: EstadoDoForm, formData: FormData) => {
      ultimoEnvio.current = formData
      return acao(anterior, formData)
    },
    null,
  )

  // Fecha só quando a action confirmou sucesso. É para isto que `ok` existe:
  // sucesso sem aviso e "ainda não enviei" eram os dois `null`.
  useEffect(() => {
    if (estado?.ok) setAberto(false)
  }, [estado])

  // Deu erro: devolve o que foi digitado. O React limpa o formulário depois da
  // action, e aqui se digita código de fita à mão.
  useEffect(() => {
    if (!estado?.erro || !formulario.current || !ultimoEnvio.current) return
    for (const [nome, valor] of ultimoEnvio.current.entries()) {
      const campo = formulario.current.elements.namedItem(nome)
      if (typeof valor === "string" && campo && "value" in campo) {
        campo.value = valor
      }
    }
  }, [estado])

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setAberto(true)}
      >
        {rotulo}
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>{descricao}</DialogDescription>
          </DialogHeader>
          <form ref={formulario} action={enviar} className="flex flex-col gap-3">
            {children}
            {estado?.erro && (
              <p role="alert" className="text-destructive text-sm">
                {estado.erro}
              </p>
            )}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={pendente}>
                {pendente ? "Salvando…" : confirmar}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Verificar**

```bash
npx tsc --noEmit && npm run lint
```

Esperado: sem erro. Se o TypeScript reclamar da prop `render` de `DialogClose`, conferir a assinatura em `components/ui/dialog.tsx` — `ReconectarDialog` já usa `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` e é a referência de uso correto no projeto.

- [ ] **Step 3: Commit**

```bash
git add components/dialog-acao.tsx
git commit -m "feat: componente de janela de acao"
```

---

### Task 4: Ações da conta

**Files:**
- Create: `components/acoes/conta.tsx`

**Interfaces:**
- Consumes: `ACOES` (Task 1); actions `registrarIncidente`, `encerrarIncidente`, `resolverBan`, `corrigirAparelho`, `cancelarConta`, `ativarConta` de `lib/actions.ts` e `definirInstancia` de `lib/evolution-actions.ts` (Task 2); `DialogAcao` (Task 3); `InstanciaEvolution` de `lib/evolution.ts`; `SlotLivre` de `lib/queries.ts`.
- Produces:
  - `<RegistrarQueda accountId={number} />`
  - `<VoltouAoAr incidentId={number} />`
  - `<ResolverBan incidentId={number} />`
  - `<AtivarConta rotulo={string} destino={{deviceId,slot}|{opcoes:SlotLivre[]}} chip={{id,numero,operadora}|{opcoes:ChipLivre[]}} instancias servidores falharam />`
  - `<MaisAcoesDaConta conta={ContaParaAcoes} aparelhos instancias servidores falharam />`
  - `type ContaParaAcoes`, `type ChipLivre`

- [ ] **Step 1: Escrever o arquivo**

Criar `components/acoes/conta.tsx`:

```tsx
"use client"

import { DialogAcao } from "@/components/dialog-acao"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ACOES } from "@/lib/acoes"
import {
  ativarConta,
  cancelarConta,
  corrigirAparelho,
  encerrarIncidente,
  registrarIncidente,
  resolverBan,
} from "@/lib/actions"
import type { InstanciaEvolution } from "@/lib/evolution"
import { definirInstancia } from "@/lib/evolution-actions"
import type { SlotLivre } from "@/lib/queries"
import { NOME_DO_SLOT, SLOTS } from "@/lib/slots"

export type ContaParaAcoes = {
  id: number
  deviceId: string
  slot: string
  instanceName: string | null
  evolutionServerId: number | null
}

export type ChipLivre = { id: string; numero: string; operadora: string }

const CAMPO =
  "border-input bg-background h-9 rounded-md border px-3 text-sm"

/**
 * `datetime-local` quer "2026-09-04T14:30" no fuso local, não ISO em UTC.
 * Fica dentro de um componente próprio porque só é chamado quando a janela
 * abre: calculado durante o render da página, o valor divergiria entre
 * servidor e cliente e o React acusaria hidratação errada.
 */
function CampoQuando() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  const agora = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="rq-inicio">Quando caiu</Label>
      <Input
        id="rq-inicio"
        name="inicio"
        type="datetime-local"
        defaultValue={agora}
        required
      />
    </div>
  )
}

function EscolhaDeTipo() {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-sm font-medium">O que aconteceu</legend>
      {(["restricao", "ban"] as const).map((chave, i) => (
        <label
          key={chave}
          className="border-border hover:bg-muted/50 flex cursor-pointer gap-2.5 rounded-lg border p-2.5"
        >
          <input
            type="radio"
            name="tipo"
            value={chave}
            defaultChecked={i === 0}
            className="mt-1 shrink-0"
          />
          <span>
            <span className="block font-medium">{ACOES[chave].rotulo}</span>
            <span className="text-muted-foreground text-xs">{ACOES[chave].frase}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

export function RegistrarQueda({ accountId }: { accountId: number }) {
  return (
    <DialogAcao
      rotulo={ACOES["registrar-queda"].rotulo}
      titulo={ACOES["registrar-queda"].rotulo}
      descricao={ACOES["registrar-queda"].frase}
      confirmar="Registrar"
      acao={registrarIncidente}
    >
      <input type="hidden" name="accountId" value={accountId} />
      <EscolhaDeTipo />
      <CampoQuando />
    </DialogAcao>
  )
}

export function VoltouAoAr({ incidentId }: { incidentId: number }) {
  return (
    <DialogAcao
      rotulo={ACOES["voltou-ao-ar"].rotulo}
      titulo={ACOES["voltou-ao-ar"].rotulo}
      descricao={ACOES["voltou-ao-ar"].frase}
      confirmar="Marcar que voltou"
      acao={encerrarIncidente}
      variant="default"
    >
      <input type="hidden" name="incidentId" value={incidentId} />
    </DialogAcao>
  )
}

export function ResolverBan({ incidentId }: { incidentId: number }) {
  return (
    <>
      <DialogAcao
        rotulo={ACOES["ban-recuperado"].rotulo}
        titulo={ACOES["ban-recuperado"].rotulo}
        descricao={ACOES["ban-recuperado"].frase}
        confirmar="Marcar como recuperado"
        acao={resolverBan}
        variant="default"
      >
        <input type="hidden" name="incidentId" value={incidentId} />
        <input type="hidden" name="resultado" value="recuperada" />
      </DialogAcao>
      <DialogAcao
        rotulo={ACOES["ban-perdido"].rotulo}
        titulo={ACOES["ban-perdido"].rotulo}
        descricao={ACOES["ban-perdido"].frase}
        confirmar="Marcar como perdido"
        acao={resolverBan}
        variant="destructive"
      >
        <input type="hidden" name="incidentId" value={incidentId} />
        <input type="hidden" name="resultado" value="perdida" />
      </DialogAcao>
    </>
  )
}

function SelectDeInstancia({
  instancias,
  servidores,
  valorAtual,
  falharam,
}: {
  instancias: InstanciaEvolution[]
  servidores: { id: number; nome: string }[]
  valorAtual: string
  falharam: string[]
}) {
  const naLista = instancias.some((i) => `${i.serverId}::${i.name}` === valorAtual)

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="ai-instancia">Instância na Evolution</Label>
      <select
        id="ai-instancia"
        name="instancia"
        defaultValue={valorAtual}
        className={CAMPO}
      >
        <option value="">— sem instância —</option>
        {valorAtual !== "" && !naLista && (
          <option value={valorAtual}>
            {valorAtual.slice(valorAtual.indexOf("::") + 2)} (não encontrada no servidor)
          </option>
        )}
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
          Nenhum servidor Evolution cadastrado. Cadastre um em /servidores.
        </p>
      )}
      {falharam.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {falharam.join(", ")} não respondeu(ram).
        </p>
      )}
    </div>
  )
}

export function AtivarConta({
  rotulo,
  destino,
  chip,
  instancias,
  servidores,
  falharam,
}: {
  rotulo: string
  destino: { deviceId: string; slot: string } | { opcoes: SlotLivre[] }
  chip: { id: string; numero: string; operadora: string } | { opcoes: ChipLivre[] }
  instancias: InstanciaEvolution[]
  servidores: { id: number; nome: string }[]
  falharam: string[]
}) {
  const semVaga = "opcoes" in destino && destino.opcoes.length === 0
  const semChip = "opcoes" in chip && chip.opcoes.length === 0

  return (
    <DialogAcao
      rotulo={rotulo}
      titulo={ACOES["ativar-conta"].rotulo}
      descricao={ACOES["ativar-conta"].frase}
      confirmar="Ativar"
      acao={ativarConta}
      variant="default"
    >
      {"opcoes" in destino ? (
        <div className="grid gap-1.5">
          <Label htmlFor="ac-destino">Aparelho e slot</Label>
          {semVaga ? (
            <p className="text-muted-foreground text-sm">
              Nenhuma vaga livre em nenhum aparelho ativo.
            </p>
          ) : (
            <select id="ac-destino" name="destino" required className={CAMPO}>
              {destino.opcoes.map((s) => (
                <option key={`${s.deviceId}|${s.slot}`} value={`${s.deviceId}|${s.slot}`}>
                  {s.deviceId}
                  {s.apelido ? ` — ${s.apelido}` : ""} — {NOME_DO_SLOT[s.slot]}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <>
          <input
            type="hidden"
            name="destino"
            value={`${destino.deviceId}|${destino.slot}`}
          />
          <p className="text-muted-foreground text-sm">
            Aparelho {destino.deviceId}, {NOME_DO_SLOT[destino.slot]}.
          </p>
        </>
      )}

      {"opcoes" in chip ? (
        <div className="grid gap-1.5">
          <Label htmlFor="ac-chip">Chip</Label>
          {semChip ? (
            <p className="text-muted-foreground text-sm">
              Nenhum chip livre. Cadastre um chip novo primeiro.
            </p>
          ) : (
            <select id="ac-chip" name="chipId" required className={CAMPO}>
              {chip.opcoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.numero} ({c.operadora})
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <>
          <input type="hidden" name="chipId" value={chip.id} />
          <p className="text-muted-foreground text-sm">
            Chip {chip.id} — {chip.numero} ({chip.operadora}).
          </p>
        </>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="ac-data">Ativada em</Label>
        <Input id="ac-data" name="ativadaEm" type="date" required />
      </div>

      <SelectDeInstancia
        instancias={instancias}
        servidores={servidores}
        valorAtual=""
        falharam={falharam}
      />
    </DialogAcao>
  )
}

/**
 * As três operações que o operador quase nunca usa, fechadas atrás de um
 * `<details>` nativo. Abertas, cada uma vem com a frase que diz o que faz —
 * o cartão fica com três botões e mesmo assim nada some da tela.
 */
export function MaisAcoesDaConta({
  conta,
  aparelhos,
  instancias,
  servidores,
  falharam,
}: {
  conta: ContaParaAcoes
  aparelhos: { id: string; apelido: string | null }[]
  instancias: InstanciaEvolution[]
  servidores: { id: number; nome: string }[]
  falharam: string[]
}) {
  const valorAtual =
    conta.evolutionServerId && conta.instanceName
      ? `${conta.evolutionServerId}::${conta.instanceName}`
      : ""

  return (
    <details className="group">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-xs font-medium select-none">
        Mais ações <span className="group-open:hidden">▾</span>
        <span className="hidden group-open:inline">▴</span>
      </summary>

      <div className="mt-2 flex flex-col gap-3">
        <div>
          <p className="text-muted-foreground mb-1 text-xs">
            {ACOES["associar-instancia"].frase}
          </p>
          <DialogAcao
            rotulo={ACOES["associar-instancia"].rotulo}
            titulo={ACOES["associar-instancia"].rotulo}
            descricao={ACOES["associar-instancia"].frase}
            confirmar="Associar"
            acao={definirInstancia}
          >
            <input type="hidden" name="accountId" value={conta.id} />
            <SelectDeInstancia
              instancias={instancias}
              servidores={servidores}
              valorAtual={valorAtual}
              falharam={falharam}
            />
          </DialogAcao>
        </div>

        <div>
          <p className="text-muted-foreground mb-1 text-xs">
            {ACOES["corrigir-cadastro"].frase}
          </p>
          <DialogAcao
            rotulo={ACOES["corrigir-cadastro"].rotulo}
            titulo={ACOES["corrigir-cadastro"].rotulo}
            descricao={ACOES["corrigir-cadastro"].frase}
            confirmar="Corrigir"
            acao={corrigirAparelho}
          >
            <input type="hidden" name="accountId" value={conta.id} />
            <div className="grid gap-1.5">
              <Label htmlFor="cc-device">Aparelho certo</Label>
              <select
                id="cc-device"
                name="deviceId"
                defaultValue={conta.deviceId}
                className={CAMPO}
              >
                {aparelhos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id}
                    {a.apelido ? ` — ${a.apelido}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cc-slot">Slot certo</Label>
              <select id="cc-slot" name="slot" defaultValue={conta.slot} className={CAMPO}>
                {SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {NOME_DO_SLOT[s]}
                  </option>
                ))}
              </select>
            </div>
          </DialogAcao>
        </div>

        <div>
          <p className="text-muted-foreground mb-1 text-xs">
            {ACOES["encerrar-conta"].frase}
          </p>
          <DialogAcao
            rotulo={ACOES["encerrar-conta"].rotulo}
            titulo={ACOES["encerrar-conta"].rotulo}
            descricao={ACOES["encerrar-conta"].frase}
            confirmar="Encerrar conta"
            acao={cancelarConta}
            variant="destructive"
          >
            <input type="hidden" name="accountId" value={conta.id} />
          </DialogAcao>
        </div>
      </div>
    </details>
  )
}
```

- [ ] **Step 2: Verificar**

```bash
npx tsc --noEmit && npm run lint
```

Esperado: sem erro. `SlotLivre` já é exportado de `lib/queries.ts`.

- [ ] **Step 3: Commit**

```bash
git add components/acoes/conta.tsx
git commit -m "feat: acoes da conta como janelas nomeadas"
```

---

### Task 5: Ações do aparelho e a query da bandeja

**Files:**
- Create: `components/acoes/aparelho.tsx`
- Modify: `lib/queries.ts` (nova `chipsParaBandeja`)

**Interfaces:**
- Consumes: `ACOES` (Task 1); `editarAparelho`, `mudarStatusDoAparelho`, `moverChip` (Task 2); `DialogAcao` (Task 3).
- Produces:
  - `chipsParaBandeja(deviceId: string): Promise<ChipParaBandeja[]>` e `type ChipParaBandeja = { id: string; numero: string; operadora: string }` em `lib/queries.ts`
  - `<EditarAparelho deviceId apelido notas origem />`
  - `<MudarSituacao deviceId status />`
  - `<TrocarChipDaBandeja deviceId chipAtualId={string|null} chips={ChipParaBandeja[]} />`

- [ ] **Step 1: Escrever a query**

Em `lib/queries.ts`, acrescentar `ne` e `notInArray` ao import do `drizzle-orm` e a função no fim do arquivo:

```ts
export type ChipParaBandeja = { id: string; numero: string; operadora: string }

/**
 * Chips que podem ir para a bandeja deste aparelho: não aposentados e sem
 * conta ativa. O que já está nesta bandeja entra também — sem ele o select
 * abriria sem o valor atual, e o operador não veria que a bandeja está ocupada.
 */
export async function chipsParaBandeja(deviceId: string): Promise<ChipParaBandeja[]> {
  const emContaAtiva = db
    .select({ chipId: account.chipId })
    .from(account)
    .where(eq(account.status, "ativa"))

  return db
    .select({ id: chip.id, numero: chip.numero, operadora: chip.operadora })
    .from(chip)
    .where(
      and(
        ne(chip.status, "aposentado"),
        or(
          notInArray(chip.id, emContaAtiva),
          and(eq(chip.local, "bandeja"), eq(chip.bandejaDeviceId, deviceId)),
        ),
      ),
    )
    .orderBy(asc(chip.id))
}
```

- [ ] **Step 2: Escrever o componente**

Criar `components/acoes/aparelho.tsx`:

```tsx
"use client"

import { DialogAcao } from "@/components/dialog-acao"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ACOES } from "@/lib/acoes"
import { editarAparelho, moverChip, mudarStatusDoAparelho } from "@/lib/actions"
import type { ChipParaBandeja } from "@/lib/queries"

const CAMPO = "border-input bg-background h-9 rounded-md border px-3 text-sm"

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
    <DialogAcao
      rotulo={ACOES["editar-aparelho"].rotulo}
      titulo={ACOES["editar-aparelho"].rotulo}
      descricao={ACOES["editar-aparelho"].frase}
      confirmar="Salvar"
      acao={editarAparelho}
    >
      <input type="hidden" name="deviceId" value={deviceId} />
      <div className="grid gap-1.5">
        <Label htmlFor="ea-apelido">Apelido</Label>
        <Input id="ea-apelido" name="apelido" defaultValue={apelido ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ea-origem">Origem</Label>
        <select id="ea-origem" name="origem" defaultValue={origem} className={CAMPO}>
          <option value="propria">Própria (interno)</option>
          <option value="externa">Externa (externo)</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ea-notas">Notas</Label>
        <Input id="ea-notas" name="notas" defaultValue={notas ?? ""} />
      </div>
    </DialogAcao>
  )
}

export function MudarSituacao({
  deviceId,
  status,
}: {
  deviceId: string
  status: string
}) {
  return (
    <DialogAcao
      rotulo={ACOES["mudar-situacao"].rotulo}
      titulo={ACOES["mudar-situacao"].rotulo}
      descricao={ACOES["mudar-situacao"].frase}
      confirmar="Mudar"
      acao={mudarStatusDoAparelho}
    >
      <input type="hidden" name="deviceId" value={deviceId} />
      <div className="grid gap-1.5">
        <Label htmlFor="ms-status">Situação</Label>
        <select id="ms-status" name="status" defaultValue={status} className={CAMPO}>
          <option value="ativo">Ativo — em circulação, recebe conta nova</option>
          <option value="quarentena">Quarentena — parado, sem receber conta nova</option>
          <option value="aposentado">Aposentado — fora da frota</option>
        </select>
      </div>
    </DialogAcao>
  )
}

/**
 * A bandeja é física: cabe um chip. O select traz os candidatos e `moverChip`
 * tira quem estava lá antes de colocar o novo.
 */
export function TrocarChipDaBandeja({
  deviceId,
  chipAtualId,
  chips,
}: {
  deviceId: string
  chipAtualId: string | null
  chips: ChipParaBandeja[]
}) {
  return (
    <DialogAcao
      rotulo={ACOES["trocar-chip-bandeja"].rotulo}
      titulo={ACOES["trocar-chip-bandeja"].rotulo}
      descricao={ACOES["trocar-chip-bandeja"].frase}
      confirmar="Colocar na bandeja"
      acao={moverChip}
    >
      <input type="hidden" name="local" value="bandeja" />
      <input type="hidden" name="bandejaDeviceId" value={deviceId} />
      <div className="grid gap-1.5">
        <Label htmlFor="tb-chip">Chip que fica na bandeja</Label>
        {chips.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhum chip disponível. Todo chip não aposentado já está em uma conta ativa.
          </p>
        ) : (
          <select
            id="tb-chip"
            name="chipId"
            defaultValue={chipAtualId ?? ""}
            required
            className={CAMPO}
          >
            {chips.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.numero} ({c.operadora})
              </option>
            ))}
          </select>
        )}
      </div>
    </DialogAcao>
  )
}
```

- [ ] **Step 3: Verificar**

```bash
npx tsc --noEmit && npm run lint
```

Esperado: sem erro. Se `notInArray` não estiver no import de `lib/queries.ts`, o typecheck aponta.

- [ ] **Step 4: Commit**

```bash
git add components/acoes/aparelho.tsx lib/queries.ts
git commit -m "feat: acoes do aparelho e query de chips para a bandeja"
```

---

### Task 6: Ações do chip

**Files:**
- Create: `components/acoes/chip.tsx`

**Interfaces:**
- Consumes: `ACOES` (Task 1); `editarChip`, `moverChip`, `cancelarChip`, `reativarChip` (Task 2); `DialogAcao` (Task 3).
- Produces:
  - `<EditarChip chipId numero operadora origem />`
  - `<MoverChip chipId local posicao bandejaDeviceId aparelhos />`
  - `<AposentarChip chipId />`
  - `<ReativarChip chipId />`

- [ ] **Step 1: Escrever o arquivo**

Criar `components/acoes/chip.tsx`:

```tsx
"use client"

import { DialogAcao } from "@/components/dialog-acao"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ACOES } from "@/lib/acoes"
import { cancelarChip, editarChip, moverChip, reativarChip } from "@/lib/actions"

const CAMPO = "border-input bg-background h-9 rounded-md border px-3 text-sm"

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
    <DialogAcao
      rotulo={ACOES["editar-chip"].rotulo}
      titulo={ACOES["editar-chip"].rotulo}
      descricao={ACOES["editar-chip"].frase}
      confirmar="Salvar"
      acao={editarChip}
    >
      <input type="hidden" name="chipId" value={chipId} />
      <div className="grid gap-1.5">
        <Label htmlFor="ec-numero">Número</Label>
        <Input id="ec-numero" name="numero" defaultValue={numero} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ec-operadora">Operadora</Label>
        <Input id="ec-operadora" name="operadora" defaultValue={operadora} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ec-origem">Origem</Label>
        <select id="ec-origem" name="origem" defaultValue={origem} className={CAMPO}>
          <option value="propria">Própria (interno)</option>
          <option value="externa">Externa (externo)</option>
        </select>
      </div>
    </DialogAcao>
  )
}

/**
 * Os três destinos num formulário só. `moverChip` zera o que não pertence ao
 * destino escolhido, então preencher os dois campos não suja o registro.
 */
export function MoverChip({
  chipId,
  local,
  posicao,
  bandejaDeviceId,
  aparelhos,
}: {
  chipId: string
  local: string
  posicao: string | null
  bandejaDeviceId: string | null
  aparelhos: { id: string; apelido: string | null }[]
}) {
  return (
    <DialogAcao
      rotulo={ACOES["mover-chip"].rotulo}
      titulo={ACOES["mover-chip"].rotulo}
      descricao={ACOES["mover-chip"].frase}
      confirmar="Mover"
      acao={moverChip}
    >
      <input type="hidden" name="chipId" value={chipId} />
      <div className="grid gap-1.5">
        <Label htmlFor="mc-local">Destino</Label>
        <select id="mc-local" name="local" defaultValue={local} className={CAMPO}>
          <option value="pasta">Pasta — fazenda de SMS</option>
          <option value="gaveta">Gaveta — fora de uso, guardado</option>
          {/* Sem aparelho ativo não há bandeja possível: oferecer o destino
              levaria a uma recusa da action. */}
          {aparelhos.length > 0 && (
            <option value="bandeja">Bandeja de um aparelho — internet 4G</option>
          )}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="mc-posicao">Posição na pasta</Label>
        <Input
          id="mc-posicao"
          name="posicao"
          defaultValue={posicao ?? ""}
          placeholder="pasta 2, folha 3"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="mc-device">Aparelho da bandeja</Label>
        {aparelhos.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhum aparelho ativo no cadastro, então não há bandeja para onde mover.
          </p>
        ) : (
          <select
            id="mc-device"
            name="bandejaDeviceId"
            defaultValue={bandejaDeviceId ?? ""}
            className={CAMPO}
          >
            {aparelhos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id}
                {a.apelido ? ` — ${a.apelido}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>
    </DialogAcao>
  )
}

export function AposentarChip({ chipId }: { chipId: string }) {
  return (
    <DialogAcao
      rotulo={ACOES["aposentar-chip"].rotulo}
      titulo={ACOES["aposentar-chip"].rotulo}
      descricao={ACOES["aposentar-chip"].frase}
      confirmar="Aposentar"
      acao={cancelarChip}
      variant="destructive"
    >
      <input type="hidden" name="chipId" value={chipId} />
    </DialogAcao>
  )
}

export function ReativarChip({ chipId }: { chipId: string }) {
  return (
    <DialogAcao
      rotulo={ACOES["reativar-chip"].rotulo}
      titulo={ACOES["reativar-chip"].rotulo}
      descricao={ACOES["reativar-chip"].frase}
      confirmar="Reativar"
      acao={reativarChip}
    >
      <input type="hidden" name="chipId" value={chipId} />
    </DialogAcao>
  )
}
```

- [ ] **Step 2: Verificar**

```bash
npx tsc --noEmit && npm run lint
```

Esperado: sem erro.

- [ ] **Step 3: Commit**

```bash
git add components/acoes/chip.tsx
git commit -m "feat: acoes do chip como janelas nomeadas"
```

---

### Task 7: `fichaDoChip` com a conta inteira

**Files:**
- Modify: `lib/queries.ts` (tipo `FichaChip` e função `fichaDoChip`)

**Interfaces:**
- Consumes: nada das tarefas anteriores.
- Produces:
  ```ts
  export type ContaDoChip = {
    id: number
    deviceId: string
    deviceApelido: string | null
    slot: string
    ativadaEm: string
    evolutionStatus: (typeof account.$inferSelect)["evolutionStatus"]
    proxyStatus: (typeof account.$inferSelect)["proxyStatus"]
    statusVerificadoEm: Date | null
    instanceName: string | null
    evolutionServerId: number | null
    evolutionServerNome: string | null
    incidenteAberto: { incidentId: number; tipo: "restricao" | "ban"; inicio: Date } | null
  }

  export type FichaChip = {
    chip: typeof chip.$inferSelect
    aparelhoDaBandeja: typeof device.$inferSelect | null
    conta: ContaDoChip | null
    historico: (typeof incident.$inferSelect)[]
    numeroPerdido: boolean
  }
  ```
  A Task 9 consome exatamente estes nomes.

- [ ] **Step 1: Substituir tipo e função**

Em `lib/queries.ts`, trocar o bloco `export type FichaChip` + `export async function fichaDoChip` por:

```ts
export type ContaDoChip = {
  id: number
  deviceId: string
  deviceApelido: string | null
  slot: string
  ativadaEm: string
  evolutionStatus: (typeof account.$inferSelect)["evolutionStatus"]
  proxyStatus: (typeof account.$inferSelect)["proxyStatus"]
  statusVerificadoEm: Date | null
  instanceName: string | null
  evolutionServerId: number | null
  evolutionServerNome: string | null
  incidenteAberto: { incidentId: number; tipo: "restricao" | "ban"; inicio: Date } | null
}

export type FichaChip = {
  chip: typeof chip.$inferSelect
  aparelhoDaBandeja: typeof device.$inferSelect | null
  /** Só a conta ativa. Conta aposentada vive no histórico, não no bloco de cima. */
  conta: ContaDoChip | null
  /** Todo incidente de toda conta que este chip já gerou. */
  historico: (typeof incident.$inferSelect)[]
  numeroPerdido: boolean
}

/**
 * A ficha do chip precisa responder "em qual aparelho este chip está" e deixar
 * o operador registrar restrição e ban sem sair da tela. Por isso ela carrega a
 * conta ativa inteira — aparelho, apelido, conexão, instância e incidente
 * aberto — e não só a linha crua de `account`.
 */
export async function fichaDoChip(id: string): Promise<FichaChip | null> {
  const [oChip] = await db.select().from(chip).where(eq(chip.id, id))
  if (!oChip) return null

  const [aparelho] = oChip.bandejaDeviceId
    ? await db.select().from(device).where(eq(device.id, oChip.bandejaDeviceId))
    : []

  const contas = await db
    .select({
      id: account.id,
      status: account.status,
      deviceId: account.deviceId,
      deviceApelido: device.apelido,
      slot: account.slot,
      ativadaEm: account.ativadaEm,
      evolutionStatus: account.evolutionStatus,
      proxyStatus: account.proxyStatus,
      statusVerificadoEm: account.statusVerificadoEm,
      instanceName: account.instanceName,
      evolutionServerId: account.evolutionServerId,
      evolutionServerNome: evolutionServer.nome,
    })
    .from(account)
    .innerJoin(device, eq(device.id, account.deviceId))
    .leftJoin(evolutionServer, eq(evolutionServer.id, account.evolutionServerId))
    .where(eq(account.chipId, id))
    .orderBy(desc(account.id))

  const historico = contas.length
    ? await db
        .select()
        .from(incident)
        .where(
          inArray(
            incident.accountId,
            contas.map((c) => c.id),
          ),
        )
        .orderBy(desc(incident.inicio))
    : []

  const ativa = contas.find((c) => c.status === "ativa") ?? null
  const aberto = ativa
    ? (historico.find((h) => h.accountId === ativa.id && h.fim === null) ?? null)
    : null

  return {
    chip: oChip,
    aparelhoDaBandeja: aparelho ?? null,
    conta: ativa
      ? {
          id: ativa.id,
          deviceId: ativa.deviceId,
          deviceApelido: ativa.deviceApelido,
          slot: ativa.slot,
          ativadaEm: ativa.ativadaEm,
          evolutionStatus: ativa.evolutionStatus,
          proxyStatus: ativa.proxyStatus,
          statusVerificadoEm: ativa.statusVerificadoEm,
          instanceName: ativa.instanceName,
          evolutionServerId: ativa.evolutionServerId,
          evolutionServerNome: ativa.evolutionServerNome,
          incidenteAberto: aberto
            ? { incidentId: aberto.id, tipo: aberto.tipo, inicio: aberto.inicio }
            : null,
        }
      : null,
    historico,
    numeroPerdido: historico.some(
      (h) => h.tipo === "ban" && h.resultado === "perdida",
    ),
  }
}
```

Garantir que `inArray` está no import do `drizzle-orm` em `lib/queries.ts`; acrescentar se faltar.

- [ ] **Step 2: Verificar**

```bash
npx tsc --noEmit
```

Esperado: erro em `app/chip/[id]/page.tsx`, que ainda lê `ficha.conta.status` e `ficha.conta.chipId`, campos que a nova `ContaDoChip` não tem. É o esperado nesta etapa.

- [ ] **Step 3: Tapar o buraco na tela antiga**

Em `app/chip/[id]/page.tsx`, no bloco "Conta gerada", trocar `{ficha.conta.status}` por `"ativa"` — a nova `conta` só existe quando está ativa. A tela é reescrita inteira na Task 9; aqui é só manter o build de pé.

- [ ] **Step 4: Verificar**

```bash
rm -rf .next && npx tsc --noEmit && npm run lint && npm test && npx next build
```

Esperado: tudo limpo, 38 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/queries.ts app/chip/\[id\]/page.tsx
git commit -m "feat: ficha do chip carrega a conta ativa inteira"
```

---

### Task 8: Ficha do aparelho reescrita

**Files:**
- Modify: `app/aparelho/[id]/page.tsx`

**Interfaces:**
- Consumes: `EditarAparelho`, `MudarSituacao`, `TrocarChipDaBandeja` e `chipsParaBandeja` (Task 5); `RegistrarQueda`, `VoltouAoAr`, `ResolverBan`, `AtivarConta`, `MaisAcoesDaConta`, `ChipLivre` (Task 4); `ACOES` (Task 1).
- Produces: nada consumido por tarefas seguintes.

- [ ] **Step 1: Substituir o arquivo**

Substituir `app/aparelho/[id]/page.tsx` inteiro:

```tsx
import { asc, eq, or } from "drizzle-orm"
import { ShieldCheck } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import {
  EditarAparelho,
  MudarSituacao,
  TrocarChipDaBandeja,
} from "@/components/acoes/aparelho"
import {
  AtivarConta,
  MaisAcoesDaConta,
  RegistrarQueda,
  ResolverBan,
  VoltouAoAr,
} from "@/components/acoes/conta"
import { ConexaoBadge } from "@/components/conexao-badge"
import { EmptyState } from "@/components/empty-state"
import { OrigemBadge } from "@/components/origem-badge"
import { PageHeader } from "@/components/page-header"
import { ReconectarDialog } from "@/components/reconectar-dialog"
import { StatusBadge, StatusDeCadastro } from "@/components/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { db } from "@/lib/db"
import { listarInstancias } from "@/lib/evolution"
import {
  chipsLivres,
  chipsParaBandeja,
  fichaDoAparelho,
  servidoresEvolutionAtivos,
} from "@/lib/queries"
import { device } from "@/lib/schema"
import { NOME_DO_SLOT, SLOTS } from "@/lib/slots"
import { cn, LINK } from "@/lib/utils"
import { tempoDecorrido } from "@/lib/tempo"
import { idadeEmDias } from "@/lib/warmup"
import { VerificarConexao } from "@/components/verificar-conexao"

export const dynamic = "force-dynamic"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ficha = await fichaDoAparelho(id)
  if (!ficha) notFound()

  const aparelhos = await db
    .select({ id: device.id, apelido: device.apelido })
    .from(device)
    .where(or(eq(device.status, "ativo"), eq(device.id, id)))
    .orderBy(asc(device.id))

  const servidores = await servidoresEvolutionAtivos()
  const { instancias, falharam } = await listarInstancias(servidores)
  const paraBandeja = await chipsParaBandeja(id)
  const livres = await chipsLivres()

  const hoje = new Date()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo={ficha.device.id}
        subtitulo={ficha.device.apelido ?? "Sem apelido"}
        acoes={
          <div className="flex flex-wrap gap-2">
            <EditarAparelho
              deviceId={ficha.device.id}
              apelido={ficha.device.apelido}
              notas={ficha.device.notas}
              origem={ficha.device.origem}
            />
            <MudarSituacao deviceId={ficha.device.id} status={ficha.device.status} />
          </div>
        }
      />

      <div className="bg-card border-border flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border px-4 py-3 text-sm">
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Situação
          </div>
          <div className="mt-0.5">
            <StatusDeCadastro valor={ficha.device.status} />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Origem
          </div>
          <div className="mt-0.5">
            <OrigemBadge origem={ficha.device.origem} />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Contas
          </div>
          <div className="mt-0.5 font-medium tabular-nums">
            {ficha.contas.length} de {SLOTS.length}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Bans no histórico
          </div>
          <div className="mt-0.5 font-medium tabular-nums">{ficha.totalBans}</div>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Contas de WhatsApp</h2>
        {/* lg e não md: a sidebar fixa de 224px come a largura, então em 900px
            de viewport o conteúdo só tem ~650px e três colunas ficariam apertadas. */}
        <div className="grid gap-3 lg:grid-cols-3">
          {SLOTS.map((slot) => {
            const c = ficha.contas.find((conta) => conta.slot === slot)

            // Slot nunca ativado, ou liberado por ban perdido: o operador
            // precisa ver a vaga, senão ela some da tela e da cabeça dele.
            if (!c) {
              return (
                <div
                  key={slot}
                  className="bg-card border-border flex flex-col gap-2 rounded-xl border p-4"
                >
                  <div className="text-muted-foreground text-xs tracking-wide uppercase">
                    {NOME_DO_SLOT[slot]}
                  </div>
                  <div className="text-muted-foreground">Nenhuma conta aqui</div>
                  <div className="mt-auto pt-1">
                    <AtivarConta
                      rotulo="Ativar conta neste slot"
                      destino={{ deviceId: ficha.device.id, slot }}
                      chip={{ opcoes: livres }}
                      instancias={instancias}
                      servidores={servidores}
                      falharam={falharam}
                    />
                  </div>
                </div>
              )
            }

            return (
              <div
                key={c.id}
                className="bg-card border-border flex flex-col gap-2 rounded-xl border p-4"
              >
                <div className="text-muted-foreground text-xs tracking-wide uppercase">
                  {NOME_DO_SLOT[c.slot]}
                </div>
                <div className="text-lg font-medium tabular-nums">{c.numero}</div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-sm">
                  <Link href={`/chip/${c.chipId}`} className={LINK}>
                    {c.chipId}
                  </Link>
                  <span className="tabular-nums">
                    {idadeEmDias(c.ativadaEm, hoje)} dias
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    estado={
                      c.incidenteAberto
                        ? c.incidenteAberto.tipo === "ban"
                          ? "ban"
                          : "restricao"
                        : "ok"
                    }
                  />
                  {c.incidenteAberto && (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      há {tempoDecorrido(c.incidenteAberto.inicio)}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <ConexaoBadge
                    status={c.evolutionStatus}
                    proxy={c.proxyStatus}
                    statusVerificadoEm={c.statusVerificadoEm}
                  />
                </div>
                {c.evolutionServerNome && c.instanceName && (
                  <div className="text-muted-foreground text-xs">
                    {c.evolutionServerNome} · {c.instanceName}
                  </div>
                )}

                <div className="border-border mt-auto flex flex-wrap items-center gap-2 border-t pt-2">
                  {c.incidenteAberto?.tipo === "ban" ? (
                    <ResolverBan incidentId={c.incidenteAberto.incidentId} />
                  ) : c.incidenteAberto ? (
                    <VoltouAoAr incidentId={c.incidenteAberto.incidentId} />
                  ) : (
                    <RegistrarQueda accountId={c.id} />
                  )}
                  {c.evolutionStatus === "fechada" ? (
                    <ReconectarDialog accountId={c.id} />
                  ) : (
                    <VerificarConexao accountId={c.id} />
                  )}
                </div>

                <div className="border-border border-t pt-2">
                  <MaisAcoesDaConta
                    conta={{
                      id: c.id,
                      deviceId: c.deviceId,
                      slot: c.slot,
                      instanceName: c.instanceName,
                      evolutionServerId: c.evolutionServerId,
                    }}
                    aparelhos={aparelhos}
                    instancias={instancias}
                    servidores={servidores}
                    falharam={falharam}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="bg-card border-border rounded-xl border p-4">
        <h2 className="font-medium">Chip de rede (bandeja)</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Só internet 4G. Não é WhatsApp.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            {ficha.chipNaBandeja ? (
              <Link
                href={`/chip/${ficha.chipNaBandeja.id}`}
                className={cn(LINK, "font-medium")}
              >
                {ficha.chipNaBandeja.id} —{" "}
                <span className="tabular-nums">{ficha.chipNaBandeja.numero}</span> (
                {ficha.chipNaBandeja.operadora})
              </Link>
            ) : (
              <span className="text-muted-foreground text-sm">Bandeja vazia</span>
            )}
          </div>
          <TrocarChipDaBandeja
            deviceId={ficha.device.id}
            chipAtualId={ficha.chipNaBandeja?.id ?? null}
            chips={paraBandeja}
          />
        </div>
      </section>

      <section className="bg-card border-border overflow-hidden rounded-xl border">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-medium">Histórico de incidentes</h2>
          <span className="text-muted-foreground text-sm tabular-nums">
            {ficha.historico.length}
          </span>
        </div>
        {ficha.historico.length === 0 ? (
          <EmptyState
            Icone={ShieldCheck}
            Ilustracao="/vazio-tudo-certo.png"
            titulo="Nenhum incidente"
            descricao="Nenhum incidente registrado neste aparelho."
          />
        ) : (
          <div className="overflow-x-auto">
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
                    <TableCell className="text-muted-foreground">
                      {NOME_DO_SLOT[h.slot]}
                    </TableCell>
                    <TableCell>{h.chipId}</TableCell>
                    <TableCell>{h.tipo === "ban" ? "Ban" : "Restrição"}</TableCell>
                    <TableCell className="tabular-nums">
                      {h.inicio.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {h.fim ? tempoDecorrido(h.inicio, h.fim) : "em curso"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {h.resultado ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verificar**

```bash
rm -rf .next && npx tsc --noEmit && npm run lint && npx next build
```

Esperado: sem erro. `chipsLivres()` devolve linhas completas de `chip`, compatíveis com `ChipLivre` porque têm `id`, `numero` e `operadora`.

- [ ] **Step 3: Commit**

```bash
git add app/aparelho/\[id\]/page.tsx
git commit -m "feat: ficha do aparelho com blocos separados e acoes nomeadas"
```

---

### Task 9: Ficha do chip reescrita

**Files:**
- Modify: `app/chip/[id]/page.tsx`

**Interfaces:**
- Consumes: `FichaChip`/`ContaDoChip` (Task 7); `EditarChip`, `MoverChip`, `AposentarChip`, `ReativarChip` (Task 6); `RegistrarQueda`, `VoltouAoAr`, `ResolverBan`, `AtivarConta`, `MaisAcoesDaConta` (Task 4); `slotsLivres` de `lib/queries.ts`.
- Produces: nada consumido por tarefas seguintes.

- [ ] **Step 1: Substituir o arquivo**

Substituir `app/chip/[id]/page.tsx` inteiro:

```tsx
import { asc, eq } from "drizzle-orm"
import { ShieldCheck } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import {
  AposentarChip,
  EditarChip,
  MoverChip,
  ReativarChip,
} from "@/components/acoes/chip"
import {
  AtivarConta,
  MaisAcoesDaConta,
  RegistrarQueda,
  ResolverBan,
  VoltouAoAr,
} from "@/components/acoes/conta"
import { ConexaoBadge } from "@/components/conexao-badge"
import { EmptyState } from "@/components/empty-state"
import { OrigemBadge } from "@/components/origem-badge"
import { PageHeader } from "@/components/page-header"
import { ReconectarDialog } from "@/components/reconectar-dialog"
import { StatusBadge, StatusDeCadastro } from "@/components/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { db } from "@/lib/db"
import { listarInstancias } from "@/lib/evolution"
import { fichaDoChip, servidoresEvolutionAtivos, slotsLivres } from "@/lib/queries"
import { device } from "@/lib/schema"
import { NOME_DO_SLOT } from "@/lib/slots"
import { cn, LINK } from "@/lib/utils"
import { tempoDecorrido } from "@/lib/tempo"
import { idadeEmDias } from "@/lib/warmup"
import { VerificarConexao } from "@/components/verificar-conexao"

export const dynamic = "force-dynamic"

const LOCAL_TEXTO: Record<string, string> = {
  pasta: "Na pasta",
  gaveta: "Na gaveta",
  bandeja: "Na bandeja de um aparelho",
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ficha = await fichaDoChip(id)
  if (!ficha) notFound()

  const aparelhos = await db
    .select({ id: device.id, apelido: device.apelido })
    .from(device)
    .where(eq(device.status, "ativo"))
    .orderBy(asc(device.id))

  const servidores = await servidoresEvolutionAtivos()
  const { instancias, falharam } = await listarInstancias(servidores)
  const vagas = ficha.chip.status === "novo" ? await slotsLivres() : []

  const c = ficha.conta
  const hoje = new Date()

  const ondeEsta =
    ficha.chip.local === "bandeja" && ficha.aparelhoDaBandeja ? (
      <>
        Na bandeja do aparelho{" "}
        <Link
          href={`/aparelho/${ficha.aparelhoDaBandeja.id}`}
          className={cn(LINK, "font-medium")}
        >
          {ficha.aparelhoDaBandeja.id}
        </Link>{" "}
        — só internet 4G
      </>
    ) : ficha.chip.local === "bandeja" ? (
      <span className="text-destructive">
        Na bandeja de um aparelho que não existe mais
        {ficha.chip.bandejaDeviceId ? ` (${ficha.chip.bandejaDeviceId})` : ""}. Mova o
        chip para dizer onde ele está de verdade.
      </span>
    ) : ficha.chip.local === "pasta" && ficha.chip.posicao ? (
      <>Na pasta — {ficha.chip.posicao}</>
    ) : (
      <>{LOCAL_TEXTO[ficha.chip.local] ?? ficha.chip.local}</>
    )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo={ficha.chip.id}
        subtitulo={`${ficha.chip.numero} — ${ficha.chip.operadora}`}
        acoes={
          <div className="flex flex-wrap gap-2">
            <EditarChip
              chipId={ficha.chip.id}
              numero={ficha.chip.numero}
              operadora={ficha.chip.operadora}
              origem={ficha.chip.origem}
            />
            {ficha.chip.status === "aposentado" && !ficha.numeroPerdido && (
              <ReativarChip chipId={ficha.chip.id} />
            )}
            {ficha.chip.status !== "aposentado" && <AposentarChip chipId={ficha.chip.id} />}
          </div>
        }
      />

      <div className="bg-card border-border flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border px-4 py-3 text-sm">
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Situação
          </div>
          <div className="mt-0.5">
            <StatusDeCadastro valor={ficha.chip.status} />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Origem
          </div>
          <div className="mt-0.5">
            <OrigemBadge origem={ficha.chip.origem} />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Onde está
          </div>
          <div className="mt-0.5">{ondeEsta}</div>
        </div>
      </div>

      {c ? (
        <section className="bg-card border-border rounded-xl border p-4">
          <h2 className="font-medium">Conta de WhatsApp</h2>
          <p className="mt-1 text-sm">
            No aparelho{" "}
            <Link href={`/aparelho/${c.deviceId}`} className={cn(LINK, "font-medium")}>
              {c.deviceId}
            </Link>
            {c.deviceApelido ? ` · ${c.deviceApelido}` : ""} — {NOME_DO_SLOT[c.slot]} —
            ativada há <span className="tabular-nums">{idadeEmDias(c.ativadaEm, hoje)}</span>{" "}
            dias
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge
              estado={
                c.incidenteAberto
                  ? c.incidenteAberto.tipo === "ban"
                    ? "ban"
                    : "restricao"
                  : "ok"
              }
            />
            {c.incidenteAberto && (
              <span className="text-muted-foreground text-xs tabular-nums">
                há {tempoDecorrido(c.incidenteAberto.inicio)}
              </span>
            )}
            <ConexaoBadge
              status={c.evolutionStatus}
              proxy={c.proxyStatus}
              statusVerificadoEm={c.statusVerificadoEm}
            />
            {c.evolutionServerNome && c.instanceName && (
              <span className="text-muted-foreground text-xs">
                {c.evolutionServerNome} · {c.instanceName}
              </span>
            )}
          </div>

          <div className="border-border mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
            {c.incidenteAberto?.tipo === "ban" ? (
              <ResolverBan incidentId={c.incidenteAberto.incidentId} />
            ) : c.incidenteAberto ? (
              <VoltouAoAr incidentId={c.incidenteAberto.incidentId} />
            ) : (
              <RegistrarQueda accountId={c.id} />
            )}
            {c.evolutionStatus === "fechada" ? (
              <ReconectarDialog accountId={c.id} />
            ) : (
              <VerificarConexao accountId={c.id} />
            )}
          </div>

          <div className="border-border mt-3 border-t pt-3">
            <MaisAcoesDaConta
              conta={{
                id: c.id,
                deviceId: c.deviceId,
                slot: c.slot,
                instanceName: c.instanceName,
                evolutionServerId: c.evolutionServerId,
              }}
              aparelhos={aparelhos}
              instancias={instancias}
              servidores={servidores}
              falharam={falharam}
            />
          </div>
        </section>
      ) : (
        <section className="bg-card border-border rounded-xl border p-4">
          <h2 className="font-medium">Conta de WhatsApp</h2>
          {ficha.chip.status === "aposentado" && ficha.numeroPerdido ? (
            <p className="text-muted-foreground mt-1 text-sm">
              O número deste chip foi perdido em ban. Ele não pode voltar a ser usado.
            </p>
          ) : ficha.chip.status === "aposentado" ? (
            <p className="text-muted-foreground mt-1 text-sm">
              Este chip foi aposentado. Reative para deixá-lo disponível de novo.
            </p>
          ) : ficha.chip.local === "bandeja" ? (
            <p className="text-muted-foreground mt-1 text-sm">
              Este chip não é WhatsApp. Está na bandeja
              {ficha.aparelhoDaBandeja ? ` do ${ficha.aparelhoDaBandeja.id}` : ""} dando
              internet 4G. Restrição e ban não se aplicam.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground mt-1 text-sm">
                Este chip ainda não virou WhatsApp. Ative uma conta para poder registrar
                restrição e ban.
              </p>
              <div className="mt-3">
                <AtivarConta
                  rotulo="Ativar conta com este chip"
                  destino={{ opcoes: vagas }}
                  chip={{
                    id: ficha.chip.id,
                    numero: ficha.chip.numero,
                    operadora: ficha.chip.operadora,
                  }}
                  instancias={instancias}
                  servidores={servidores}
                  falharam={falharam}
                />
              </div>
            </>
          )}
        </section>
      )}

      <section className="bg-card border-border rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Onde está</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">{ondeEsta}</p>
          </div>
          <MoverChip
            chipId={ficha.chip.id}
            local={ficha.chip.local}
            posicao={ficha.chip.posicao}
            bandejaDeviceId={ficha.chip.bandejaDeviceId}
            aparelhos={aparelhos}
          />
        </div>
      </section>

      <section className="bg-card border-border overflow-hidden rounded-xl border">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-medium">Histórico deste número</h2>
          <span className="text-muted-foreground text-sm tabular-nums">
            {ficha.historico.length}
          </span>
        </div>
        {ficha.historico.length === 0 ? (
          <EmptyState
            Icone={ShieldCheck}
            Ilustracao="/vazio-tudo-certo.png"
            titulo="Nenhum incidente"
            descricao="Este número nunca teve restrição nem ban registrados."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Análise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ficha.historico.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{h.tipo === "ban" ? "Ban" : "Restrição"}</TableCell>
                    <TableCell className="tabular-nums">
                      {h.inicio.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {h.fim ? tempoDecorrido(h.inicio, h.fim) : "em curso"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {h.resultado ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verificar**

```bash
rm -rf .next && npx tsc --noEmit && npm run lint && npx next build
```

Esperado: sem erro.

- [ ] **Step 3: Commit**

```bash
git add app/chip/\[id\]/page.tsx
git commit -m "feat: ficha do chip mostra a conta e permite registrar queda"
```

---

### Task 10: Painel, cadastro, lista de chips e limpeza

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/cadastro/page.tsx`
- Modify: `app/chips/page.tsx`
- Delete: `components/incident-form.tsx`, `components/aparelho-form.tsx`, `components/chip-form.tsx`

**Interfaces:**
- Consumes: `VoltouAoAr`, `ResolverBan` (Task 4).
- Produces: nada.

- [ ] **Step 1: Painel usa as ações novas**

Em `app/page.tsx`:

- Trocar `import { EncerrarIncidente } from "@/components/incident-form"` por
  `import { ResolverBan, VoltouAoAr } from "@/components/acoes/conta"`.
- Na célula de ação da tabela "Precisa de você", trocar o `<EncerrarIncidente ... />` por:

```tsx
                      <div className="flex justify-end gap-2">
                        {c.tipo === "ban" ? (
                          <ResolverBan incidentId={c.incidentId} />
                        ) : (
                          <VoltouAoAr incidentId={c.incidentId} />
                        )}
                      </div>
```

A prop `conta` de `EncerrarIncidente` existia para dar contexto ao leitor de tela numa tabela onde o botão sozinho não dizia de qual conta era. As janelas novas trazem o título e a frase, e a linha da tabela já mostra aparelho, slot e número — o contexto está na janela que abre.

- [ ] **Step 2: Cadastro perde o cartão de ativar conta**

Em `app/cadastro/page.tsx`:

- Remover o terceiro `<div>` inteiro, o do `<h2>Ativar conta</h2>` com o `FormAcao acao={ativarConta}`.
- Remover os imports que ficaram sem uso: `ativarConta`, `listarInstancias`, `chipsLivres`, `servidoresEvolutionAtivos`, `slotsLivres`, `NOME_DO_SLOT`, e as chamadas `slots`, `livres`, `servidores`, `instancias`, `falharam` no topo da função.
- Trocar `lg:grid-cols-3` por `lg:grid-cols-2` no `div` da grade.
- Acrescentar, depois da grade, o aviso de onde a operação foi parar:

```tsx
      <p className="text-muted-foreground text-sm">
        Para ativar uma conta, abra o aparelho e use o slot livre, ou abra o chip e use
        &ldquo;Ativar conta com este chip&rdquo;.
      </p>
```

- [ ] **Step 3: Lista de chips mostra o aparelho na visão em blocos**

Em `app/chips/page.tsx`, na visão em blocos (o ramo que não é `view === "lista"`), acrescentar dentro do bloco de cada chip, logo abaixo do local, a linha do aparelho:

```tsx
                    {c.conta ? (
                      <Link
                        href={`/aparelho/${c.conta.deviceId}`}
                        className={cn(LINK, "text-sm")}
                      >
                        {c.conta.deviceId} — {NOME_DO_SLOT[c.conta.slot]}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        Sem conta de WhatsApp
                      </span>
                    )}
```

`Link`, `cn`, `LINK` e `NOME_DO_SLOT` já estão importados no arquivo.

- [ ] **Step 4: Apagar os componentes antigos**

```bash
git rm components/incident-form.tsx components/aparelho-form.tsx components/chip-form.tsx
```

- [ ] **Step 5: Confirmar que ninguém mais os importa**

```bash
grep -rn "incident-form\|aparelho-form\|chip-form" app components lib
```

Esperado: nenhuma saída. Se aparecer alguma linha, o import ficou órfão — remover.

- [ ] **Step 6: Verificar**

```bash
rm -rf .next && npx tsc --noEmit && npm run lint && npm test && npx next build
```

Esperado: typecheck sem erro, lint limpo, 38 testes passando, build concluído com as rotas `/`, `/aparelhos`, `/aparelho/[id]`, `/chips`, `/chip/[id]`, `/aquecimento`, `/cadastro` e `/servidores`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: painel, cadastro e lista de chips nas acoes novas"
```

---

## Roteiro manual de banco

O Postgres local está fora do ar, então nada acima foi exercitado contra dados
reais. Antes de considerar o trabalho pronto, com o banco de pé:

```bash
docker compose up -d
npm run db:migrate
npm run dev
```

Percorrer, em `/aparelho/<id>` de um aparelho com pelo menos uma conta ativa e um
slot livre:

1. "Editar aparelho" salva apelido, origem e notas e fecha a janela.
2. "Mudar situação" para quarentena e de volta para ativo.
3. "Registrar queda" com Restrição: o cartão passa a mostrar a pílula de restrição e o botão vira "Voltou ao ar".
4. "Registrar queda" de novo na mesma conta: a janela continua aberta e mostra "Essa conta já tem um incidente aberto. Encerre o atual antes."
5. "Voltou ao ar": a pílula volta para saudável.
6. "Registrar queda" com Ban: aparecem "Número recuperado" e "Número perdido".
7. "Número perdido": a conta some do slot, o slot fica livre, e o chip aparece como aposentado em `/chips`.
8. "Mais ações" abre e mostra as três operações com suas frases; "Corrigir cadastro" para um slot já ocupado mantém a janela aberta com "Esse slot já tem uma conta ativa neste aparelho."
9. "Ativar conta neste slot" num slot livre: o aparelho e o slot vêm preenchidos e só o chip é escolhido.
10. "Trocar chip da bandeja" com um chip novo: o chip anterior volta para a pasta e não sobra nenhum chip apontando para a mesma bandeja (conferir em `/chips`).

Em `/chip/<id>`:

11. Chip com conta ativa: o bloco "Conta de WhatsApp" mostra o aparelho, e "Registrar queda" funciona igual à ficha do aparelho.
12. Chip na bandeja: o bloco explica que não é WhatsApp e não oferece registrar queda.
13. Chip com status novo na pasta: "Ativar conta com este chip" abre com o chip fixo e a lista de vagas.
14. "Mover chip" para bandeja sem aparelho escolhido: a janela mostra "Escolha o aparelho da bandeja." e não derruba a página.

Em `/`:

15. "Voltou ao ar" e "Número perdido" na tabela "Precisa de você" abrem janela e atualizam a tabela.

## Self-review

**Cobertura do spec:** vocabulário → Task 1. Estado das actions → Task 2.
`DialogAcao` → Task 3. `acoes/conta.tsx` → Task 4. `acoes/aparelho.tsx` e
`chipsParaBandeja` → Task 5. `acoes/chip.tsx` → Task 6. `fichaDoChip`
enriquecida → Task 7. Ficha do aparelho → Task 8. Ficha do chip → Task 9.
Cadastro, painel, lista de chips e remoção dos componentes antigos → Task 10.
Testes de `lib/acoes.ts` → Task 1.

**Desvio registrado:** o spec descrevia `MaisAcoesDaConta` como janela com
etapas. O plano usa um `<details>` nativo com uma linha por ação: mesmo
resultado para o operador — nome e frase visíveis antes de clicar — sem
máquina de estados nem janela dentro de janela. O spec foi ajustado para
casar com esta decisão.

**Consistência de tipos:** `ContaParaAcoes` (Task 4) pede `id`, `deviceId`,
`slot`, `instanceName` e `evolutionServerId` — todos presentes em
`FichaAparelho["contas"][number]` (Task 8) e em `ContaDoChip` (Tasks 7 e 9).
`ChipLivre` (Task 4) pede `id`, `numero` e `operadora`, que `chipsLivres()`
devolve. `ChipParaBandeja` (Task 5) é consumido só pela Task 8. `SlotLivre`
já existe em `lib/queries.ts` e é usado igual nas Tasks 4 e 9.
