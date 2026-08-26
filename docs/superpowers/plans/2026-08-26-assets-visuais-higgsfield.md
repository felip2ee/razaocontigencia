# Assets Visuais via Higgsfield Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Task 1 is different from the rest:** it calls the Higgsfield MCP image-generation tools and requires visual judgment to accept or regenerate each result. It must be run by the session controller directly, never dispatched to a subagent — a subagent has no reliable way to judge "does this look right" against the approved direction, and image generation spends real credits. Tasks 2-5 are ordinary code changes and follow the normal dispatch flow.

**Goal:** Replace the placeholder/generic visual assets (logo, status icons, empty-state icons) with Higgsfield-generated marca assets and empty-state illustrations, plus Lucide icons on every status badge — no layout or business-logic change.

**Architecture:** Six PNGs (3 marca, 3 illustrations) are generated once via the Higgsfield MCP, downloaded into `public/`, and wired into three existing components (`app-sidebar.tsx`, `empty-state.tsx`, `app/layout.tsx` metadata) plus two badge components (`status-badge.tsx`, `conexao-badge.tsx`) that gain Lucide icons with no new asset involved.

**Tech Stack:** Next.js 16 (App Router), `next/image`, `lucide-react` (already a dependency), Higgsfield MCP (`generate_image_batch`, `jobs_wait`, `show_generation_by_ids`).

**Spec:** [docs/superpowers/specs/2026-08-26-assets-visuais-higgsfield-design.md](../specs/2026-08-26-assets-visuais-higgsfield-design.md)

## Global Constraints

- Paleta preto/branco/cinza só — cor fica reservada a status, nenhum asset novo introduz cor.
- Fundo transparente em todo PNG gerado.
- Nome completo "Nova Digital" continua em `app/layout.tsx` (`metadata.title`); só o wordmark visual abrevia para "nova".
- Nenhuma mudança de layout, schema, Server Action ou regra de negócio.
- Sem teste automatizado para imagem — verificação é `tsc`/`lint`/`build` limpos + checagem visual no navegador.
- Os 3 PNGs antigos (`nova-digital-wordmark.png`, `nova-digital-wordmark-preto.png`, `nova-digital-icone.png`) são removidos depois da troca de referência — não ficam órfãos no repo.

---

## File Structure

- `public/nova-wordmark-escuro.png` — novo, gerado via Higgsfield.
- `public/nova-wordmark-claro.png` — novo, gerado via Higgsfield.
- `public/nova-icone.png` — novo, gerado via Higgsfield.
- `public/vazio-cadastro.png` — novo, gerado via Higgsfield.
- `public/vazio-tudo-certo.png` — novo, gerado via Higgsfield.
- `public/vazio-busca.png` — novo, gerado via Higgsfield.
- `public/nova-digital-wordmark.png`, `nova-digital-wordmark-preto.png`, `nova-digital-icone.png` — removidos na Task 4.
- `components/status-badge.tsx` — modificar: `StatusBadge` e `StatusDeCadastro` ganham ícone Lucide.
- `components/conexao-badge.tsx` — modificar: `ConexaoBadge` ganha ícone Lucide no pill de status.
- `components/empty-state.tsx` — modificar: prop opcional `Ilustracao`.
- `app/aparelhos/page.tsx`, `app/chips/page.tsx`, `app/aparelho/[id]/page.tsx`, `app/aquecimento/page.tsx`, `app/page.tsx` — modificar: cada `<EmptyState>` ganha `Ilustracao`.
- `components/app-sidebar.tsx` — modificar: `src`/`alt`/`width`/`height` do wordmark.
- `app/layout.tsx` — modificar: `metadata.icons.icon`.

---

### Task 1: Gerar os 6 assets visuais via Higgsfield

**Executor: controlador da sessão, não subagent** (ver aviso no topo do plano).

**Files:**
- Create: `public/nova-wordmark-escuro.png`
- Create: `public/nova-wordmark-claro.png`
- Create: `public/nova-icone.png`
- Create: `public/vazio-cadastro.png`
- Create: `public/vazio-tudo-certo.png`
- Create: `public/vazio-busca.png`

**Interfaces:**
- Produces: os 6 arquivos acima, PNG com fundo transparente, salvos em `public/`. Task 4 consome os 3 de marca (e precisa da largura/altura reais em pixel, lidas com o script do Step 6). Task 3 consome os 3 de ilustração pelos caminhos exatos.

- [ ] **Step 1: Confirmar aspect ratios válidos do modelo**

Chamar `models_explore` (ou o parâmetro `get_cost: true` num generate_image de teste) para o modelo `nano_banana_pro` e confirmar quais strings de `aspect_ratio` esse modelo aceita. Este plano assume `"16:9"` para os dois wordmarks e `"1:1"` para o ícone e as 3 ilustrações — se o modelo não aceitar essas strings exatas, usar o valor válido mais próximo dessas proporções (wordmark bem mais largo que alto; ícone e ilustrações quadrados).

- [ ] **Step 2: Disparar o lote de 6 gerações**

Chamar `generate_image_batch` com um `requests[]` de 6 itens, todos com `model: "nano_banana_pro"`. Prompt compartilhado de estilo (prefixo comum, colado no início de cada prompt individual):

Prefixo de marca (usar nos itens 0-2):
```
Minimalist flat vector graphic, black and white and gray only, no color,
transparent background, clean geometric shapes, no gradients, no shadows,
no photorealism, modern SaaS product design style.
```

Prefixo de ilustração (usar nos itens 3-5):
```
Minimalist single-stroke line art illustration, thin uniform black outline
only, no fill, no color, no shadow, no gradient, transparent background,
friendly and simple, small icon-like illustration not a busy scene,
generous padding, centered composition.
```

Requests (índice → prompt completo → aspect_ratio):

- **index 0** (`nova-wordmark-escuro.png`): `[prefixo de marca] Logo lockup for a software brand: a bold rounded-square monogram icon containing the geometric sans-serif capital letter 'N' in white, solid black fill, positioned to the left of the lowercase wordmark "nova" in a very bold geometric sans-serif typeface, white text. Horizontal lockup, icon and wordmark aligned on the same baseline, generous spacing between them. Composition suited for a dark UI sidebar background.` — `aspect_ratio: "16:9"`
- **index 1** (`nova-wordmark-claro.png`): `[prefixo de marca] Logo lockup for a software brand: a bold rounded-square monogram icon containing the geometric sans-serif capital letter 'N' in white, solid black fill, positioned to the left of the lowercase wordmark "nova" in a very bold geometric sans-serif typeface, black text. Horizontal lockup, icon and wordmark aligned on the same baseline, generous spacing between them. Composition suited for a light UI background.` — `aspect_ratio: "16:9"`
- **index 2** (`nova-icone.png`): `[prefixo de marca] Standalone rounded-square app icon: a bold rounded-square shape with the geometric sans-serif capital letter 'N' in white, solid black fill, no wordmark, no text besides the single letter N, centered, generous internal padding.` — `aspect_ratio: "1:1"`
- **index 3** (`vazio-cadastro.png`): `[prefixo de ilustração] Illustration representing "nothing registered yet" for a device fleet management tool: an outlined smartphone with a small dashed rectangle inside suggesting an empty slot waiting to be filled, minimal detail.` — `aspect_ratio: "1:1"`
- **index 4** (`vazio-tudo-certo.png`): `[prefixo de ilustração] Illustration representing "everything is fine, nothing pending": an outlined shield with a checkmark inside, minimal detail, calm and reassuring.` — `aspect_ratio: "1:1"`
- **index 5** (`vazio-busca.png`): `[prefixo de ilustração] Illustration representing "no results found": an outlined magnifying glass, with a small empty dashed circle inside the lens instead of a reflection, minimal detail.` — `aspect_ratio: "1:1"`

Guardar os 6 `job_id` retornados, indexados 0-5.

- [ ] **Step 3: Esperar os jobs terminarem**

Chamar `jobs_wait` com os 6 jobs (cabe no limite de 12 por chamada). Repetir com `poll_after_seconds` até `all_terminal: true`.

- [ ] **Step 4: Exibir e conferir os 6 resultados**

Chamar `show_generation_by_ids` com os 6 jobs. Conferir cada imagem contra o prompt e contra as outras 5: paleta preto/branco/cinza só, fundo transparente, mesmo peso de traço entre as 3 ilustrações, mesmo estilo de monograma entre os 2 wordmarks e o ícone. Qualquer resultado inconsistente ou fora da direção aprovada (ver spec) é regenerado — repetir Steps 2-4 só para o(s) índice(s) problemático(s) antes de seguir. Não aceitar o primeiro resultado só para não gastar mais uma chamada.

- [ ] **Step 5: Baixar os 6 PNGs para `public/`**

Para cada job aceito, ler a URL de resultado na resposta de `jobs_wait`/`show_generation_by_ids` e baixar para o caminho correspondente:

```bash
curl -sL "<url do job index 0>" -o public/nova-wordmark-escuro.png
curl -sL "<url do job index 1>" -o public/nova-wordmark-claro.png
curl -sL "<url do job index 2>" -o public/nova-icone.png
curl -sL "<url do job index 3>" -o public/vazio-cadastro.png
curl -sL "<url do job index 4>" -o public/vazio-tudo-certo.png
curl -sL "<url do job index 5>" -o public/vazio-busca.png
```

- [ ] **Step 6: Ler as dimensões reais dos 2 wordmarks**

Task 4 precisa da largura/altura em pixel exatas pro `next/image`. Ler direto do cabeçalho PNG (bytes 16-23 guardam largura e altura como inteiros de 32 bits big-endian), sem depender de nenhuma lib nova:

```bash
node -e '
const fs = require("fs")
for (const f of ["public/nova-wordmark-escuro.png", "public/nova-wordmark-claro.png", "public/nova-icone.png"]) {
  const buf = fs.readFileSync(f)
  console.log(f, buf.readUInt32BE(16), "x", buf.readUInt32BE(20))
}
'
```

Anotar os 3 pares largura/altura — a Task 4 usa o par de `nova-wordmark-escuro.png`.

- [ ] **Step 7: Commit**

```bash
git add public/nova-wordmark-escuro.png public/nova-wordmark-claro.png public/nova-icone.png public/vazio-cadastro.png public/vazio-tudo-certo.png public/vazio-busca.png
git commit -m "feat: gera assets visuais (marca e ilustracoes de empty state) via Higgsfield"
```

---

### Task 2: Ícones de status nos badges

**Files:**
- Modify: `components/status-badge.tsx`
- Modify: `components/conexao-badge.tsx`

**Interfaces:**
- Consumes: nenhuma (troca isolada de componente, sem nova prop pública — `StatusBadge`, `StatusDeCadastro` e `ConexaoBadge` mantêm a mesma assinatura de props).
- Produces: nenhuma interface nova para outras tasks — visual apenas.

- [ ] **Step 1: Reescrever `components/status-badge.tsx`**

```tsx
import { AlertTriangle, Ban, CheckCircle2, Circle, CircleDot, Clock, type LucideIcon } from "lucide-react"

const PILULA = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"

const ESTILO = {
  ok: "bg-status-ok/10 text-status-ok",
  restricao: "bg-status-restricao/10 text-status-restricao",
  ban: "bg-status-ban/10 text-status-ban",
} as const

const TEXTO = {
  ok: "Saudável",
  restricao: "Restrição",
  ban: "Ban",
} as const

const ICONE_SAUDE = {
  ok: CheckCircle2,
  restricao: AlertTriangle,
  ban: Ban,
} as const

export function StatusBadge({ estado }: { estado: keyof typeof ESTILO }) {
  const Icone = ICONE_SAUDE[estado]
  return (
    <span className={`${PILULA} ${ESTILO[estado]}`}>
      <Icone className="size-3" />
      {TEXTO[estado]}
    </span>
  )
}

/**
 * Ciclo de vida do aparelho e do chip. Mesma pílula do StatusBadge, mas em
 * neutro de propósito: cor de status é reservada para saúde da conta, e
 * "quarentena" não é irmã de "restrição". O mapa só existe para o enum não
 * vazar cru na tela.
 */
const CICLO: Record<string, string> = {
  ativo: "Ativo",
  quarentena: "Quarentena",
  aposentado: "Aposentado",
  novo: "Novo",
  em_uso: "Em uso",
}

const CICLO_ICONE: Record<string, LucideIcon> = {
  ativo: CircleDot,
  em_uso: CircleDot,
  quarentena: Clock,
  aposentado: Circle,
  novo: Circle,
}

export function StatusDeCadastro({ valor }: { valor: string }) {
  const Icone = CICLO_ICONE[valor] ?? Circle
  return (
    <span className={`${PILULA} bg-muted text-foreground`}>
      <Icone className="size-3" />
      {CICLO[valor] ?? valor}
    </span>
  )
}
```

- [ ] **Step 2: Reescrever `components/conexao-badge.tsx`**

```tsx
import { HelpCircle, Loader2, Wifi, WifiOff, type LucideIcon } from "lucide-react"

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

const STATUS_ICONE: Record<Status, LucideIcon> = {
  desconhecido: HelpCircle,
  aberta: Wifi,
  conectando: Loader2,
  fechada: WifiOff,
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
  const Icone = STATUS_ICONE[status]
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COR[status]}`}
      >
        <Icone className={`size-3 ${status === "conectando" ? "animate-spin" : ""}`} />
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

- [ ] **Step 3: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 4: Rodar o app e conferir visualmente**

Run: `npm run dev`. Abrir `/` (StatusBadge nas contas saudáveis e nos incidentes abertos), `/aparelhos` e `/chips` (ConexaoBadge e StatusDeCadastro). Confirmar: cada badge mostra o ícone certo ao lado do texto, alinhado, sem quebrar o layout da pílula; o badge `conectando` do ConexaoBadge gira (`Loader2` com `animate-spin`).

- [ ] **Step 5: Commit**

```bash
git add components/status-badge.tsx components/conexao-badge.tsx
git commit -m "feat: icones Lucide nos badges de saude, ciclo de vida e conexao"
```

---

### Task 3: `EmptyState` ganha ilustração + 6 telas atualizadas

**Files:**
- Modify: `components/empty-state.tsx`
- Modify: `app/aparelhos/page.tsx`
- Modify: `app/chips/page.tsx`
- Modify: `app/aparelho/[id]/page.tsx`
- Modify: `app/aquecimento/page.tsx`
- Modify: `app/page.tsx` (2 ocorrências)

**Interfaces:**
- Consumes: `public/vazio-cadastro.png`, `public/vazio-tudo-certo.png`, `public/vazio-busca.png` (Task 1).
- Produces: `EmptyState` ganha prop opcional `Ilustracao?: string`. Nenhuma outra task depende disso.

- [ ] **Step 1: Adicionar `Ilustracao` em `components/empty-state.tsx`**

```tsx
import type { LucideIcon } from "lucide-react"
import Image from "next/image"

export function EmptyState({
  Icone,
  Ilustracao,
  titulo,
  descricao,
}: {
  Icone: LucideIcon
  Ilustracao?: string
  titulo: string
  descricao: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
      {Ilustracao ? (
        <Image src={Ilustracao} alt="" width={80} height={80} className="mb-2 size-20" />
      ) : (
        <Icone className="text-muted-foreground/50 mb-2 size-8" />
      )}
      <div className="font-medium">{titulo}</div>
      <div className="text-muted-foreground text-sm">{descricao}</div>
    </div>
  )
}
```

`alt=""` porque a imagem é decorativa — `titulo` e `descricao` já dizem tudo que importa pra quem usa leitor de tela.

- [ ] **Step 2: `app/aparelhos/page.tsx` — adicionar `Ilustracao="/vazio-cadastro.png"`**

Em `app/aparelhos/page.tsx`, o bloco (linhas 29-33):

```tsx
        <EmptyState
          Icone={Smartphone}
          titulo="Nenhum aparelho cadastrado"
          descricao="Cadastre um aparelho para começar."
        />
```

vira:

```tsx
        <EmptyState
          Icone={Smartphone}
          Ilustracao="/vazio-cadastro.png"
          titulo="Nenhum aparelho cadastrado"
          descricao="Cadastre um aparelho para começar."
        />
```

- [ ] **Step 3: `app/chips/page.tsx` — adicionar `Ilustracao="/vazio-cadastro.png"`**

Em `app/chips/page.tsx`, o bloco (linhas 35-39):

```tsx
        <EmptyState
          Icone={CircuitBoard}
          titulo="Nenhum chip cadastrado"
          descricao="Cadastre um chip para começar."
        />
```

vira:

```tsx
        <EmptyState
          Icone={CircuitBoard}
          Ilustracao="/vazio-cadastro.png"
          titulo="Nenhum chip cadastrado"
          descricao="Cadastre um chip para começar."
        />
```

- [ ] **Step 4: `app/aparelho/[id]/page.tsx` — adicionar `Ilustracao="/vazio-tudo-certo.png"`**

Em `app/aparelho/[id]/page.tsx`, o bloco (linhas 191-195):

```tsx
          <EmptyState
            Icone={ShieldCheck}
            titulo="Nenhum incidente"
            descricao="Nenhum incidente registrado neste aparelho."
          />
```

vira:

```tsx
          <EmptyState
            Icone={ShieldCheck}
            Ilustracao="/vazio-tudo-certo.png"
            titulo="Nenhum incidente"
            descricao="Nenhum incidente registrado neste aparelho."
          />
```

- [ ] **Step 5: `app/aquecimento/page.tsx` — adicionar `Ilustracao="/vazio-busca.png"`**

Em `app/aquecimento/page.tsx`, o bloco (linhas 67-71):

```tsx
          <EmptyState
            Icone={Flame}
            titulo="Nada sorteado para hoje"
            descricao="Clique em Gerar tarefas de hoje. Contas com restrição ou ban aberto ficam de fora."
          />
```

vira:

```tsx
          <EmptyState
            Icone={Flame}
            Ilustracao="/vazio-busca.png"
            titulo="Nada sorteado para hoje"
            descricao="Clique em Gerar tarefas de hoje. Contas com restrição ou ban aberto ficam de fora."
          />
```

- [ ] **Step 6: `app/page.tsx` — adicionar `Ilustracao` nas 2 ocorrências**

Bloco 1 (linhas 98-102):

```tsx
          <EmptyState
            Icone={ShieldCheck}
            titulo="Nada fora do ar"
            descricao="Nenhuma conta está com restrição ou ban aberto."
          />
```

vira:

```tsx
          <EmptyState
            Icone={ShieldCheck}
            Ilustracao="/vazio-tudo-certo.png"
            titulo="Nada fora do ar"
            descricao="Nenhuma conta está com restrição ou ban aberto."
          />
```

Bloco 2 (linhas 176-182):

```tsx
          <EmptyState
            Icone={Search}
            titulo={filtro ? "Nada encontrado" : "Nenhuma conta ativa"}
            descricao={
              filtro
                ? `Nenhuma conta saudável combina com "${filtro}".`
                : "Ative uma conta no cadastro para começar."
```

vira (adicionando `Ilustracao` logo após `Icone`, o resto do bloco não muda):

```tsx
          <EmptyState
            Icone={Search}
            Ilustracao="/vazio-busca.png"
            titulo={filtro ? "Nada encontrado" : "Nenhuma conta ativa"}
            descricao={
              filtro
                ? `Nenhuma conta saudável combina com "${filtro}".`
                : "Ative uma conta no cadastro para começar."
```

- [ ] **Step 7: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 8: Rodar o app e conferir visualmente**

Run: `npm run dev`. Forçar (ou já ter) cada uma das 6 telas vazias: `/aparelhos` sem aparelho, `/chips` sem chip, uma ficha de aparelho sem incidente, `/aquecimento` sem tarefa gerada, `/` com "nada fora do ar" e a busca de contas saudáveis sem resultado. Confirmar: a ilustração aparece no lugar do ícone Lucide cinza antigo, carrega sem erro 404, fundo transparente sem caixa branca ao redor.

- [ ] **Step 9: Commit**

```bash
git add components/empty-state.tsx app/aparelhos/page.tsx app/chips/page.tsx "app/aparelho/[id]/page.tsx" app/aquecimento/page.tsx app/page.tsx
git commit -m "feat: ilustracoes de empty state geradas via Higgsfield nas 6 telas"
```

---

### Task 4: Marca — sidebar, favicon e limpeza dos PNGs antigos

**Files:**
- Modify: `components/app-sidebar.tsx`
- Modify: `app/layout.tsx`
- Delete: `public/nova-digital-wordmark.png`
- Delete: `public/nova-digital-wordmark-preto.png`
- Delete: `public/nova-digital-icone.png`

**Interfaces:**
- Consumes: `public/nova-wordmark-escuro.png` e `public/nova-icone.png` (Task 1) — a largura/altura reais de `nova-wordmark-escuro.png`, lidas com o script abaixo (mesmo do Step 6 da Task 1, repetido aqui porque este é um subagent diferente que não viu aquele passo rodar).

- [ ] **Step 1: Ler a largura/altura reais de `public/nova-wordmark-escuro.png`**

```bash
node -e '
const fs = require("fs")
const buf = fs.readFileSync("public/nova-wordmark-escuro.png")
console.log(buf.readUInt32BE(16), "x", buf.readUInt32BE(20))
'
```

Guardar os dois números — são o `width` e `height` do Step 2.

- [ ] **Step 2: Trocar o wordmark em `components/app-sidebar.tsx`**

Em `components/app-sidebar.tsx`, o bloco (linhas 33-40):

```tsx
          <Image
            src="/nova-digital-wordmark.png"
            alt="Nova Digital"
            width={1219}
            height={253}
            priority
            className="h-6 w-auto"
          />
```

vira (substituindo `<LARGURA>`/`<ALTURA>` pelos números lidos no Step 1):

```tsx
          <Image
            src="/nova-wordmark-escuro.png"
            alt="Nova Digital"
            width={<LARGURA>}
            height={<ALTURA>}
            priority
            className="h-6 w-auto"
          />
```

- [ ] **Step 3: Trocar o favicon em `app/layout.tsx`**

Em `app/layout.tsx`, a linha:

```tsx
  icons: { icon: "/nova-digital-icone.png" },
```

vira:

```tsx
  icons: { icon: "/nova-icone.png" },
```

- [ ] **Step 4: Remover os 3 PNGs antigos**

```bash
git rm public/nova-digital-wordmark.png public/nova-digital-wordmark-preto.png public/nova-digital-icone.png
```

- [ ] **Step 5: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 6: Rodar o app e conferir visualmente**

Run: `npm run dev`. Abrir `/` e conferir: o wordmark novo aparece no sidebar sem distorção (proporção batendo com a `className="h-6 w-auto"`), sem salto de layout, sem erro 404 no console. Conferir a aba do navegador mostra o ícone novo.

- [ ] **Step 7: Commit**

```bash
git add components/app-sidebar.tsx app/layout.tsx
git commit -m "feat: troca wordmark e favicon pelos assets gerados via Higgsfield"
```

---

### Task 5: Verificação final

**Files:** nenhum (só verificação, sem mudança de código).

**Interfaces:** nenhuma.

- [ ] **Step 1: Build completo**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: sem erros nas 3 etapas.

- [ ] **Step 2: Suíte de testes**

Run: `npm test`
Expected: os 29 testes existentes continuam passando (nenhum deles cobre asset visual, mas confirma que nada quebrou por acidente).

- [ ] **Step 3: Checklist visual completo**

Run: `npm run dev`. Abrir, em sequência: `/` (StatCard, StatusBadge nas contas saudáveis, badges de incidente, wordmark no sidebar, ícone na aba), `/aparelhos`, `/chips` (ConexaoBadge, StatusDeCadastro, e cada empty state se estiver vazio), uma ficha de aparelho e uma ficha de chip com conta ativa (ConexaoBadge). Confirmar: nenhuma imagem quebrada, nenhum ícone faltando, paleta consistente preto/branco/cinza + cor de status, sidebar sem distorção em tela estreita (~700px).

- [ ] **Step 4: Commit final (se sobrar algo solto)**

Se o Step 3 não revelar nada pra corrigir, não há commit aqui — as Tasks 1-4 já cobriram tudo. Se revelar um ajuste pequeno (ex: tamanho de ícone), corrigir no componente relevante e commitar isolado com uma mensagem que descreva o ajuste.
