# Redesign da interface — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a interface crua do sistema por um visual limpo com identidade Nova Digital — sidebar escura, corpo claro em cards, relógio no header — e reorganizar a informação para que as ações do dia a dia aconteçam onde o operador já está olhando.

**Architecture:** A paleta inteira vive em tokens CSS em `app/globals.css`; nenhum componente escreve cor à mão. Um shell (sidebar + header) envolve todas as rotas via `app/layout.tsx`. As telas são reconstruídas sobre um punhado de componentes de domínio pequenos, todos Server Components exceto o relógio. Nenhuma regra de negócio, schema ou Server Action existente muda.

**Tech Stack:** Next.js 16.2.6, React 19.2.4, Tailwind 4, shadcn sobre `@base-ui/react` (style `base-nova`), ícones Lucide, Drizzle sobre PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-08-23-redesign-interface-design.md`

## Global Constraints

- **Next.js 16**: `params` e `searchParams` são `Promise` e precisam de `await`. Server Actions usam `refresh()` de `next/cache`, não `revalidatePath`. Docs em `node_modules/next/dist/docs/` — este Next tem mudanças de API em relação ao seu treino; consulte antes de escrever.
- **Toda `page.tsx` que lê o banco mantém `export const dynamic = "force-dynamic"`.** As cinco já têm. Não remova de nenhuma; o build tem de continuar marcando as cinco rotas de página como `ƒ`.
- **Nenhuma dependência nova.** Nenhuma biblioteca de validação, de gráfico, de animação ou de ícone além do Lucide já instalado.
- **Nenhum componente escreve cor à mão.** Toda cor vem de token: `bg-primary`, `text-muted-foreground`, `border-border`, `bg-sidebar`, `text-status-ok` e afins. Um `text-blue-600` no meio de um componente é defeito.
- **Apenas tema claro.** `next-themes` e `components/theme-provider.tsx` saem do projeto.
- **Server Components por padrão.** Exatamente dois `"use client"` novos são permitidos, e nenhum além deles: `components/relogio.tsx` (precisa de temporizador) e `components/app-sidebar.tsx` (precisa de `usePathname` para marcar o item ativo). Os já existentes (`form-acao.tsx`) continuam como estão.
- Rótulos em português. `lib/` usa import relativo com extensão; `app/` e `components/` usam alias `@/`.
- Nenhuma mudança em `lib/schema.ts`, `lib/warmup.ts`, `lib/seed.ts`, nas migrations, nem no comportamento de qualquer Server Action existente.
- Azul da marca Nova Digital: **`#0051FA`**, extraído dos arquivos de logo. Em oklch: `oklch(0.522 0.258 262.8)`.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `app/globals.css` | Modificado: paleta clara com o azul da marca, tokens de sidebar escura e de status; blocos `.dark` removidos |
| `public/nova-digital-wordmark.png` | Novo: wordmark branco+azul, para a sidebar escura |
| `public/nova-digital-icone.png` | Novo: ícone anel+quadrado, para favicon e sidebar recolhida |
| `public/nova-digital-wordmark-preto.png` | Novo: wordmark preto, reserva para fundo claro |
| `components/theme-provider.tsx` | Removido |
| `app/layout.tsx` | Reescrito: shell com sidebar e header, sem provider de tema |
| `components/app-sidebar.tsx` | Novo: logo e navegação, marca o item ativo |
| `components/relogio.tsx` | Novo, cliente: hora e data atualizando a cada segundo |
| `components/page-header.tsx` | Novo: título, subtítulo e faixa da direita |
| `components/stat-card.tsx` | Novo: contador do topo do painel |
| `components/status-badge.tsx` | Novo: etiqueta de saudável, restrição e ban |
| `components/empty-state.tsx` | Novo: ícone, título e explicação para lista vazia |
| `components/busca.tsx` | Modificado: adaptado ao header novo |
| `app/page.tsx` | Reescrito: contadores, fila de ação, tabela filtrável |
| `app/aquecimento/page.tsx` | Reescrito: progresso e cards por aparelho |
| `app/aparelho/[id]/page.tsx` | Reescrito: três slots em cards |
| `app/chip/[id]/page.tsx` | Reescrito: localização em destaque |
| `app/cadastro/page.tsx` | Reescrito: três formulários em cards |
| `lib/queries.ts` | Modificado: ordenação dos incidentes e filtro das contas saudáveis |

**Reuso importante:** `components/incident-form.tsx` **não muda**. O spec previa uma variante compacta, mas `EncerrarIncidente` já é só botões e cabe na linha da tabela do painel como está. `components/form-acao.tsx` também não muda.

---

## Task 1: Paleta, logos e fim do tema escuro — CONCLUÍDA (commit 68171d1, review limpa)

**Files:**
- Modify: `app/globals.css`
- Create: `public/nova-digital-wordmark.png`, `public/nova-digital-icone.png`, `public/nova-digital-wordmark-preto.png`
- Delete: `components/theme-provider.tsx`
- Modify: `app/layout.tsx` (apenas remover o provider; o shell vem na Task 2)
- Modify: `package.json`

**Interfaces:**
- Consumes: nada.
- Produces: os tokens que todas as tarefas seguintes usam — `--primary` (azul da marca), `--background`, `--card`, `--muted`, `--border`, os sete `--sidebar-*`, e três tokens de status: `--status-ok`, `--status-restricao`, `--status-ban`, expostos no `@theme inline` como `--color-status-ok`, `--color-status-restricao`, `--color-status-ban`.

- [x] **Step 1: Copiar as logos para `public/`**

Os arquivos estão em `logos novadigital/` na raiz do repositório. Copie com nomes limpos:

```bash
cp "logos novadigital/raw_page_04_wordmark_horizontal_branco_azul.png" public/nova-digital-wordmark.png
cp "logos novadigital/fav ou ico raw_page_03_icone_quadrado_branco_azul.png" public/nova-digital-icone.png
cp "logos novadigital/raw_page_10_vertical_completo_preto.png" public/nova-digital-wordmark-preto.png
```

Dimensões, para uso com `next/image`: wordmark 1219×253, ícone 832×819. Ambos têm fundo transparente.

A pasta original fica onde está, mas não entra no git — são os arquivos crus, e o que a aplicação usa são as cópias em `public/`. Acrescentar ao fim do `.gitignore`:

```
# originais das logos; a aplicação usa as cópias em public/
/logos novadigital/
```

- [x] **Step 2: Acrescentar os tokens de status ao `@theme inline`**

Em `app/globals.css`, dentro do bloco `@theme inline` já existente, acrescentar três linhas junto às outras `--color-*`:

```css
    --color-status-ok: var(--status-ok);
    --color-status-restricao: var(--status-restricao);
    --color-status-ban: var(--status-ban);
```

- [x] **Step 3: Substituir o bloco `:root`**

Trocar o bloco `:root` inteiro por:

```css
:root {
    --background: oklch(0.985 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0 0);
    --primary: oklch(0.522 0.258 262.8);
    --primary-foreground: oklch(1 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.205 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --accent: oklch(0.97 0 0);
    --accent-foreground: oklch(0.205 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --ring: oklch(0.522 0.258 262.8);
    --chart-1: oklch(0.522 0.258 262.8);
    --chart-2: oklch(0.556 0 0);
    --chart-3: oklch(0.439 0 0);
    --chart-4: oklch(0.371 0 0);
    --chart-5: oklch(0.269 0 0);
    --radius: 0.625rem;

    /* Status. Não são cores de marca: comunicam estado e por isso fogem do
       neutro de propósito. */
    --status-ok: oklch(0.627 0.170 149.2);
    --status-restricao: oklch(0.666 0.157 58.3);
    --status-ban: oklch(0.577 0.245 27.325);

    /* Sidebar escura contra o corpo claro. */
    --sidebar: oklch(0.145 0.002 286.1);
    --sidebar-foreground: oklch(0.712 0.013 286.1);
    --sidebar-primary: oklch(0.522 0.258 262.8);
    --sidebar-primary-foreground: oklch(1 0 0);
    --sidebar-accent: oklch(0.210 0.006 285.9);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(0.274 0.005 286.0);
    --sidebar-ring: oklch(0.522 0.258 262.8);
}
```

- [x] **Step 4: Remover o tema escuro do CSS**

Apagar o bloco `.dark { ... }` inteiro e a linha `@custom-variant dark (&:is(.dark *));` do topo do arquivo.

- [x] **Step 5: Remover o provider de tema**

Apagar `components/theme-provider.tsx`. Em `app/layout.tsx`, remover o import do `ThemeProvider` e desembrulhar o conteúdo do `<body>`, deixando-o assim por ora (o shell completo vem na Task 2):

```tsx
      <body>
        <header className="flex items-center gap-6 border-b px-6 py-3 text-sm">
          <Link href="/" className="font-medium">
            Contingência
          </Link>
          <nav className="flex gap-4">
            <Link href="/aquecimento">Aquecimento</Link>
            <Link href="/cadastro">Cadastro</Link>
          </nav>
          <Busca />
        </header>
        <main>{children}</main>
      </body>
```

Remover também `suppressHydrationWarning` do `<html>`: ele existia por causa do `next-themes`.

- [x] **Step 6: Remover a dependência**

```bash
npm uninstall next-themes
```

Conferir que `hooks/` não contém nada que dependa de tema; se contiver, apagar o arquivo correspondente.

- [x] **Step 7: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erro.

Run: `npm run lint`
Expected: sem erro.

Run: `npm run build`
Expected: sem erro, com `/`, `/aparelho/[id]`, `/aquecimento`, `/cadastro` e `/chip/[id]` marcadas como `ƒ`.

Run: `grep -rn "next-themes\|ThemeProvider\|\.dark\b" app components lib hooks`
Expected: nenhum resultado.

Subir a aplicação com `mcp__Claude_Browser__preview_start` e abrir `/`.
Expected: a página carrega sem erro de console. O visual ainda é o antigo — só a paleta mudou; botões primários agora são azuis em vez de pretos.

- [x] **Step 8: Commit**

```bash
git add app/globals.css app/layout.tsx public .gitignore package.json package-lock.json
git rm components/theme-provider.tsx
git commit -m "feat: paleta Nova Digital e remocao do tema escuro"
```

---

## Task 2: Shell — sidebar, header e relógio

**Files:**
- Create: `components/app-sidebar.tsx`, `components/relogio.tsx`, `components/page-header.tsx`
- Modify: `app/layout.tsx`, `components/busca.tsx`

**Interfaces:**
- Consumes: os tokens da Task 1.
- Produces:
  - `AppSidebar()` — sem props, marca o item ativo lendo o pathname
  - `Relogio()` — sem props
  - `PageHeader({ titulo, subtitulo, acoes }: { titulo: string; subtitulo: string; acoes?: React.ReactNode })` — usado por todas as cinco páginas nas tarefas seguintes

- [ ] **Step 1: Escrever o relógio**

Criar `components/relogio.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"

const HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

const DATA = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
})

export function Relogio() {
  const [agora, setAgora] = useState<Date | null>(null)

  useEffect(() => {
    setAgora(new Date())
    const id = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Até montar no navegador, o espaço fica reservado com um traço no lugar da
  // hora. Renderizar a hora no servidor causaria erro de hidratação, porque o
  // relógio do servidor não bate com o do cliente no instante da hidratação.
  return (
    <div className="text-right tabular-nums">
      <div className="font-mono text-2xl leading-none font-medium">
        {agora ? HORA.format(agora) : "--:--:--"}
      </div>
      <div className="text-muted-foreground mt-1 text-xs capitalize">
        {agora ? DATA.format(agora) : " "}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Escrever a sidebar**

Criar `components/app-sidebar.tsx`:

```tsx
"use client"

import { LayoutDashboard, PlusCircle, Thermometer } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const GRUPOS = [
  {
    rotulo: "Principal",
    itens: [{ href: "/", nome: "Painel", Icone: LayoutDashboard }],
  },
  {
    rotulo: "Operação",
    itens: [
      { href: "/aquecimento", nome: "Aquecimento", Icone: Thermometer },
      { href: "/cadastro", nome: "Cadastro", Icone: PlusCircle },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="bg-sidebar border-sidebar-border flex w-56 shrink-0 flex-col border-r">
      <div className="px-5 py-6">
        <Link href="/" aria-label="Nova Digital — ir para o painel">
          <Image
            src="/nova-digital-wordmark.png"
            alt="Nova Digital"
            width={1219}
            height={253}
            priority
            className="h-6 w-auto"
          />
        </Link>
      </div>

      <nav className="flex flex-col gap-6 px-3 py-2">
        {GRUPOS.map((grupo) => (
          <div key={grupo.rotulo} className="flex flex-col gap-1">
            <div className="text-sidebar-foreground/60 px-2 pb-1 text-[0.6875rem] font-medium tracking-wider uppercase">
              {grupo.rotulo}
            </div>
            {grupo.itens.map(({ href, nome, Icone }) => {
              const ativo = href === "/" ? pathname === "/" : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={ativo ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                    ativo
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icone className="size-4 shrink-0" />
                  {nome}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
```

Nota sobre a restrição de Server Components: a sidebar é cliente porque `usePathname` exige. É uma exceção justificada — marcar o item ativo no servidor exigiria passar o pathname por todas as páginas. O relógio e a sidebar são os dois únicos componentes de cliente novos.

- [ ] **Step 3: Escrever o cabeçalho de página**

Criar `components/page-header.tsx`:

```tsx
export function PageHeader({
  titulo,
  subtitulo,
  acoes,
}: {
  titulo: string
  subtitulo: string
  acoes?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="border-primary border-l-2 pl-3">
        <h1 className="text-lg leading-tight font-semibold">{titulo}</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">{subtitulo}</p>
      </div>
      {acoes}
    </div>
  )
}
```

- [ ] **Step 4: Adaptar a busca**

Substituir `components/busca.tsx` por:

```tsx
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"

export function Busca() {
  return (
    <form action="/busca" className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        name="id"
        placeholder="ID do aparelho ou chip"
        className="h-9 w-64 pl-8"
        aria-label="Buscar por ID"
      />
    </form>
  )
}
```

- [ ] **Step 5: Montar o shell no layout**

Substituir `app/layout.tsx` por:

```tsx
import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { AppSidebar } from "@/components/app-sidebar"
import { Busca } from "@/components/busca"
import { Relogio } from "@/components/relogio"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata = {
  title: "Contingência — Nova Digital",
  icons: { icon: "/nova-digital-icone.png" },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <div className="flex min-h-svh">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="bg-card border-border flex items-center justify-end gap-6 border-b px-6 py-3">
              <Busca />
              <Relogio />
            </header>
            <main className="mx-auto w-full max-w-[1400px] flex-1 p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  )
}
```

O título e o subtítulo de cada página não ficam neste header: cada página renderiza o seu `PageHeader` como primeiro elemento, porque só ela sabe o que dizer.

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit` e `npm run lint`
Expected: sem erro.

Run: `npm run build`
Expected: sem erro, cinco rotas de página como `ƒ`.

Subir com `mcp__Claude_Browser__preview_start` e conferir, em `/`, `/aquecimento` e `/cadastro`:
- a sidebar aparece com a logo Nova Digital legível sobre o fundo escuro;
- o item do menu correspondente à rota está destacado, e só ele;
- o relógio anda de segundo em segundo;
- o console **não** mostra erro de hidratação — este é o ponto crítico do passo, verifique com `mcp__Claude_Browser__read_console_messages`;
- a busca ainda leva a `/aparelho/AP001` ao procurar `AP001`.

Estreitar a janela para 900px com `mcp__Claude_Browser__resize_window` e confirmar que a página não ganha rolagem horizontal.

- [ ] **Step 7: Commit**

```bash
git add app/layout.tsx components/app-sidebar.tsx components/relogio.tsx components/page-header.tsx components/busca.tsx
git commit -m "feat: shell com sidebar Nova Digital, header e relogio"
```

---

## Task 3: Painel

A tarefa de maior efeito: as ações de incidente passam a acontecer no painel.

**Files:**
- Create: `components/stat-card.tsx`, `components/status-badge.tsx`, `components/empty-state.tsx`
- Modify: `lib/queries.ts`, `app/page.tsx`

**Interfaces:**
- Consumes: `PageHeader` da Task 2; `EncerrarIncidente` de `components/incident-form.tsx`, que não muda.
- Produces:
  - `StatCard({ rotulo, valor, detalhe, Icone }: { rotulo: string; valor: number; detalhe: string; Icone: LucideIcon })`
  - `StatusBadge({ estado }: { estado: "ok" | "restricao" | "ban" })`
  - `EmptyState({ Icone, titulo, descricao }: { Icone: LucideIcon; titulo: string; descricao: string })`
  - `contasSaudaveis(filtro?: string)` em `lib/queries.ts` — parâmetro novo, opcional, sem quebrar as chamadas existentes

- [ ] **Step 1: Escrever os três componentes**

Criar `components/stat-card.tsx`:

```tsx
import type { LucideIcon } from "lucide-react"

export function StatCard({
  rotulo,
  valor,
  detalhe,
  Icone,
}: {
  rotulo: string
  valor: number
  detalhe: string
  Icone: LucideIcon
}) {
  return (
    <div className="bg-card border-border flex items-start gap-3 rounded-xl border p-4">
      <div className="bg-muted text-muted-foreground rounded-lg p-2">
        <Icone className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-muted-foreground text-[0.6875rem] font-medium tracking-wider uppercase">
          {rotulo}
        </div>
        <div className="mt-0.5 text-2xl leading-none font-semibold tabular-nums">{valor}</div>
        <div className="text-muted-foreground mt-1 truncate text-xs">{detalhe}</div>
      </div>
    </div>
  )
}
```

Criar `components/status-badge.tsx`:

```tsx
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

export function StatusBadge({ estado }: { estado: keyof typeof ESTILO }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ESTILO[estado]}`}
    >
      {TEXTO[estado]}
    </span>
  )
}
```

Criar `components/empty-state.tsx`:

```tsx
import type { LucideIcon } from "lucide-react"

export function EmptyState({
  Icone,
  titulo,
  descricao,
}: {
  Icone: LucideIcon
  titulo: string
  descricao: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
      <Icone className="text-muted-foreground/50 mb-2 size-8" />
      <div className="font-medium">{titulo}</div>
      <div className="text-muted-foreground text-sm">{descricao}</div>
    </div>
  )
}
```

- [ ] **Step 2: Ordenar os incidentes do mais antigo e aceitar filtro**

Em `lib/queries.ts`, duas mudanças cirúrgicas.

Primeira: em `contasComIncidenteAberto`, trocar `.orderBy(desc(incident.inicio))` por `.orderBy(asc(incident.inicio))` — o incidente mais antigo é o mais urgente e tem de aparecer primeiro. Se `desc` deixar de ser usado no arquivo, remover do import.

Segunda: dar um parâmetro opcional de filtro a `contasSaudaveis`. Trocar a assinatura e a cláusula `where`:

```ts
export async function contasSaudaveis(filtro?: string): Promise<ContaNaLista[]> {
  const abertos = db
    .select({ accountId: incident.accountId })
    .from(incident)
    .where(isNull(incident.fim))

  const termo = filtro?.trim()
  const condicoes = [eq(account.status, "ativa"), sql`${account.id} not in ${abertos}`]

  if (termo) {
    const alvo = `%${termo}%`
    condicoes.push(
      sql`(${account.deviceId} ilike ${alvo} or ${chip.numero} ilike ${alvo} or ${account.chipId} ilike ${alvo})`,
    )
  }

  return db
    .select(CAMPOS_DA_CONTA)
    .from(account)
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(and(...condicoes))
    .orderBy(asc(account.deviceId), asc(account.slot))
}
```

`ilike` é do PostgreSQL e resolve maiúsculas e minúsculas de graça. As chamadas existentes de `contasSaudaveis()` sem argumento continuam funcionando sem alteração.

- [ ] **Step 3: Reescrever o painel**

Substituir `app/page.tsx` por:

```tsx
import { CircuitBoard, Search, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/empty-state"
import { EncerrarIncidente } from "@/components/incident-form"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { contadores, contasComIncidenteAberto, contasSaudaveis } from "@/lib/queries"

export const dynamic = "force-dynamic"

const NOME_DO_SLOT: Record<string, string> = {
  wa1: "WhatsApp 1",
  wa2: "WhatsApp 2",
  business: "Business",
}

function haQuantoTempo(desde: Date): string {
  const minutos = Math.floor((Date.now() - desde.getTime()) / 60_000)
  if (minutos < 60) return `${minutos}min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `${horas}h`
  return `${Math.floor(horas / 24)}d ${horas % 24}h`
}

function texto(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const idNaoEncontrado = texto(params["nao-encontrado"])
  const filtro = texto(params.filtro)

  const [numeros, saudaveis, comIncidente] = await Promise.all([
    contadores(),
    contasSaudaveis(filtro),
    contasComIncidenteAberto(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Painel"
        subtitulo="O que está no ar, o que caiu e o que precisa de você agora."
      />

      {idNaoEncontrado && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-4 py-2.5 text-sm">
          Nenhum aparelho ou chip com o ID <strong>{idNaoEncontrado}</strong>.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          rotulo="Aparelhos"
          valor={numeros.aparelhosAtivos}
          detalhe="em circulação"
          Icone={Smartphone}
        />
        <StatCard
          rotulo="Contas saudáveis"
          valor={numeros.contasSaudaveis}
          detalhe="prontas para uso"
          Icone={ShieldCheck}
        />
        <StatCard
          rotulo="Fora do ar"
          valor={comIncidente.length}
          detalhe="com restrição ou ban aberto"
          Icone={ShieldAlert}
        />
        <StatCard
          rotulo="Chips livres"
          valor={numeros.chipsLivres}
          detalhe="disponíveis para ativar"
          Icone={CircuitBoard}
        />
      </div>

      <section className="bg-card border-border overflow-hidden rounded-xl border">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-medium">Precisa de você</h2>
          <span className="text-muted-foreground text-sm tabular-nums">
            {comIncidente.length}
          </span>
        </div>
        {comIncidente.length === 0 ? (
          <EmptyState
            Icone={ShieldCheck}
            titulo="Nada fora do ar"
            descricao="Nenhuma conta está com restrição ou ban aberto."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aparelho</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Há</TableHead>
                  <TableHead>Análise</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comIncidente.map((c) => (
                  <TableRow key={c.incidentId}>
                    <TableCell>
                      <Link
                        href={`/aparelho/${c.deviceId}`}
                        className="hover:text-primary font-medium"
                      >
                        {c.deviceId}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {NOME_DO_SLOT[c.slot]}
                    </TableCell>
                    <TableCell className="tabular-nums">{c.numero}</TableCell>
                    <TableCell>
                      <StatusBadge estado={c.tipo === "ban" ? "ban" : "restricao"} />
                    </TableCell>
                    <TableCell className="tabular-nums">{haQuantoTempo(c.inicio)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.resultado ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <EncerrarIncidente incidentId={c.incidentId} tipo={c.tipo} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="bg-card border-border overflow-hidden rounded-xl border">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="font-medium">
            Saudáveis{" "}
            <span className="text-muted-foreground font-normal tabular-nums">
              ({saudaveis.length})
            </span>
          </h2>
          <form className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              name="filtro"
              defaultValue={filtro ?? ""}
              placeholder="Filtrar por aparelho, número ou chip"
              className="h-9 w-72 pl-8"
              aria-label="Filtrar contas saudáveis"
            />
          </form>
        </div>
        {saudaveis.length === 0 ? (
          <EmptyState
            Icone={Search}
            titulo={filtro ? "Nada encontrado" : "Nenhuma conta ativa"}
            descricao={
              filtro
                ? `Nenhuma conta saudável combina com "${filtro}".`
                : "Ative uma conta no cadastro para começar."
            }
          />
        ) : (
          <div className="overflow-x-auto">
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
                      <Link
                        href={`/aparelho/${c.deviceId}`}
                        className="hover:text-primary font-medium"
                      >
                        {c.deviceId}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {NOME_DO_SLOT[c.slot]}
                    </TableCell>
                    <TableCell className="tabular-nums">{c.numero}</TableCell>
                    <TableCell className="text-muted-foreground">{c.operadora}</TableCell>
                    <TableCell>
                      <Link href={`/chip/${c.chipId}`} className="hover:text-primary">
                        {c.chipId}
                      </Link>
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

O formulário do filtro não tem botão: `Enter` no campo envia, e como o `action` está ausente ele recarrega a própria rota com `?filtro=`. O parâmetro `nao-encontrado` some ao filtrar, que é o comportamento certo — o aviso não deve sobreviver à próxima interação.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`, `npm run lint`, `npm run build`
Expected: sem erro; `/` como `ƒ`.

No browser, com os dados reais do banco:
- os quatro contadores batem com o banco. Confira `Fora do ar` contra:
  `docker compose exec -T db psql -U postgres -d contingencia -c "select count(*) from incident where fim is null"`
- registre uma restrição em alguma conta pela ficha do aparelho, volte ao painel, e confirme que ela aparece em "Precisa de você" com o botão "Voltou";
- clique em "Voltou" **no painel** e confirme que a conta sai da lista e reaparece em "Saudáveis", sem sair da página;
- filtre por um ID de aparelho existente e confirme que a tabela reduz; filtre por algo inexistente e confirme o estado vazio com o texto do filtro;
- filtre por um trecho de número em minúsculas e confirme que `ilike` encontra assim mesmo.

- [ ] **Step 5: Commit**

```bash
git add components/stat-card.tsx components/status-badge.tsx components/empty-state.tsx lib/queries.ts app/page.tsx
git commit -m "feat: painel com acoes de incidente e filtro"
```

---

## Task 4: Aquecimento

**Files:**
- Modify: `app/aquecimento/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `EmptyState`, `StatCard`; `tarefasDoDia` e `gerarAquecimentoDeHoje`/`marcarTarefa`, todos inalterados.
- Produces: nada para outras tarefas.

- [ ] **Step 1: Reescrever a tela**

Substituir `app/aquecimento/page.tsx` por:

```tsx
import { CheckCircle2, Flame, Smartphone } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { FormAcao } from "@/components/form-acao"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { gerarAquecimentoDeHoje, marcarTarefa } from "@/lib/actions"
import { tarefasDoDia, type TarefaDoDia } from "@/lib/queries"
import { hojeISO } from "@/lib/warmup"

export const dynamic = "force-dynamic"

const NOME_DO_SLOT: Record<string, string> = {
  wa1: "WhatsApp 1",
  wa2: "WhatsApp 2",
  business: "Business",
}

export default async function Page() {
  const tarefas = await tarefasDoDia(hojeISO())

  const porAparelho = new Map<string, TarefaDoDia[]>()
  for (const t of tarefas) {
    const lista = porAparelho.get(t.deviceId) ?? []
    lista.push(t)
    porAparelho.set(t.deviceId, lista)
  }

  const feitas = tarefas.filter((t) => t.status !== "pendente").length
  const total = tarefas.length
  const percentual = total === 0 ? 0 : Math.round((feitas / total) * 100)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Aquecimento de hoje"
        subtitulo="Faça um aparelho por vez. Marque o que fez para não repetir."
        acoes={
          <FormAcao acao={gerarAquecimentoDeHoje}>
            <Button type="submit">Gerar tarefas de hoje</Button>
          </FormAcao>
        }
      />

      {total > 0 && (
        <div className="bg-card border-border rounded-xl border p-4">
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-medium">
              <span className="tabular-nums">{feitas}</span> de{" "}
              <span className="tabular-nums">{total}</span> feitas
            </div>
            <div className="text-muted-foreground text-sm tabular-nums">{percentual}%</div>
          </div>
          <div className="bg-muted mt-2 h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-[width]"
              style={{ width: `${percentual}%` }}
            />
          </div>
        </div>
      )}

      {total === 0 && (
        <div className="bg-card border-border rounded-xl border">
          <EmptyState
            Icone={Flame}
            titulo="Nada sorteado para hoje"
            descricao="Clique em Gerar tarefas de hoje. Contas com restrição ou ban aberto ficam de fora."
          />
        </div>
      )}

      {[...porAparelho.entries()].map(([deviceId, lista]) => {
        const feitasNoAparelho = lista.filter((t) => t.status !== "pendente").length
        const concluido = feitasNoAparelho === lista.length

        return (
          <details
            key={deviceId}
            open={!concluido}
            className="bg-card border-border group rounded-xl border"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
              {concluido ? (
                <CheckCircle2 className="text-status-ok size-4 shrink-0" />
              ) : (
                <Smartphone className="text-muted-foreground size-4 shrink-0" />
              )}
              <span className="font-medium">{deviceId}</span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {feitasNoAparelho}/{lista.length}
              </span>
              <div className="bg-muted ml-auto h-1.5 w-24 overflow-hidden rounded-full">
                <div
                  className={concluido ? "bg-status-ok h-full" : "bg-primary h-full"}
                  style={{ width: `${(feitasNoAparelho / lista.length) * 100}%` }}
                />
              </div>
            </summary>

            <ul className="border-border flex flex-col border-t">
              {lista.map((t) => (
                <li
                  key={t.id}
                  className="border-border flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0"
                >
                  <span className="text-muted-foreground w-24 shrink-0 text-xs">
                    {NOME_DO_SLOT[t.slot]}
                  </span>
                  <span className="w-32 shrink-0 tabular-nums">{t.numero}</span>
                  <span className="min-w-48 flex-1">
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
                      <FormAcao acao={marcarTarefa}>
                        <input type="hidden" name="tarefaId" value={t.id} />
                        <input type="hidden" name="status" value="feito" />
                        <Button type="submit" size="sm">
                          Feito
                        </Button>
                      </FormAcao>
                      <FormAcao acao={marcarTarefa}>
                        <input type="hidden" name="tarefaId" value={t.id} />
                        <input type="hidden" name="status" value="pulado" />
                        <Button type="submit" size="sm" variant="outline">
                          Pular
                        </Button>
                      </FormAcao>
                    </div>
                  ) : (
                    <span
                      className={
                        t.status === "feito"
                          ? "text-status-ok text-xs font-medium"
                          : "text-muted-foreground text-xs"
                      }
                    >
                      {t.status === "feito" ? "Feito" : "Pulado"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )
      })}
    </div>
  )
}
```

O `<details>` nativo dá o recolher sem uma linha de JavaScript e sem componente de cliente — aparelho concluído já nasce fechado, via `open={!concluido}`.

**Antes de escrever, confirme como `hojeISO` é exportado** por `lib/warmup.ts` e ajuste o import se o nome divergir. A tela precisa usar a mesma função de data que `gerarAquecimentoDeHoje` usa, nunca calcular a data por conta própria — foi exatamente esse tipo de duplicação que causou um bug de fuso corrigido antes.

O aviso devolvido por `gerarAquecimentoDeHoje` (nenhuma conta saudável, todas já com tarefa, nenhuma ação elegível) é exibido pelo próprio `FormAcao`, que já trata o estado retornado pela action. Confirme lendo `components/form-acao.tsx` antes de escrever, e não duplique essa exibição.

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`, `npm run lint`, `npm run build`
Expected: sem erro; `/aquecimento` como `ƒ`.

No browser:
- com tarefas do dia apagadas (`delete from warmup_task where data = current_date`), a tela mostra o estado vazio;
- clicar em "Gerar tarefas de hoje" preenche os cards; a barra de progresso do topo mostra 0%;
- marcar uma tarefa como feito move a barra e o contador do aparelho;
- marcar **todas** as tarefas de um aparelho fecha aquele card sozinho e troca o ícone para o verde de concluído;
- clicar em gerar de novo, com tudo já sorteado, mostra o aviso da action em vez de silêncio.

- [ ] **Step 3: Commit**

```bash
git add app/aquecimento/page.tsx
git commit -m "feat: aquecimento com progresso por aparelho"
```

---

## Task 5: Ficha do aparelho

**Files:**
- Modify: `app/aparelho/[id]/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `StatusBadge`, `EmptyState`; `fichaDoAparelho`, `RegistrarIncidente`, `EncerrarIncidente`, `mudarStatusDoAparelho`, `idadeEmDias` — todos inalterados.

- [ ] **Step 1: Reescrever a tela**

A tela mantém exatamente a mesma informação e as mesmas ações da versão atual. Muda a forma: os três slots deixam de ser linhas de tabela e viram três cards lado a lado.

Leia `app/aparelho/[id]/page.tsx` inteiro antes de reescrever — ele já resolve corretamente os três slots, incluindo os livres, e essa lógica (a constante `SLOTS` e a busca da conta de cada slot) deve ser preservada tal como está. O que muda é o que envolve cada slot.

Estrutura nova, de cima para baixo:

1. `PageHeader` com o ID do aparelho como título e o apelido como subtítulo (ou "Sem apelido" se não houver). No `acoes`, o formulário de mudar status que já existe.
2. Uma linha de metadados em card: status do aparelho como `StatusBadge` ou texto, total de bans no histórico, e o chip na bandeja com link — ou "Bandeja vazia".
3. **Os três slots em grid de três colunas** (`grid gap-3 md:grid-cols-3`). Cada slot é um card `bg-card border-border rounded-xl border p-4` contendo:
   - o nome do slot em maiúsculas pequenas, cinza;
   - se houver conta: o número em destaque tabular, o chip com link, a idade em dias, o `StatusBadge` do estado (`ok` quando não há incidente aberto, senão `restricao` ou `ban`), e embaixo a ação — `EncerrarIncidente` se houver incidente aberto, `RegistrarIncidente` se não houver;
   - se o slot estiver livre: a palavra "Slot livre" em cinza e um link para `/cadastro` dizendo "Ativar conta aqui".
4. O histórico de incidentes em tabela, dentro de um card com cabeçalho, exatamente com as mesmas colunas de hoje. Quando vazio, `EmptyState`.

Use as mesmas funções auxiliares que já existem no arquivo (`duracao`, `NOME_DO_SLOT`) sem reescrevê-las.

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`, `npm run lint`, `npm run build`
Expected: sem erro; `/aparelho/[id]` como `ƒ`.

No browser, em `/aparelho/AP001`:
- os três slots aparecem sempre, e um slot livre está marcado como tal e leva ao cadastro;
- registrar uma restrição num slot muda o badge daquele card e troca a ação para "Voltou";
- o histórico continua mostrando incidentes de contas já aposentadas por ban — este é o ponto de regressão mais provável desta tarefa, confirme explicitamente;
- mudar o status do aparelho para quarentena e voltar para ativo funciona.

Estreitar para 900px e confirmar que os três cards empilham sem rolagem horizontal.

- [ ] **Step 3: Commit**

```bash
git add "app/aparelho/[id]/page.tsx"
git commit -m "feat: ficha do aparelho com os tres slots em cards"
```

---

## Task 6: Ficha do chip e cadastro

Duas telas pequenas, uma tarefa só: as mudanças são do mesmo tipo e o revisor as julgaria em conjunto.

**Files:**
- Modify: `app/chip/[id]/page.tsx`, `app/cadastro/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `EmptyState`; `fichaDoChip`, `moverChip`, `criarAparelho`, `criarChip`, `ativarConta`, `chipsLivres` — todos inalterados.

- [ ] **Step 1: Reescrever a ficha do chip**

Leia o arquivo atual antes. A informação e o formulário de mover continuam idênticos — inclusive os três destinos e a recusa de bandeja sem aparelho. Muda a hierarquia:

1. `PageHeader` com o ID do chip como título e `número — operadora` como subtítulo.
2. **A localização vira o elemento principal**: um card largo, com o texto do local em tamanho grande — "Na pasta — pasta 2, folha 3", "Na gaveta", ou "Na bandeja do aparelho AP001" com o link. É a única pergunta que essa tela responde, e hoje ela está enterrada numa linha de texto pequeno.
3. Um card menor com o status do chip e a conta gerada, ou o texto de que nenhuma conta usa este chip.
4. O formulário de mover, num card, com os mesmos campos de hoje.

Preserve o tratamento do caso em que `local` é `bandeja` mas o aparelho não é encontrado. Hoje ele cai no ramo final e exibe "Na pasta", o que é um defeito registrado em `docs/superpowers/pendencias-conhecidas.md`. **Corrija-o nesta tarefa**, já que a seção está sendo reescrita de qualquer forma: um terceiro ramo explícito dizendo que o chip está na bandeja de um aparelho que não existe mais.

- [ ] **Step 2: Reescrever o cadastro**

Leia o arquivo atual antes. Os três formulários continuam com os mesmos campos, os mesmos `name`, as mesmas actions e o mesmo `FormAcao`. Muda o invólucro: cada formulário passa a viver em seu próprio card `bg-card border-border rounded-xl border p-5`, num grid de três colunas em tela larga (`grid gap-4 lg:grid-cols-3`), empilhando em telas menores. Cada card ganha um título e uma linha de subtítulo dizendo quando usar aquele formulário.

Acrescente um `PageHeader` no topo com título "Cadastro" e subtítulo explicando a ordem natural: aparelho, depois chip, depois a conta que liga os dois.

Não mexa em nada que envolva as constraints nem as mensagens de erro: `FormAcao` já cuida disso e foi verificado.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`, `npm run lint`, `npm run build`
Expected: sem erro; `/chip/[id]` e `/cadastro` como `ƒ`.

No browser:
- em `/chip/C001`, a localização é a primeira coisa que se lê;
- mover o chip para a bandeja de um aparelho, depois para a gaveta, depois de volta para a pasta com posição, e confirmar por SQL que os campos que não pertencem ao destino ficaram nulos:
  `docker compose exec -T db psql -U postgres -d contingencia -c "select id, local, posicao, bandeja_device_id from chip where id = 'C001'"`;
- tentar mover para bandeja sem escolher aparelho e confirmar a mensagem de recusa;
- em `/cadastro`, cadastrar um aparelho com ID inédito e confirmar que aparece nos selects;
- tentar cadastrar de novo com o **mesmo** ID e confirmar que a mensagem de constraint em português aparece e os valores digitados permanecem no formulário.

- [ ] **Step 4: Commit**

```bash
git add "app/chip/[id]/page.tsx" app/cadastro/page.tsx
git commit -m "feat: ficha do chip e cadastro no visual novo"
```

---

## Verificação final da branch

Depois da Task 6, antes de considerar o trabalho pronto:

- [ ] `npm test` — os 17 testes do motor continuam passando. Nenhuma tarefa deste plano toca `lib/warmup.ts`; se algum teste quebrar, algo saiu do escopo.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` sem erro, com as cinco rotas de página como `ƒ`.
- [ ] `grep -rn "next-themes\|ThemeProvider" app components lib hooks package.json` sem resultado.
- [ ] Uma varredura por cor escrita à mão nos componentes e páginas novos:
      `grep -rnE "(text|bg|border)-(red|blue|green|yellow|amber|emerald|zinc|slate|gray|neutral)-[0-9]" app components`
      Expected: nenhum resultado. Toda cor tem de vir de token.
- [ ] As cinco telas percorridas no navegador em 1400px e em 900px, sem rolagem horizontal em nenhuma.
- [ ] Console do navegador sem erro de hidratação em nenhuma rota.

## Cobertura do spec

| Requisito do spec | Task |
|---|---|
| Paleta neutra com o azul da marca, em tokens | 1 |
| Apenas tema claro, sem `next-themes` | 1 |
| Logos em `public/` | 1 |
| Sidebar escura com logo e navegação agrupada | 2 |
| Header com busca e relógio | 2 |
| Relógio com hora grande e data, sem erro de hidratação | 2 |
| Corpo claro, cards brancos, largura máxima | 2 |
| Painel: quatro contadores | 3 |
| Painel: ações de incidente na própria linha | 3 |
| Painel: filtro por `searchParams` | 3 |
| Incidentes abertos do mais antigo primeiro | 3 |
| Aquecimento: progresso geral e por aparelho | 4 |
| Aquecimento: aparelho concluído recolhe | 4 |
| Ficha do aparelho: três slots em cards | 5 |
| Ficha do chip: localização em destaque | 6 |
| Cadastro: três formulários em cards | 6 |
