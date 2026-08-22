export type Categoria = "conversa" | "perfil" | "grupo" | "midia"

export type Faixa = {
  minDias: number
  maxDias: number | null
  acoesPorDia: number
}

export type AcaoCatalogo = {
  id: number
  nome: string
  categoria: Categoria
  idadeMinDias: number
  idadeMaxDias: number | null
  peso: number
}

export type ContaParaSorteio = {
  id: number
  deviceId: string
  ativadaEm: string
  diasDesdeFimDeRestricao?: number | null
}

export type Par = { a: number; b: number }

export type TarefaSorteada = {
  accountId: number
  actionId: number
  parAccountId: number | null
}

/**
 * Plano de maturação. Editar aqui é como se ajusta a operação — não há tela
 * de administração para isso, de propósito.
 */
export const FAIXAS: Faixa[] = [
  { minDias: 0, maxDias: 3, acoesPorDia: 2 },
  { minDias: 4, maxDias: 7, acoesPorDia: 5 },
  { minDias: 8, maxDias: 14, acoesPorDia: 8 },
  { minDias: 15, maxDias: 30, acoesPorDia: 12 },
  { minDias: 31, maxDias: null, acoesPorDia: 5 },
]

const DIAS_DE_RECUO_APOS_RESTRICAO = 7
const MS_POR_DIA = 86_400_000

export function idadeEmDias(ativadaEm: string, hoje: Date): number {
  const inicio = Date.parse(`${ativadaEm}T00:00:00Z`)
  const fim = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())
  return Math.max(0, Math.floor((fim - inicio) / MS_POR_DIA))
}

function indiceDaFaixa(idadeDias: number): number {
  for (let i = FAIXAS.length - 1; i >= 0; i--) {
    if (idadeDias >= FAIXAS[i].minDias) return i
  }
  return 0
}

export function faixaDe(idadeDias: number): Faixa {
  return FAIXAS[indiceDaFaixa(idadeDias)]
}

export function faixaEfetiva(
  idadeDias: number,
  diasDesdeFimDeRestricao: number | null,
): Faixa {
  const i = indiceDaFaixa(idadeDias)
  const recua =
    diasDesdeFimDeRestricao !== null &&
    diasDesdeFimDeRestricao < DIAS_DE_RECUO_APOS_RESTRICAO
  return FAIXAS[recua ? Math.max(0, i - 1) : i]
}

export function acoesElegiveis(
  catalogo: AcaoCatalogo[],
  idadeDias: number,
): AcaoCatalogo[] {
  return catalogo.filter(
    (a) =>
      idadeDias >= a.idadeMinDias &&
      (a.idadeMaxDias === null || idadeDias <= a.idadeMaxDias),
  )
}

function sortearComPeso<T extends { peso: number }>(itens: T[], rng: () => number): T {
  const total = itens.reduce((soma, i) => soma + i.peso, 0)
  let alvo = rng() * total
  for (const item of itens) {
    alvo -= item.peso
    if (alvo < 0) return item
  }
  return itens[itens.length - 1]
}

export function sortearAcoes(
  catalogo: AcaoCatalogo[],
  idadeDias: number,
  quantidade: number,
  rng: () => number,
): AcaoCatalogo[] {
  const disponiveis = [...acoesElegiveis(catalogo, idadeDias)]
  const escolhidas: AcaoCatalogo[] = []
  while (escolhidas.length < quantidade && disponiveis.length > 0) {
    const escolhida = sortearComPeso(disponiveis, rng)
    escolhidas.push(escolhida)
    disponiveis.splice(disponiveis.indexOf(escolhida), 1)
  }
  return escolhidas
}

export function escolherPar(
  conta: ContaParaSorteio,
  candidatas: ContaParaSorteio[],
  paresRecentes: Par[],
  rng: () => number,
): number | null {
  const jaConversou = (outra: number) =>
    paresRecentes.some(
      (p) =>
        (p.a === conta.id && p.b === outra) || (p.b === conta.id && p.a === outra),
    )

  const possiveis = candidatas.filter(
    (c) => c.id !== conta.id && c.deviceId !== conta.deviceId && !jaConversou(c.id),
  )
  if (possiveis.length === 0) return null
  return possiveis[Math.min(Math.floor(rng() * possiveis.length), possiveis.length - 1)].id
}

export function gerarTarefasDoDia(
  contas: ContaParaSorteio[],
  catalogo: AcaoCatalogo[],
  paresRecentes: Par[],
  hoje: Date,
  rng: () => number,
): TarefaSorteada[] {
  const tarefas: TarefaSorteada[] = []
  for (const conta of contas) {
    const idade = idadeEmDias(conta.ativadaEm, hoje)
    const faixa = faixaEfetiva(idade, conta.diasDesdeFimDeRestricao ?? null)
    for (const acao of sortearAcoes(catalogo, idade, faixa.acoesPorDia, rng)) {
      tarefas.push({
        accountId: conta.id,
        actionId: acao.id,
        parAccountId:
          acao.categoria === "conversa"
            ? escolherPar(conta, contas, paresRecentes, rng)
            : null,
      })
    }
  }
  return tarefas
}
