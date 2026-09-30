import assert from "node:assert/strict"
import { test } from "node:test"

import { gerarRelatorio, type ContaHistorica, type IncidenteHistorico } from "./relatorio.ts"

const geradoEm = new Date("2026-09-28T12:00:00.000Z")

const contas: ContaHistorica[] = [
  {
    id: 2, ativadaEm: "2026-09-03", slot: "B", chipId: "c1", chipNumero: "5511999990001",
    chipOperadora: "Operadora A", chipOrigem: "propria", chipStatus: "em_uso",
    deviceId: "d2", deviceApelido: "Reserva", deviceOrigem: "externa", deviceStatus: "ativo",
  },
  {
    id: 3, ativadaEm: "2026-09-02", slot: "A", chipId: "c2", chipNumero: "5511999990002",
    chipOperadora: "Operadora B", chipOrigem: "externa", chipStatus: "em_uso",
    deviceId: "d1", deviceApelido: "Principal", deviceOrigem: "propria", deviceStatus: "ativo",
  },
  {
    id: 1, ativadaEm: "2026-09-01", slot: "A", chipId: "c1", chipNumero: "5511999990001",
    chipOperadora: "Operadora A", chipOrigem: "propria", chipStatus: "em_uso",
    deviceId: "d1", deviceApelido: "Principal", deviceOrigem: "propria", deviceStatus: "ativo",
  },
]

const incidentes: IncidenteHistorico[] = [
  { id: 30, accountId: 3, tipo: "ban", inicio: new Date("2026-09-10T10:00:00Z"), fim: null, resultado: null, notas: null },
  { id: 20, accountId: 2, tipo: "ban", inicio: new Date("2026-09-08T10:00:00Z"), fim: new Date("2026-09-09T10:00:00Z"), resultado: "perdida", notas: "sem recuperação" },
  { id: 10, accountId: 1, tipo: "restricao", inicio: new Date("2026-09-08T10:00:00Z"), fim: new Date("2026-09-08T12:00:00Z"), resultado: "recuperada", notas: "liberada" },
]

const relatorio = gerarRelatorio({ contas, incidentes }, geradoEm)

test("deduplica recursos e distingue chips afetados de ocorrencias", () => {
  assert.deepEqual(relatorio.resumo, {
    chipsUtilizados: 2,
    chipsProprios: 1,
    chipsExternos: 1,
    chipsComProblema: 2,
    chipsComRestricao: 1,
    chipsComBan: 2,
    chipsPerdidos: 1,
    aparelhosUtilizados: 2,
    aparelhosProprios: 1,
    aparelhosExternos: 1,
    incidentes: 3,
    restricoes: 1,
    bans: 2,
  })
})

test("agrega associacoes e incidentes por chip e aparelho", () => {
  const chipC1 = relatorio.chips.find((chip) => chip.id === "c1")!
  const aparelhoD1 = relatorio.aparelhos.find((aparelho) => aparelho.id === "d1")!
  const aparelhoD2 = relatorio.aparelhos.find((aparelho) => aparelho.id === "d2")!

  assert.deepEqual(chipC1.aparelhos, ["d1", "d2"])
  assert.equal(chipC1.contas, 2)
  assert.equal(chipC1.incidentes, 2)
  assert.equal(chipC1.restricoes, 1)
  assert.equal(chipC1.bans, 1)
  assert.equal(chipC1.perdido, true)
  assert.equal(aparelhoD1.chips, 2)
  assert.equal(aparelhoD1.contas, 2)
  assert.equal(aparelhoD1.incidentes, 2)
  assert.equal(aparelhoD1.restricoes, 1)
  assert.equal(aparelhoD1.bans, 1)
  assert.equal(aparelhoD1.chipsPerdidos, 1)
  assert.equal(aparelhoD2.chipsPerdidos, 1)
})

test("mantem contexto e estado de incidente aberto", () => {
  const banAberto = relatorio.incidentes.find((incidente) => incidente.id === 30)!
  assert.equal(banAberto.fim, null)
  assert.equal(banAberto.resultado, null)
  assert.equal(banAberto.chipId, "c2")
  assert.equal(banAberto.chipNumero, "5511999990002")
  assert.equal(banAberto.chipOrigem, "externa")
  assert.equal(banAberto.deviceId, "d1")
  assert.equal(banAberto.deviceApelido, "Principal")
  assert.equal(banAberto.deviceOrigem, "propria")
  assert.equal(banAberto.slot, "A")
})

test("ordena recursos e incidentes e usa a primeira ativacao do chip", () => {
  assert.deepEqual(relatorio.chips.map((chip) => chip.id), ["c1", "c2"])
  assert.deepEqual(relatorio.aparelhos.map((aparelho) => aparelho.id), ["d1", "d2"])
  assert.deepEqual(relatorio.incidentes.map((incidente) => incidente.id), [10, 20, 30])
  assert.equal(relatorio.chips[0].primeiraAtivacao, "2026-09-01")
  assert.deepEqual(relatorio.chips[0].aparelhos, ["d1", "d2"])
})

test("copia a data de geracao", () => {
  assert.equal(relatorio.geradoEm.getTime(), geradoEm.getTime())
  assert.notEqual(relatorio.geradoEm, geradoEm)
})

test("gera relatorio vazio com zeros e listas vazias", () => {
  const vazio = gerarRelatorio({ contas: [], incidentes: [] }, geradoEm)
  assert.deepEqual(vazio.resumo, {
    chipsUtilizados: 0, chipsProprios: 0, chipsExternos: 0, chipsComProblema: 0,
    chipsComRestricao: 0, chipsComBan: 0, chipsPerdidos: 0,
    aparelhosUtilizados: 0, aparelhosProprios: 0, aparelhosExternos: 0,
    incidentes: 0, restricoes: 0, bans: 0,
  })
  assert.deepEqual(vazio.chips, [])
  assert.deepEqual(vazio.incidentes, [])
  assert.deepEqual(vazio.aparelhos, [])
})

test("rejeita incidente sem conta correspondente", () => {
  assert.throws(
    () => gerarRelatorio({ contas, incidentes: [{ ...incidentes[0], accountId: 999 }] }, geradoEm),
    /999/,
  )
})
