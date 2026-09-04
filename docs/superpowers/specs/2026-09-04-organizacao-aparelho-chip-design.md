# Reorganização das telas de aparelho e chip — design

## Problema

O módulo existe para responder duas perguntas, e hoje responde mal as duas:

- **Abri um aparelho: quais chips ele tem?** A resposta está espalhada entre três
  cartões de slot e um campo "Chip na bandeja" perdido no meio da faixa de status.
- **Abri um chip: em qual aparelho ele está?** Existe uma linha "Conta gerada" com
  um link, e nada mais.

Somado a isso, as ações estão soltas. O cartão de um slot em `/aparelho/[id]`
empilha quatro formulários crus, nenhum com rótulo dizendo o que é:

1. um `<select>` de tipo de incidente + `datetime-local` + botão "Registrar";
2. um badge de conexão + botão "Verificar";
3. um `<select>` de instância + botão "Salvar instância";
4. dois `<select>` (aparelho, slot) + botão "Corrigir aparelho", ao lado de
   "Cancelar conta" em vermelho.

O cabeçalho da página tem ainda um `<select>` de status solto e um bloco
"Editar aparelho" sempre aberto. O operador não consegue distinguir o que é
mover um chip do que é registrar uma restrição, porque nada na tela nomeia nem
explica as operações.

Por fim, registrar restrição e ban só é possível a partir da ficha do aparelho e
do painel. Quem está olhando um chip precisa navegar até o aparelho para
registrar a queda daquele mesmo número.

## Objetivo

Que o operador consiga, sem treinamento:

1. Ver todos os chips de um aparelho, separados por função.
2. Ver, a partir de um chip, em qual aparelho e slot ele está.
3. Registrar e encerrar restrição e ban tanto da ficha do aparelho quanto da
   ficha do chip.
4. Reconhecer cada ação pelo nome e por uma frase que diga o que ela faz.

## Escopo

Telas `/aparelho/[id]`, `/chip/[id]`, `/cadastro` e `/` (painel), mais os
componentes de ação que elas compartilham. As telas `/aquecimento` e
`/servidores` mudam apenas se herdarem um componente de ação renomeado.

Fora de escopo: modelo de dados de incidentes, motor de aquecimento, integração
Evolution, autenticação.

## Decisões tomadas

| Pergunta | Decisão |
|---|---|
| Como mostrar os chips de um aparelho | Dois blocos separados: "Contas de WhatsApp" (WA1/WA2/Business) e "Chip de rede (bandeja)". São coisas de natureza diferente. |
| Como expor as ações | Botão com nome claro que abre uma janela com título, uma frase de explicação, os campos e o botão de confirmar. Nada de formulário solto na página. |
| Destino da tela `/cadastro` | "Ativar conta" sai de lá e vira janela no slot livre, já sabendo aparelho e slot. `/cadastro` continua existindo para dar entrada em aparelho novo e chip novo. |
| Restrição/ban na ficha do chip | Se o chip virou conta, um bloco "Conta de WhatsApp" no topo traz as mesmas ações da ficha do aparelho. Se não virou, o bloco não existe e a tela explica por quê. |

## Vocabulário

A confusão do operador é, em boa parte, de nome. Os rótulos abaixo passam a ser
a única forma de nomear cada operação, em qualquer tela. Ficam centralizados em
`lib/acoes.ts` para não divergirem entre painel, ficha e lista.

| Chave | Rótulo do botão | Frase na janela |
|---|---|---|
| `registrar-queda` | Registrar queda | O número caiu. Escolha se foi restrição ou ban. |
| `restricao` | Restrição | Parou de mandar mensagem mas não foi banido. Sai do aquecimento até você marcar que voltou. |
| `ban` | Ban | O número foi banido. Vai para análise, e você marca depois se recuperou ou perdeu. |
| `voltou-ao-ar` | Voltou ao ar | A restrição acabou e o número está mandando mensagem de novo. |
| `ban-recuperado` | Número recuperado | A análise devolveu o número. A conta volta ao aquecimento. |
| `ban-perdido` | Número perdido | A análise não devolveu. A conta e o chip são aposentados e o slot fica livre. |
| `verificar-conexao` | Verificar conexão | Pergunta à Evolution se o WhatsApp desta conta está aberto. |
| `reconectar` | Reconectar | Gera o QR code para reconectar o WhatsApp desta conta. |
| `associar-instancia` | Associar instância | Diz qual instância da Evolution corresponde a esta conta. Sem isso a verificação não sabe onde olhar. |
| `corrigir-cadastro` | Corrigir cadastro | A conta foi cadastrada no aparelho ou no slot errado. Move o registro, não o chip. |
| `encerrar-conta` | Encerrar conta | O WhatsApp deste slot não existe mais. Libera o slot e devolve o chip para a pasta. |
| `ativar-conta` | Ativar conta | Um chip livre vira WhatsApp neste slot. |
| `editar-aparelho` | Editar aparelho | Apelido, origem e notas do aparelho. |
| `mudar-situacao` | Mudar situação | Ativo, em quarentena ou aposentado. Aparelho fora de "ativo" não recebe conta nova. |
| `trocar-chip-bandeja` | Trocar chip da bandeja | O chip de internet 4G que fica na bandeja deste aparelho. Não é WhatsApp. |
| `editar-chip` | Editar chip | Número, operadora e origem do chip. |
| `mover-chip` | Mover chip | Onde o chip está guardado: pasta, gaveta ou bandeja de um aparelho. |
| `aposentar-chip` | Aposentar chip | O chip não serve mais. Sai da lista de chips livres. |
| `reativar-chip` | Reativar chip | Volta um chip aposentado para a pasta, disponível de novo. |

Rótulos que desaparecem: "Registrar", "Voltou", "Análise devolveu", "Perdido",
"Corrigir aparelho", "Salvar instância", "Cancelar conta", "Cancelar chip",
"Mudar status".

## Arquitetura

### Estado das actions

`EstadoDoForm` passa a ser `{ erro?: string; aviso?: string; ok?: true } | null`.
`comMensagem` devolve `{ ...(estado ?? {}), ok: true }` no sucesso, em vez de
`null`. Sem isso a janela não consegue distinguir "ainda não enviei" de
"deu certo", porque hoje as duas situações são `null`.

As actions hospedadas em janela passam todas à assinatura
`(estado: EstadoDoForm, formData: FormData) => Promise<EstadoDoForm>`, envolvidas
em `comMensagem`: `encerrarIncidente`, `resolverBan`, `mudarStatusDoAparelho`,
`moverChip`, `cancelarConta`, `cancelarChip`, `reativarChip`, `corrigirAparelho`,
`definirInstancia`. Ganho colateral: `moverChip` hoje lança
`new Error("Escolha o aparelho da bandeja")`, que estoura a página inteira;
convertida, a frase aparece dentro da janela.

`marcarTarefa`, `gerarAquecimentoDeHoje`, `verificarConexao` e `verificarConexoes`
não mudam — não moram em janela.

### `components/dialog-acao.tsx`

Um componente, dois usos:

```tsx
<DialogAcao
  rotulo="Registrar queda"        // texto do botão que abre
  titulo="Registrar queda"        // título da janela
  descricao="O número caiu. Escolha se foi restrição ou ban."
  confirmar="Registrar"           // texto do botão de confirmar
  acao={registrarIncidente}
  variant="outline"
  size="sm"
>
  {/* campos */}
</DialogAcao>
```

Responsabilidades: renderiza o botão, abre `Dialog`, monta o `<form>` com
`useActionState`, mostra `erro` dentro da janela, fecha quando `estado?.ok`,
e repõe os valores digitados quando deu erro (mesma razão do `FormAcao` atual:
aqui se digita código de fita à mão).

Sem `children`, vira janela de confirmação pura — título, frase e
`[Cancelar] [Confirmar]`. É o caso de "Voltou ao ar", "Número perdido",
"Encerrar conta", "Aposentar chip".

`FormAcao` permanece para os formulários que continuam na página
(`/cadastro`, `/servidores`).

### `components/acoes/`

Um arquivo por entidade, cada ação exportada como componente pronto (botão +
janela), recebendo apenas os ids de que precisa. O mesmo componente serve ficha
do aparelho, ficha do chip e painel — é o que garante que restrição e ban
existam nos três lugares sem duplicar formulário.

- `acoes/conta.tsx` — `RegistrarQueda`, `VoltouAoAr`, `ResolverBan`,
  `AtivarConta`, `MaisAcoesDaConta`.
- `acoes/aparelho.tsx` — `EditarAparelho`, `MudarSituacao`, `TrocarChipDaBandeja`.
- `acoes/chip.tsx` — `EditarChip`, `MoverChip`, `AposentarChip`, `ReativarChip`.

`VerificarConexao` e `ReconectarDialog` já existem e permanecem onde estão.
`components/aparelho-form.tsx` e `components/chip-form.tsx` deixam de existir: o
que sobrevive deles migra para `acoes/` com os nomes novos, e o que era
formulário solto na página morre junto.

`TrocarChipDaBandeja` usa `moverChip` com `local=bandeja` e o aparelho fixo, mas
precisa escolher qual chip entra na bandeja. Para isso `lib/queries.ts` ganha
`chipsParaBandeja()`: chips com status diferente de `aposentado` que não estão em
conta ativa, mais o que já está na bandeja deste aparelho — sem ele o operador
não consegue confirmar que a bandeja já está ocupada por aquele chip.

`MaisAcoesDaConta` é uma janela só, com estado interno de etapa. A etapa `menu`
lista as ações secundárias como linhas nomeadas com a frase de explicação;
escolher uma troca o corpo da janela pelo formulário daquela ação, com um
"← voltar". Evita janela dentro de janela e, de quebra, é onde o operador
aprende o que cada operação faz.

Ações secundárias da conta: `associar-instancia`, `corrigir-cadastro`,
`encerrar-conta`.

## Ficha do aparelho — `/aparelho/[id]`

```
AP-03 · Motorola G8                    [Editar aparelho] [Mudar situação]
─────────────────────────────────────────────────────────────────────────
Situação: ativo  ·  Origem: própria  ·  Contas: 2 de 3  ·  Bans: 1

CONTAS DE WHATSAPP
┌── WA1 ─────────────┐ ┌── WA2 ─────────────┐ ┌── BUSINESS ────────┐
│ 11 98888-1111      │ │ 11 97777-2222      │ │                    │
│ CH-012 · 22 dias   │ │ CH-019 · 8 dias    │ │ Nenhuma conta      │
│ [OK] [aberta]      │ │ [RESTRIÇÃO há 3h]  │ │ aqui               │
│ evo-01 · inst-a    │ │ evo-01 · inst-b    │ │                    │
│                    │ │                    │ │                    │
│ [Registrar queda]  │ │ [Voltou ao ar]     │ │ [Ativar conta      │
│ [Verificar] [Mais] │ │ [Verificar] [Mais] │ │  neste slot]       │
└────────────────────┘ └────────────────────┘ └────────────────────┘

CHIP DE REDE (BANDEJA)
┌─────────────────────────────────────────────────────────────────────┐
│ Só internet 4G. Não é WhatsApp.                                     │
│ CH-044 · 11 96666-3333 · Vivo          [Trocar chip da bandeja]     │
└─────────────────────────────────────────────────────────────────────┘

HISTÓRICO DE INCIDENTES
(tabela como hoje)
```

Mudanças em relação ao atual:

- O `<select>` de status sai do cabeçalho e vira a janela "Mudar situação".
- O bloco "Editar aparelho" sempre aberto vira a janela "Editar aparelho".
- "Chip na bandeja" sai da faixa de status e vira bloco próprio, com a frase
  que diz o que ele é e o botão de troca — hoje não existe forma de trocar o
  chip da bandeja a partir do aparelho.
- A faixa de status ganha "Contas: 2 de 3" e perde o chip da bandeja.
- Cada cartão de slot tem no máximo três botões. O que era formulário cru
  (instância, corrigir cadastro, encerrar conta) vai para "Mais ações".

Ação principal do cartão, por situação:

| Situação da conta | Botões |
|---|---|
| Sem incidente | `Registrar queda` · `Verificar conexão` · `Mais ações` |
| Restrição aberta | `Voltou ao ar` · `Verificar conexão` · `Mais ações` |
| Ban aberto | `Número recuperado` · `Número perdido` · `Mais ações` |
| Conexão fechada | `Reconectar` no lugar de `Verificar conexão` |
| Slot livre | `Ativar conta neste slot` |

## Ficha do chip — `/chip/[id]`

```
CH-019 · 11 97777-2222 · Vivo                 [Editar chip] [Mover chip]
─────────────────────────────────────────────────────────────────────────
Situação: em uso  ·  Origem: própria  ·  Onde está: no aparelho AP-03

CONTA DE WHATSAPP
┌─────────────────────────────────────────────────────────────────────┐
│ No aparelho AP-03 · Motorola G8 — slot WA2 — ativada há 8 dias      │
│ [RESTRIÇÃO há 3h]  [aberta · proxy ativa]  evo-01 · inst-b          │
│                                                                     │
│ [Voltou ao ar]  [Verificar conexão]  [Mais ações]                   │
└─────────────────────────────────────────────────────────────────────┘

ONDE ESTÁ
┌─────────────────────────────────────────────────────────────────────┐
│ Na bandeja do aparelho AP-07 — só internet 4G      [Mover chip]     │
└─────────────────────────────────────────────────────────────────────┘

HISTÓRICO DESTE NÚMERO
(mesma tabela da ficha do aparelho, filtrada pela conta deste chip)
```

O bloco "Conta de WhatsApp" só existe quando o chip tem conta ativa. Quando não
tem, o lugar dele é ocupado por uma explicação do estado real:

| Estado do chip | Texto |
|---|---|
| Na pasta ou gaveta, status `novo` | "Este chip ainda não virou WhatsApp." + `[Ativar conta com este chip]` |
| Na bandeja | "Este chip não é WhatsApp. Está na bandeja do AP-07 dando internet 4G." |
| Aposentado com número perdido em ban | "O número deste chip foi perdido em ban. Ele não pode voltar a ser usado." |
| Aposentado sem ban | "Este chip foi aposentado." + `[Reativar chip]` |

`[Ativar conta com este chip]` abre a mesma janela de `ativarConta`, com o chip
fixo e os campos de aparelho/slot vindos de `slotsLivres()`. É o caminho
inverso do que existe na ficha do aparelho, e cobre quem trabalha partindo do
chip.

O grande bloco "Mover" sempre aberto vira a janela "Mover chip". A frase de
localização, que hoje ocupa um cartão inteiro no topo, encolhe para uma linha
na faixa de resumo e um bloco compacto com o botão.

### `fichaDoChip` precisa crescer

Hoje devolve a linha crua de `account`. Para o bloco acima ela passa a devolver,
quando existe conta ativa: apelido do aparelho, incidente aberto, nome do
servidor Evolution, nome da instância, e o histórico de incidentes daquela conta.
O `numeroPerdido` que já existe continua.

## Cadastro — `/cadastro`

Ficam dois cartões: "Novo aparelho" e "Novo chip". O terceiro cartão sai e dá
lugar a uma linha explicando onde a operação foi parar: para ativar uma conta,
abra o aparelho e use o slot livre, ou abra o chip e use "Ativar conta com este
chip". Sem isso o operador procura a função no lugar antigo e não acha.

## Painel — `/`

A tabela "Precisa de você" passa a usar os componentes de `acoes/conta.tsx`,
herdando os rótulos novos. É a única mudança, e existe para que "Voltou" e
"Perdido" não sobrevivam num canto com nome velho.

## Listas — `/aparelhos` e `/chips`

Estrutura preservada. Uma correção de clareza:

- `/chips`, visão em blocos: cada chip com conta mostra "AP-03 · WA2" como link,
  não só o badge de conexão. É a pergunta "em qual celular está este chip"
  respondida sem abrir a ficha. Os dados já vêm de `listarChipsComResumo`.
- `/aparelhos`: sem mudança — as colunas Chip e Tipo já respondem.

## Erros

Todo erro de action aparece dentro da janela que o causou, em português, com a
janela aberta e os campos preenchidos. É o que `DialogAcao` herda de `FormAcao`.
As mensagens de `MENSAGEM_DA_CONSTRAINT` continuam sendo a fonte:
`account_slot_ativo` e `incident_aberto_unico` são os dois casos que o operador
encontra de verdade ao usar as janelas novas.

Janela de confirmação sem campos que falhe mostra o erro e permanece aberta.

## Testes

`lib/acoes.ts` é dado puro e ganha um teste que garante que toda chave tem
rótulo e frase não vazios, e que nenhum rótulo se repete — dois botões com o
mesmo nome em telas diferentes é exatamente o defeito que este trabalho corrige.

O resto é composição de React sobre server actions já cobertas por constraint no
banco; testá-lo seria testar o Next. `lib/warmup.test.ts` e `lib/evolution.test.ts`
seguem passando sem alteração.

## Fora de escopo

Menu suspenso genérico, atalhos de teclado, edição em massa, histórico de quem
fez cada ação, e desfazer.
