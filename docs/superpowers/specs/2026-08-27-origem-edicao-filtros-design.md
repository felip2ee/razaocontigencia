# Origem externa, correção de cadastro e filtros — design

Data: 2026-08-27
Status: aprovado para planejamento

## Contexto

Duas dores concretas motivaram este trabalho. A primeira: um chip foi ativado
no aparelho errado e hoje não existe como corrigir isso sem aposentar a conta
e recadastrar do zero, perdendo idade/histórico de aquecimento. A segunda: o
operador às vezes usa um aparelho ou chip que **não é da própria frota** —
alugado de terceiro, ou um chip próprio posto num aparelho emprestado — e hoje
o sistema trata isso igual a qualquer outro ativo, entrando no aquecimento e
nas contagens junto com o que é realmente seu.

Junto com isso, três lacunas de manutenção do dia a dia: não dá para editar
número/operadora/apelido depois de cadastrado (só recadastrar), não existe
ação manual para cancelar um chip ou conta criados por engano (só `device` tem
essa ação hoje), e as duas telas de lista (`/aparelhos`, `/chips`) não têm
filtro nem mostram alguns dados que evitam abrir a ficha (ID do chip no card
do aparelho, posição da pasta no card do chip).

## Escopo

Campo de origem (própria/externa) em `device` e `chip`, com uma conta sendo
"externa" quando qualquer um dos dois é. Ação para corrigir o aparelho de uma
conta já ativa sem perder histórico. Exclusão de contas externas do sorteio
de aquecimento, com contador próprio no painel. Edição de
`chip.numero`/`operadora` e `device.apelido`/`notas`. Cancelamento manual de
chip, aparelho e conta (reaproveitando os status terminais que já existem).
Filtro por status e origem em `/aparelhos` e `/chips`, mais ID do chip visível
no card de aparelho e posição da pasta visível no card do chip.

Fora de escopo: mudança de layout do shell (sub-projeto já fechado), exclusão
definitiva de registros do banco (cancelamento é sempre reversível/mantém a
linha), qualquer regra nova de negócio sobre aquecimento além de excluir
contas externas do sorteio.

## Schema

Dois enums novos, um campo em cada tabela — sem tabela nova, sem campo em
`account` (a "externalidade" da conta é sempre derivada no join, nunca
armazenada):

```ts
export const deviceOrigem = pgEnum("device_origem", ["propria", "externa"])
export const chipOrigem = pgEnum("chip_origem", ["propria", "externa"])

// em device, depois de status:
origem: deviceOrigem("origem").notNull().default("propria"),

// em chip, depois de status:
origem: chipOrigem("origem").notNull().default("propria"),
```

Uma conta conta como externa quando `device.origem = 'externa' OR chip.origem
= 'externa'` — cobre tanto "aluguei aparelho e chip" quanto "meu chip num
aparelho alugado". Nenhuma migração de dados: o `default("propria")` cobre
tudo que já existe.

## Corrigir aparelho de uma conta ativa

Nova server action, no padrão `comMensagem`/`EstadoDoForm` (pode falhar de
forma esperada — slot já ocupado no destino):

```ts
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

A constraint `account_slot_ativo` (já existente, em `deviceId`+`slot` onde
`status = 'ativa'`) recusa a troca se o slot de destino já tiver uma conta
ativa — o erro sobe formatado pelo `comMensagem`/`FormAcao` do mesmo jeito que
"Já existe um aparelho com esse ID" hoje. Não mexe em `chipId`,
`ativadaEm`, `evolutionStatus` nem em nenhuma linha de `incident`/
`warmup_task` — o histórico é todo por `accountId`, que não muda.

UI: formulário compacto na ficha do aparelho (`app/aparelho/[id]/page.tsx`),
dentro do card de cada slot ocupado — dois `<select>` (aparelho de destino,
slot de destino) e um botão "Corrigir aparelho".

## Exclusão do aquecimento e contador de externos

`contasParaSorteio()` (`lib/queries.ts`) parte de `contasSaudaveis()`, que já
faz `account` inner join `chip` mas não join `device`. Adiciona o join e a
condição:

```ts
.innerJoin(device, eq(device.id, account.deviceId))
// nas condicoes:
and(eq(device.origem, "propria"), eq(chip.origem, "propria"))
```

Contas externas nunca entram no filtro elegível — `gerarTarefasDoDia` nem as
vê.

`contadores()` ganha `whatsappsExternos: number` — contagem de `account`
ativas cujo `device.origem = 'externa' OR chip.origem = 'externa'`, mesmo
join. Painel (`app/page.tsx`) ganha um 6º `StatCard` "WhatsApps externos".

## Editar chip e aparelho

Duas server actions novas, padrão `comMensagem`:

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

UI: formulário compacto nas fichas (`app/chip/[id]/page.tsx`,
`app/aparelho/[id]/page.tsx`), com os campos já preenchidos com o valor atual
(`defaultValue`).

## Cancelar chip, aparelho e conta

Reaproveita os status terminais que já existem (`aposentado` em
`chip`/`device`, `aposentada` em `account`) — sem enum novo. `device` já tem
`mudarStatusDoAparelho`; ganham a mesma ação `chip` e `account`:

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

`device` continua usando `mudarStatusDoAparelho`, que já aceita `aposentado`
como um dos três valores — só ganha um botão "Cancelar" nas fichas que chama
esse mesmo caminho com `status=aposentado` direto, sem formulário de 3 opções
para esse caso específico.

UI: botão "Cancelar" nas fichas de chip, aparelho e em cada conta ativa —
sem modal de confirmação (mesmo padrão direto que "Encerrar restrição" já
usa; reversão é manual pelo próprio cadastro, igual ao resto do sistema).

## Origem no cadastro

`app/cadastro/page.tsx`: os formulários de `criarAparelho` e `criarChip`
ganham um `<select name="origem">` com `própria`/`externa` (default
`própria`, mesmo padrão de `<select>` já usado para `local` do chip).
`criarAparelho`/`criarChip` (`lib/actions.ts`) passam a gravar
`origem: texto(formData, "origem") as "propria" | "externa"`.

## UI — panorama de aparelhos e chips

**`/aparelhos`** (`app/aparelhos/page.tsx`): cada conta no card do aparelho já
recebe `chipId` de `listarAparelhosComResumo` (`lib/queries.ts`) — só faltava
renderizar. Mostra ao lado do número, mesmo estilo mono do número.

**`/chips`** (`app/chips/page.tsx`): `ChipResumo` (`lib/queries.ts`) ganha o
campo `posicao: string | null`, já existente em `chip` mas não selecionado
pela query — soma ao `select` de `listarChipsComResumo`. Card mostra a
posição direto quando `local = 'pasta'` (mesmo texto que a ficha do chip já
usa para pasta), sem precisar abrir a ficha.

Badge de status do chip (`StatusDeCadastro`, reusado de
`components/status-badge.tsx`) ganha cor por estado — hoje é sempre
`bg-muted text-foreground` neutro para chip/aparelho; separa uma variante
colorida para o ciclo do chip (`novo`→azul, `em_uso`→verde, `aposentado`→
cinza, reaproveitando a paleta de status já definida em `app/globals.css`)
mantendo o aparelho neutro como está (`StatusDeCadastro` ganha uma prop
`colorido?: boolean`, chips passam `colorido`, aparelhos não passam nada).

Badge extra "Externo" (mesmo estilo de pílula, cor neutra com borda,
distinta das cores de status) aparece no card de aparelho e de chip quando
`origem = 'externa'`.

## Filtros

`/aparelhos` e `/chips` ganham um formulário GET no cabeçalho (mesmo padrão
de `searchParams` que o painel já usa para o campo de busca), com dois
`<select>`: status (valores do enum de cada tabela, mais "Todos") e origem
(própria/externa/Todos). Sem JS novo — o `<select>` manda o form junto com um
botão "Filtrar" (não há auto-submit onChange, para não introduzir componente
cliente novo só para isso).

`listarAparelhosComResumo`/`listarChipsComResumo` (`lib/queries.ts`) ganham
parâmetros opcionais `{ status?: string; origem?: string }`, aplicados como
condição a mais no `where` das queries de `account`/`chip`/`device` que já
existem — sem mudar o formato de retorno.

## Verificação

Mesma abordagem do resto do projeto: `tsc`/`lint`/`build` sem erro, os testes
existentes continuam passando (nenhum deles cobre UI/schema, e não é objetivo
adicionar teste de UI aqui), e checagem visual no navegador de cada tela
tocada — cadastro com origem, `/aparelhos` e `/chips` com filtro e os dados
novos no card, fichas com os formulários de editar/cancelar/corrigir
funcionando de ponta a ponta.

## Fora de escopo

Exclusão definitiva (hard delete) de qualquer registro. Histórico de quem
editou o quê (auditoria). Status "cancelado" distinto de "aposentado" —
decidido reaproveitar o mesmo status terminal. Regra de negócio adicional
para contas externas além de sair do sorteio de aquecimento (elas continuam
aparecendo normalmente em `/aparelhos`, `/chips`, fichas e no painel, só
marcadas). Auto-submit de filtro via JS client-side.
