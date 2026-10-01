import { serializarCsv, type ValorCsv } from "./csv.ts"
import type { Origem, RelatorioCampanha } from "./relatorio.ts"

export const TIPOS_ARQUIVO_RELATORIO = [
  "resumo",
  "chips",
  "incidentes",
  "aparelhos",
] as const

export type TipoArquivoRelatorio = (typeof TIPOS_ARQUIVO_RELATORIO)[number]

const fuso = "America/Sao_Paulo"
const formatoData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: fuso,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})
const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: fuso,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})
const formatoNome = new Intl.DateTimeFormat("en-CA", {
  timeZone: fuso,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function origemLegivel(origem: Origem): string {
  return origem === "propria" ? "Própria" : "Externa"
}

function situacaoLegivel(situacao: string): string {
  return situacao.replaceAll("_", " ")
}

function dataCivil(valor: string): string {
  return formatoData.format(new Date(`${valor}T12:00:00.000Z`))
}

export function identificarTipoArquivo(
  valor: string
): TipoArquivoRelatorio | null {
  return TIPOS_ARQUIVO_RELATORIO.find((tipo) => tipo === valor) ?? null
}

export function nomeArquivoRelatorio(
  tipo: TipoArquivoRelatorio,
  geradoEm: Date
): string {
  const partes = Object.fromEntries(
    formatoNome.formatToParts(geradoEm).map(({ type, value }) => [type, value])
  )
  return `${tipo}-campanha-${partes.year}-${partes.month}-${partes.day}.csv`
}

export function csvDoRelatorio(
  tipo: TipoArquivoRelatorio,
  relatorio: RelatorioCampanha
): string {
  if (tipo === "resumo") {
    const resumo = relatorio.resumo
    return serializarCsv(
      ["indicador", "valor"],
      [
        ["Gerado em", formatoDataHora.format(relatorio.geradoEm)],
        ["Chips utilizados", resumo.chipsUtilizados],
        ["Chips próprios", resumo.chipsProprios],
        ["Chips externos", resumo.chipsExternos],
        ["Chips com problema", resumo.chipsComProblema],
        ["Chips com restrição", resumo.chipsComRestricao],
        ["Chips com ban", resumo.chipsComBan],
        ["Chips perdidos definitivamente", resumo.chipsPerdidos],
        ["Aparelhos utilizados", resumo.aparelhosUtilizados],
        ["Aparelhos próprios", resumo.aparelhosProprios],
        ["Aparelhos externos", resumo.aparelhosExternos],
        ["Incidentes", resumo.incidentes],
        ["Restrições", resumo.restricoes],
        ["Bans", resumo.bans],
      ]
    )
  }

  if (tipo === "chips") {
    return serializarCsv(
      [
        "identificador",
        "numero",
        "operadora",
        "origem",
        "situacao",
        "primeira_ativacao",
        "aparelhos",
        "contas",
        "incidentes",
        "restricoes",
        "bans",
        "perdido_definitivamente",
      ],
      relatorio.chips.map((chip): ValorCsv[] => [
        chip.id,
        chip.numero,
        chip.operadora,
        origemLegivel(chip.origem),
        situacaoLegivel(chip.status),
        dataCivil(chip.primeiraAtivacao),
        [...chip.aparelhos].sort().join(", "),
        chip.contas,
        chip.incidentes,
        chip.restricoes,
        chip.bans,
        chip.perdido ? "Sim" : "Não",
      ])
    )
  }

  if (tipo === "incidentes") {
    return serializarCsv(
      [
        "identificador",
        "tipo",
        "inicio",
        "termino",
        "resultado",
        "observacoes",
        "conta",
        "chip",
        "numero_chip",
        "origem_chip",
        "aparelho",
        "apelido_aparelho",
        "origem_aparelho",
        "slot",
      ],
      relatorio.incidentes.map((incidente): ValorCsv[] => [
        incidente.id,
        incidente.tipo === "restricao" ? "restrição" : "ban",
        formatoDataHora.format(incidente.inicio),
        incidente.fim ? formatoDataHora.format(incidente.fim) : "em aberto",
        incidente.resultado ?? "pendente",
        incidente.notas,
        incidente.accountId,
        incidente.chipId,
        incidente.chipNumero,
        origemLegivel(incidente.chipOrigem),
        incidente.deviceId,
        incidente.deviceApelido,
        origemLegivel(incidente.deviceOrigem),
        incidente.slot,
      ])
    )
  }

  return serializarCsv(
    [
      "identificador",
      "apelido",
      "origem",
      "situacao",
      "chips",
      "contas",
      "incidentes",
      "restricoes",
      "bans",
      "chips_perdidos_definitivamente",
    ],
    relatorio.aparelhos.map((aparelho): ValorCsv[] => [
      aparelho.id,
      aparelho.apelido,
      origemLegivel(aparelho.origem),
      situacaoLegivel(aparelho.status),
      aparelho.chips,
      aparelho.contas,
      aparelho.incidentes,
      aparelho.restricoes,
      aparelho.bans,
      aparelho.chipsPerdidos,
    ])
  )
}
