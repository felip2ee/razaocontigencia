# Assets visuais gerados via Higgsfield — design

Data: 2026-08-26
Status: aprovado para planejamento

## Contexto

O redesign estrutural da interface (sidebar escura, cards, shell — spec
[2026-08-23-redesign-interface-design.md](2026-08-23-redesign-interface-design.md))
já foi implementado. Este é o sub-projeto 2 mencionado como fora de escopo na
spec da [integração Evolution API](2026-08-25-evolution-api-integracao-design.md):
constrói em cima da estrutura já existente, sem mudar layout, schema ou regra
de negócio — só os assets visuais.

A logo/wordmark atual (`public/nova-digital-wordmark.png`,
`nova-digital-wordmark-preto.png`, `nova-digital-icone.png`) já existe e está
em uso no sidebar — não é mais o placeholder em texto que a spec do redesign
previa. Mesmo assim, entra em escopo aqui: a direção visual escolhida
(monograma geométrico) é diferente da atual, e os dois PNGs de reserva
(`-preto`, `-icone`) nunca foram efetivamente usados fora da sidebar.

## Escopo

Gerar, via Higgsfield MCP, os assets visuais que hoje são placeholder ou
genéricos: a marca (wordmark + ícone), e ilustrações de empty state. Trocar
os ícones de status por ícones Lucide (sem geração de imagem — é troca de
código nos componentes de badge existentes). Nenhuma mudança de layout,
schema ou Server Action.

## Direção visual

Monograma geométrico: um "N" em caixa preta arredondada, ao lado do nome
"nova" em minúsculo, tipografia sans bem grossa — direto, sem enfeite,
consistente com o resto da interface (`app/globals.css`, preto/branco/cinza
com cor reservada a status). O wordmark abrevia "Nova Digital" para "nova"
no dia a dia (sidebar); o nome completo "Nova Digital" continua onde importa
formalmente (`app/layout.tsx`, metadata/title).

Ilustrações de empty state em line art fino: traço único e leve, mesmo peso
visual do outline dos ícones de status escolhidos — extensão do sistema de
ícones existente, não uma ilustração chamativa que rouba atenção da tela.

## Marca (logo/wordmark)

Três variantes, geradas via Higgsfield MCP com um prompt de estilo
compartilhado, substituindo os três PNGs atuais:

| Arquivo novo | Substitui | Uso |
|---|---|---|
| `public/nova-wordmark-escuro.png` | `nova-digital-wordmark.png` | Sidebar (fundo escuro) |
| `public/nova-wordmark-claro.png` | `nova-digital-wordmark-preto.png` | Reserva para fundo claro |
| `public/nova-icone.png` | `nova-digital-icone.png` | Favicon/app icon (só o monograma, quadrado) |

`components/app-sidebar.tsx` troca a referência de `src`/`alt` do
`next/image` existente para `nova-wordmark-escuro.png`. Dimensões
(`width`/`height`) ajustam para a proporção real do arquivo gerado — a
`className="h-6 w-auto"` já existente mantém a altura fixa e a largura
proporcional, sem mudança de código adicional.

Se `app/layout.tsx` referenciar um favicon atual, troca pelo arquivo gerado
de `nova-icone.png` no mesmo formato/local que já usa hoje. Não criar
`manifest.json` nem entradas de PWA que não existam já.

## Ícones de status

Nenhuma imagem gerada — troca de ícone Lucide (já uma dependência instalada,
mesma família usada no sidebar e no `EmptyState`) nos três componentes de
badge existentes, adicionado antes do texto dentro da pílula:

| Componente | Estado | Ícone Lucide |
|---|---|---|
| `components/status-badge.tsx` (`StatusBadge`) | Saudável | `CheckCircle2` |
| | Restrição | `AlertTriangle` |
| | Ban | `Ban` |
| `components/conexao-badge.tsx` (`ConexaoBadge`) | Aberta | `Wifi` |
| | Conectando | `Loader2` (com `animate-spin`) |
| | Fechada | `WifiOff` |
| | Desconhecido | `HelpCircle` |
| `components/status-badge.tsx` (`StatusDeCadastro`) | Ativo / Em uso | `CircleDot` |
| | Quarentena | `Clock` |
| | Aposentado / Novo | `Circle` |

Tamanho do ícone consistente com o texto da pílula (`size-3` ou `size-3.5`,
a definir no code review pela leitura visual real). `StatusDeCadastro` hoje
usa uma única classe neutra (`bg-muted text-foreground`) pra todos os
valores — o ícone entra dentro dessa mesma pílula neutra, não introduz cor
nova.

## Ilustrações de empty state

`EmptyState` (`components/empty-state.tsx`) hoje recebe um `Icone` Lucide
genérico (`Smartphone`, `CircuitBoard`, `ShieldCheck`, `Search`, `Flame`,
conforme a tela) e mostra em cinza claro, tamanho `size-8`. Os 7 usos no
código caem em 3 significados — geram-se 3 ilustrações reutilizáveis, não 7:

| Ilustração | Significado | Onde entra hoje |
|---|---|---|
| `public/vazio-cadastro.png` | Nada cadastrado ainda | `/aparelhos` sem aparelho, `/chips` sem chip |
| `public/vazio-tudo-certo.png` | Nada pendente, tudo em ordem | Painel: "nada fora do ar"; ficha do aparelho: "nenhum incidente" |
| `public/vazio-busca.png` | Busca/geração sem resultado | Painel: "nada encontrado" na busca de contas; aquecimento: "nada sorteado para hoje" |

`EmptyState` ganha uma prop opcional `Ilustracao?: string` (caminho da
imagem). Quando presente, renderiza a imagem (via `next/image`, tamanho fixo
~64-96px) no lugar do `Icone` Lucide; quando ausente, mantém o `Icone` atual
como fallback — cobre qualquer empty state futuro sem ilustração dedicada,
sem forçar geração de imagem pra cada tela nova. Os 7 call sites atuais
passam a receber `Ilustracao` (mapeada pela tabela acima) em vez de `Icone`,
exceto se algum call site futuro não tiver ilustração correspondente.

## Geração técnica

Todos os 6 assets (3 de marca, 3 de ilustração) gerados numa única sessão de
trabalho contra o Higgsfield MCP (`generate_image`/`generate_image_batch`),
com um prompt de estilo compartilhado fixando paleta (preto/branco/cinza,
sem cor), fundo transparente e peso de traço — evita inconsistência entre
gerar cada asset isoladamente com prompts soltos.

- PNG, fundo transparente, 2x a resolução de exibição real (ilustração
  exibida a 64px vira arquivo de ~128px; ícone de marca dimensionado pela
  proporção real do wordmark).
- Local: direto em `public/`, mesmo padrão flat que os arquivos atuais já
  usam (sem subpasta nova).
- Os 3 PNGs antigos (`nova-digital-wordmark.png`, `nova-digital-wordmark-preto.png`,
  `nova-digital-icone.png`) são removidos do repo depois da troca de
  referência — não ficam órfãos.
- Se uma geração sair inconsistente com o prompt de estilo compartilhado ou
  com as outras já aceitas, regenerar antes de aceitar — não comprometer com
  o primeiro resultado.

## Verificação

Mesma abordagem do redesign estrutural: sem teste automatizado para imagem.
`tsc`, `lint` e `build` sem erro; cada tela com `EmptyState` aberta no
navegador conferindo que a ilustração carrega e o layout não quebra; sidebar
conferida com o wordmark novo em tela normal e estreita; badges de status
conferidos com o ícone visível e alinhado ao texto, nas três famílias
(`StatusBadge`, `ConexaoBadge`, `StatusDeCadastro`).

## Fora de escopo

Mudança de layout ou estrutura das telas (sub-projeto 1, já feito). Modo
escuro. Ícones ou ilustrações animados (exceto o giro padrão do `Loader2`
via `animate-spin`, que já é comportamento padrão do Lucide/Tailwind, não
asset gerado). `manifest.json`/entradas de PWA que não existam hoje. Novas
paletas de cor além da já definida no redesign. Pendências registradas em
`docs/superpowers/pendencias-conhecidas.md`.
