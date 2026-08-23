# Redesign da interface — design

Data: 2026-08-23
Status: aprovado para planejamento

## Problema

O sistema funciona, mas a interface é a que saiu da primeira implementação: cabeçalho de
uma linha, tabelas cruas, nenhuma identidade visual. O operador usa isso todo dia, e duas
coisas incomodam além da aparência.

A primeira é o atrito no gesto mais repetido: para dizer que uma conta voltou de restrição
é preciso sair do painel, abrir a ficha do aparelho e agir lá dentro. O painel mostra o
problema mas não deixa resolvê-lo.

A segunda é que a tela de aquecimento despeja todas as tarefas do dia numa lista plana,
sem noção de progresso, enquanto o trabalho real é feito um aparelho por vez.

## Escopo

Redesign visual completo das cinco telas, estrutura de navegação nova, e revisão de como a
informação é organizada em cada tela. Nenhuma mudança de regra de negócio, de schema ou de
Server Action existente além do necessário para as telas novas.

## Direção visual

Neutra e limpa: fundo cinza claro, conteúdo em cards brancos de borda sutil e cantos
arredondados, preto como cor de ação, muito espaço em branco. A cor entra apenas nos
status — restrição, ban, saudável. A referência é um preset de tema do shadcn escolhido
pelo operador; as variáveis desse preset entram em `app/globals.css`, que já carrega o
contrato completo de tokens, incluindo os de sidebar.

Contra esse corpo claro, a navegação é uma sidebar escura, quase preta e neutra — não
navy. O contraste marca a logo e separa navegação de conteúdo sem precisar de moldura.

Apenas tema claro. `next-themes`, `components/theme-provider.tsx` e o atalho da tecla `d`
saem do projeto: manter dependência e provider para um tema só é peso morto.

## Shell

### Sidebar

Coluna fixa de aproximadamente 220px, altura total, fundo escuro. A logo da Nova no topo,
com respiro em volta. Navegação agrupada, com rótulos de grupo em maiúsculas pequenas:

- `PRINCIPAL` — Painel
- `OPERAÇÃO` — Aquecimento, Cadastro

Cada item tem um ícone Lucide, pacote já instalado. O item ativo recebe fundo sutil e texto
branco; os demais ficam em cinza médio e clareiam no hover. Sem rodapé, sem contador, sem
versão.

### Header

Faixa branca no topo da área de conteúdo, com borda fina embaixo. À esquerda, o título da
página e uma linha de subtítulo dizendo o que ela faz — o nome sozinho não basta. À
direita, a busca por ID e o relógio.

### Relógio

Hora no formato `09:32:16`, tipografia mono, tamanho de destaque, com a data por extenso
menor embaixo: *sábado, 23 de agosto*. Atualiza de segundo em segundo.

É o único componente de cliente do sistema. O horário renderizado no servidor difere do
renderizado no navegador, o que causaria erro de hidratação; a hora só é renderizada depois
que o componente monta no navegador, com o espaço reservado para não haver salto de
layout.

### Corpo

Fundo cinza claro, conteúdo em cards brancos, largura máxima limitada para a tabela não
esticar até a borda em monitor largo.

## Telas

### Painel

Passa de relatório de estado a lista de trabalho.

Fila de quatro contadores no topo: aparelhos ativos, contas saudáveis, contas fora do ar,
chips livres.

Abaixo, a seção central da tela — **o que precisa de você** — com os incidentes abertos
ordenados do mais antigo para o mais novo, e os botões de ação na própria linha. É a
mudança de maior efeito do redesign: encerrar uma restrição ou registrar o resultado de uma
análise deixa de exigir navegação até a ficha do aparelho.

Por último, a tabela de contas saudáveis, com um campo para filtrar por aparelho ou número.

O filtro usa `searchParams`, no mesmo padrão da busca já existente: formulário GET, o
servidor lê e filtra. A página segue Server Component, sem estado de cliente.

### Aquecimento

Mostra progresso: *18 de 24 feitas*. Um card por aparelho, cada um com sua própria barra de
progresso. Aparelho com tudo concluído recolhe e sai do caminho.

O progresso por aparelho é calculado na própria página, a partir do que `tarefasDoDia` já
devolve. Nenhuma consulta nova.

### Ficha do aparelho

Os três slots viram três cards lado a lado, cada um com número, idade da conta em dias,
status e ação. Três cartões cabem numa olhada; é onde o formato ganha da tabela. Slot livre
continua visível e marcado como tal, com caminho para o cadastro.

Chip na bandeja e histórico de incidentes ficam abaixo, o histórico em tabela.

### Ficha do chip

A localização passa a ser o elemento principal da tela, grande e sem ambiguidade — é a
única pergunta que essa tela responde. O formulário de mover fica abaixo, em card.

### Cadastro

Os mesmos três formulários, agora em três cards. Sem abas: aparelho, chip e conta são
cadastrados em sequência, e abas esconderiam um enquanto o outro está em uso.

## Componentes

Todos de servidor, exceto o relógio.

| Componente | Responsabilidade |
|---|---|
| `components/app-sidebar.tsx` | Sidebar com logo e navegação, marca o item ativo |
| `components/relogio.tsx` | Hora e data, atualizando a cada segundo (cliente) |
| `components/page-header.tsx` | Título, subtítulo e a faixa da direita |
| `components/stat-card.tsx` | Contador do topo do painel |
| `components/status-badge.tsx` | Etiqueta de saudável, restrição, ban |
| `components/empty-state.tsx` | Ícone, título e explicação para lista vazia |

`components/incident-form.tsx`, que já existe, ganha uma variante compacta para caber na
linha da tabela do painel, mantendo a versão atual na ficha do aparelho.

## Consultas

`lib/queries.ts` muda pouco: a ordenação dos incidentes abertos passa a ser do mais antigo
para o mais novo, e as contas saudáveis aceitam um filtro por texto, aplicado a aparelho e
número.

## Assets

As logos da Nova ficam em `public/`. Enquanto não chegarem, a sidebar exibe o nome em
texto, no lugar e no tamanho que a logo vai ocupar.

## Verificação

Trabalho visual não é coberto por teste automatizado, e não vamos fingir que é. Os 17
testes do motor de aquecimento continuam rodando e continuam válidos, mas não cobrem nada
deste redesign.

A verificação é: `tsc`, `lint` e `build` sem erro; as cinco rotas de página ainda
dinâmicas; e cada tela aberta no navegador com os dados reais, conferindo que nada quebrou
e que o layout se sustenta em tela estreita.

Não haverá teste de screenshot. Para um sistema local de um operador, montar e manter isso
custa mais do que protege.

## Risco conhecido

O projeto usa `@base-ui/react` com o style `base-nova`, que não é o shadcn clássico de onde
saiu o preset. As variáveis de cor devem encaixar diretamente, já que o contrato de tokens
é o mesmo. Se algum componente reagir de forma diferente do esperado, o ajuste é no
componente — a biblioteca não será trocada no meio do caminho.

## Fora de escopo

Mudança de regra de negócio, de schema ou de Server Action existente. Modo escuro. Contas
apresentadas como cartões num grid — são dezenas de aparelhos com três contas cada, e mais
de cem cartões leem pior que uma tabela densa. Teste de screenshot. Troca da biblioteca de
componentes. As pendências registradas em `docs/superpowers/pendencias-conhecidas.md`,
que seguem abertas e não são alvo deste trabalho.
