# Reativar chip, editar origem, ativar conta sem colisão — design

Data: 2026-08-27
Status: aprovado para planejamento

## Contexto

Três lacunas que sobraram do trabalho anterior (origem externa, edição,
cancelamento, filtros): cancelar um chip por engano não tem volta pela UI
(só reaposentado, sem botão de reativar); a origem de um chip/aparelho
digitada errada no cadastro não pode ser corrigida depois (só
número/operadora/apelido/notas são editáveis); e o formulário "Ativar
conta" em `/cadastro` deixa escolher um aparelho sem vaga ou um slot já
ocupado, produzindo um erro de constraint em vez de simplesmente não
oferecer a opção errada.

## Escopo

Ação de reativar chip (aposentado → novo). Campo de origem nos formulários
de editar chip e editar aparelho que já existem. Formulário de "Ativar
conta" reduzido a dois campos (destino aparelho+slot combinados, chip) em
vez de três, mostrando só combinações realmente disponíveis.

Fora de escopo: reativar conta continua sem ação própria — o chip liberado
por `cancelarConta` (que já grava `chip.status = 'novo'`) volta a aparecer
em `chipsLivres()` e o operador usa o formulário "Ativar conta" normal para
recriar a conta, exatamente como ativaria qualquer chip livre. Nenhuma
mudança em `moverChip`, `resolverBan`, incidentes ou aquecimento.

## Reativar chip

Nova server action, no padrão simples de `mudarStatusDoAparelho` (não há
falha esperada — reativar um chip não colide com nada):

```ts
export async function reativarChip(formData: FormData) {
  await db
    .update(chip)
    .set({ status: "novo" })
    .where(eq(chip.id, texto(formData, "chipId")))
  refresh()
}
```

UI: `ReativarChip` em `components/chip-form.tsx`, um botão que só aparece
na ficha do chip quando `ficha.chip.status === 'aposentado'` — ao lado de
onde `CancelarChip` aparece hoje (que, por simetria, só faz sentido quando
o chip **não** está aposentado; a ficha mostra um botão ou outro, nunca os
dois).

## Editar origem

`editarChip`/`editarAparelho` (`lib/actions.ts`) ganham o campo `origem`
no `.set(...)`, do mesmo jeito que `criarChip`/`criarAparelho` já gravam:

```ts
// editarChip:
.set({
  numero: texto(formData, "numero"),
  operadora: texto(formData, "operadora"),
  origem: texto(formData, "origem") as "propria" | "externa",
})

// editarAparelho:
.set({
  apelido: textoOpcional(formData, "apelido"),
  notas: textoOpcional(formData, "notas"),
  origem: texto(formData, "origem") as "propria" | "externa",
})
```

UI: `EditarChip`/`EditarAparelho` (`components/chip-form.tsx`,
`components/aparelho-form.tsx`) ganham a prop `origem` e o mesmo
`<select name="origem">` já usado no cadastro (`própria`/`externa`, com
`defaultValue={origem}` em vez de deixar sem valor — aqui, ao contrário do
cadastro, tem um valor atual pra pré-selecionar).

## Ativar conta sem colisão

Nova query em `lib/queries.ts`:

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

`ativarConta` (`lib/actions.ts`) passa a receber um campo único `destino`
(formato `"<deviceId>|<slot>"`) em vez de `deviceId`/`slot` separados,
separando os dois antes de gravar:

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

A constraint `account_slot_ativo` continua como rede de segurança para o
caso raro de corrida (dois operadores ativando ao mesmo tempo no mesmo
slot) — a mensagem já existe em `MENSAGEM_DA_CONSTRAINT`.

UI (`app/cadastro/page.tsx`): os dois `<select>` de "Aparelho" e "Slot"
viram um só, `name="destino"`, populado por `slotsLivres()`:

```tsx
<select id="co-destino" name="destino" required ...>
  {livres.map((l) => (
    <option key={`${l.deviceId}|${l.slot}`} value={`${l.deviceId}|${l.slot}`}>
      {l.deviceId} {l.apelido ? `— ${l.apelido}` : ""} — {NOME_DO_SLOT[l.slot]}
    </option>
  ))}
</select>
```

Quando `livres.length === 0`, o select fica vazio — mostrar uma linha de
texto no lugar ("Nenhuma vaga livre em nenhum aparelho ativo.") em vez de
um select sem opções, mesmo padrão que `moverChip` já usa quando não há
aparelho ativo para bandeja. A busca de `aparelhos`/`device` que hoje
alimenta o select de "Aparelho" sai da página (não é mais usada por nada
nela) — os imports de `db`/`device`/`asc`/`eq` no topo de
`app/cadastro/page.tsx` saem junto se ficarem sem uso.

## Verificação

Mesma abordagem do resto do projeto: `tsc`/`lint`/`build` sem erro, os
testes existentes continuam passando, e checagem visual no navegador —
reativar um chip cancelado e confirmar que ele volta a `chipsLivres()`;
editar a origem de um chip/aparelho e confirmar que persiste e reflete nos
badges/filtros já existentes; ativar uma conta pelo select combinado e
confirmar que o aparelho lotado não aparece e que o slot escolhido bate
com o que foi gravado.

## Fora de escopo

Reativar conta como ação própria (usa o fluxo de ativar conta de novo,
como descrito acima). Mudança em `moverChip`, `resolverBan`,
`corrigirAparelho`. Qualquer JS client-side para dependência dinâmica
entre campos — o select combinado resolve isso no servidor.
