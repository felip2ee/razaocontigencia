export type Origem = "propria" | "externa"

export type ContaHistorica = {
  id: number
  ativadaEm: string
  slot: string
  chipId: string
  chipNumero: string
  chipOperadora: string
  chipOrigem: Origem
  chipStatus: "novo" | "em_uso" | "aposentado"
  deviceId: string
  deviceApelido: string | null
  deviceOrigem: Origem
  deviceStatus: "ativo" | "quarentena" | "aposentado"
}

export type IncidenteHistorico = {
  id: number
  accountId: number
  tipo: "restricao" | "ban"
  inicio: Date
  fim: Date | null
  resultado: "pendente" | "recuperada" | "perdida" | null
  notas: string | null
}

export type DadosRelatorio = {
  contas: readonly ContaHistorica[]
  incidentes: readonly IncidenteHistorico[]
}

export type ResumoRelatorio = {
  chipsUtilizados: number
  chipsProprios: number
  chipsExternos: number
  chipsComProblema: number
  chipsComRestricao: number
  chipsComBan: number
  chipsPerdidos: number
  aparelhosUtilizados: number
  aparelhosProprios: number
  aparelhosExternos: number
  incidentes: number
  restricoes: number
  bans: number
}

export type ChipRelatorio = {
  id: string
  numero: string
  operadora: string
  origem: Origem
  status: "novo" | "em_uso" | "aposentado"
  primeiraAtivacao: string
  aparelhos: readonly string[]
  contas: number
  incidentes: number
  restricoes: number
  bans: number
  perdido: boolean
}

export type IncidenteRelatorio = IncidenteHistorico & {
  chipId: string
  chipNumero: string
  chipOrigem: Origem
  deviceId: string
  deviceApelido: string | null
  deviceOrigem: Origem
  slot: string
}

export type AparelhoRelatorio = {
  id: string
  apelido: string | null
  origem: Origem
  status: "ativo" | "quarentena" | "aposentado"
  chips: number
  contas: number
  incidentes: number
  restricoes: number
  bans: number
  chipsPerdidos: number
}

export type RelatorioCampanha = {
  geradoEm: Date
  resumo: ResumoRelatorio
  chips: readonly ChipRelatorio[]
  incidentes: readonly IncidenteRelatorio[]
  aparelhos: readonly AparelhoRelatorio[]
}

type ChipAcumulado = {
  relatorio: ChipRelatorio
  aparelhos: Set<string>
}

type AparelhoAcumulado = {
  relatorio: AparelhoRelatorio
  chips: Set<string>
}

export function gerarRelatorio(
  dados: DadosRelatorio,
  geradoEm: Date = new Date(),
): RelatorioCampanha {
  const contasPorId = new Map<number, ContaHistorica>()
  const chipsPorId = new Map<string, ChipAcumulado>()
  const aparelhosPorId = new Map<string, AparelhoAcumulado>()

  for (const conta of dados.contas) {
    contasPorId.set(conta.id, conta)

    let chip = chipsPorId.get(conta.chipId)
    if (!chip) {
      chip = {
        relatorio: {
          id: conta.chipId,
          numero: conta.chipNumero,
          operadora: conta.chipOperadora,
          origem: conta.chipOrigem,
          status: conta.chipStatus,
          primeiraAtivacao: conta.ativadaEm,
          aparelhos: [],
          contas: 0,
          incidentes: 0,
          restricoes: 0,
          bans: 0,
          perdido: false,
        },
        aparelhos: new Set<string>(),
      }
      chipsPorId.set(conta.chipId, chip)
    }
    chip.relatorio.contas++
    chip.aparelhos.add(conta.deviceId)
    if (conta.ativadaEm < chip.relatorio.primeiraAtivacao) {
      chip.relatorio.primeiraAtivacao = conta.ativadaEm
    }

    let aparelho = aparelhosPorId.get(conta.deviceId)
    if (!aparelho) {
      aparelho = {
        relatorio: {
          id: conta.deviceId,
          apelido: conta.deviceApelido,
          origem: conta.deviceOrigem,
          status: conta.deviceStatus,
          chips: 0,
          contas: 0,
          incidentes: 0,
          restricoes: 0,
          bans: 0,
          chipsPerdidos: 0,
        },
        chips: new Set<string>(),
      }
      aparelhosPorId.set(conta.deviceId, aparelho)
    }
    aparelho.relatorio.contas++
    aparelho.chips.add(conta.chipId)
  }

  const incidentes: IncidenteRelatorio[] = dados.incidentes.map((incidente) => {
    const conta = contasPorId.get(incidente.accountId)
    if (!conta) {
      throw new Error(`Conta ${incidente.accountId} não encontrada para incidente ${incidente.id}`)
    }

    const chip = chipsPorId.get(conta.chipId)!.relatorio
    const aparelho = aparelhosPorId.get(conta.deviceId)!.relatorio
    chip.incidentes++
    aparelho.incidentes++
    if (incidente.tipo === "restricao") {
      chip.restricoes++
      aparelho.restricoes++
    } else {
      chip.bans++
      aparelho.bans++
    }
    if (incidente.resultado === "perdida") chip.perdido = true

    return {
      ...incidente,
      chipId: conta.chipId,
      chipNumero: conta.chipNumero,
      chipOrigem: conta.chipOrigem,
      deviceId: conta.deviceId,
      deviceApelido: conta.deviceApelido,
      deviceOrigem: conta.deviceOrigem,
      slot: conta.slot,
    }
  })

  const chips = [...chipsPorId.values()]
    .map(({ relatorio, aparelhos }) => ({
      ...relatorio,
      aparelhos: [...aparelhos].sort(),
    }))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

  const aparelhos = [...aparelhosPorId.values()]
    .map(({ relatorio, chips: chipsDoAparelho }) => ({
      ...relatorio,
      chips: chipsDoAparelho.size,
      chipsPerdidos: [...chipsDoAparelho].filter((id) => chipsPorId.get(id)!.relatorio.perdido).length,
    }))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

  incidentes.sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.id - b.id)

  return {
    geradoEm: new Date(geradoEm),
    resumo: {
      chipsUtilizados: chips.length,
      chipsProprios: chips.filter((chip) => chip.origem === "propria").length,
      chipsExternos: chips.filter((chip) => chip.origem === "externa").length,
      chipsComProblema: chips.filter((chip) => chip.incidentes > 0).length,
      chipsComRestricao: chips.filter((chip) => chip.restricoes > 0).length,
      chipsComBan: chips.filter((chip) => chip.bans > 0).length,
      chipsPerdidos: chips.filter((chip) => chip.perdido).length,
      aparelhosUtilizados: aparelhos.length,
      aparelhosProprios: aparelhos.filter((aparelho) => aparelho.origem === "propria").length,
      aparelhosExternos: aparelhos.filter((aparelho) => aparelho.origem === "externa").length,
      incidentes: incidentes.length,
      restricoes: incidentes.filter((incidente) => incidente.tipo === "restricao").length,
      bans: incidentes.filter((incidente) => incidente.tipo === "ban").length,
    },
    chips,
    incidentes,
    aparelhos,
  }
}
