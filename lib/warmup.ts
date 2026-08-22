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

/**
 * A data de hoje no fuso do processo, em ISO. Única fonte da data corrente:
 * `ativadaEm` vem de um `<input type="date">` local, então usar UTC faria o
 * dia virar às 21h num fuso UTC-3 e sortear o aquecimento de amanhã.
 */
export function hojeISO(agora: Date = new Date()): string {
  const doisDigitos = (n: number) => String(n).padStart(2, "0")
  return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`
}

export function idadeEmDias(ativadaEm: string, hoje: Date): number {
  const [ano, mes, dia] = ativadaEm.split("-").map(Number)
  const inicio = new Date(ano, mes - 1, dia).getTime()
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()
  // round, não floor: o horário de verão pode encurtar ou esticar um dia.
  return Math.max(0, Math.round((fim - inicio) / MS_POR_DIA))
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

/**
 * `candidatasAPar` são todas as contas saudáveis do dia, não só as que ainda
 * não têm tarefa: quem é ativado depois da primeira geração do dia precisa
 * sortear par contra a frota inteira, senão fica sem par.
 */
export function gerarTarefasDoDia(
  contas: ContaParaSorteio[],
  catalogo: AcaoCatalogo[],
  paresRecentes: Par[],
  hoje: Date,
  rng: () => number,
  candidatasAPar: ContaParaSorteio[] = contas,
): TarefaSorteada[] {
  const tarefas: TarefaSorteada[] = []
  // Os pares sorteados aqui contam como recentes para as escolhas seguintes,
  // senão a mesma dupla se repete em várias conversas do mesmo dia.
  const pares = [...paresRecentes]

  for (const conta of contas) {
    const idade = idadeEmDias(conta.ativadaEm, hoje)
    const faixa = faixaEfetiva(idade, conta.diasDesdeFimDeRestricao ?? null)
    // O recuo pós-restrição vale para o par inteiro (o que libera, quantas por
    // dia): a conta que voltou não faz as ações da faixa alta, só menos delas.
    const idadeElegivel = Math.min(idade, faixa.maxDias ?? idade)

    for (const acao of sortearAcoes(catalogo, idadeElegivel, faixa.acoesPorDia, rng)) {
      let parAccountId: number | null = null
      if (acao.categoria === "conversa") {
        parAccountId = escolherPar(conta, candidatasAPar, pares, rng)
        if (parAccountId !== null) pares.push({ a: conta.id, b: parAccountId })
      }
      tarefas.push({ accountId: conta.id, actionId: acao.id, parAccountId })
    }
  }
  return tarefas
}
