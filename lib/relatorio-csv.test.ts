import assert from "node:assert/strict"
import { test } from "node:test"

import {
  gerarRelatorio,
  type ContaHistorica,
  type IncidenteHistorico,
} from "./relatorio.ts"
import {
  csvDoRelatorio,
  identificarTipoArquivo,
  nomeArquivoRelatorio,
  TIPOS_ARQUIVO_RELATORIO,
} from "./relatorio-csv.ts"

const geradoEm = new Date("2026-09-29T02:30:00.000Z")
const contas: ContaHistorica[] = [
  {
    id: 1,
    ativadaEm: "2026-09-01",
    slot: "A",
    chipId: "c1",
    chipNumero: "5511999990001",
    chipOperadora: "Operadora A",
    chipOrigem: "propria",
    chipStatus: "em_uso",
    deviceId: "d1",
    deviceApelido: "Principal",
    deviceOrigem: "propria",
    deviceStatus: "ativo",
  },
  {
    id: 2,
    ativadaEm: "2026-09-02",
    slot: "B",
    chipId: "c2",
    chipNumero: "5511999990002",
    chipOperadora: "Operadora B",
    chipOrigem: "externa",
    chipStatus: "em_uso",
    deviceId: "d2",
    deviceApelido: null,
    deviceOrigem: "externa",
    deviceStatus: "quarentena",
  },
]
const incidentes: IncidenteHistorico[] = [
  {
    id: 10,
    accountId: 1,
    tipo: "restricao",
    inicio: new Date("2026-09-28T12:00:00Z"),
    fim: new Date("2026-09-28T13:00:00Z"),
    resultado: "recuperada",
    notas: "liberada",
  },
  {
    id: 20,
    accountId: 1,
    tipo: "ban",
    inicio: new Date("2026-09-28T14:00:00Z"),
    fim: new Date("2026-09-28T15:00:00Z"),
    resultado: "perdida",
    notas: "sem recuperação",
  },
  {
    id: 30,
    accountId: 2,
    tipo: "ban",
    inicio: new Date("2026-09-29T02:30:00Z"),
    fim: null,
    resultado: null,
    notas: null,
  },
]
const relatorio = gerarRelatorio({ contas, incidentes }, geradoEm)

test("aceita apenas os quatro tipos de arquivo", () => {
  assert.deepEqual(TIPOS_ARQUIVO_RELATORIO, [
    "resumo",
    "chips",
    "incidentes",
    "aparelhos",
  ])
  for (const tipo of TIPOS_ARQUIVO_RELATORIO) {
    assert.equal(identificarTipoArquivo(tipo), tipo)
  }
  assert.equal(identificarTipoArquivo("segredos"), null)
  assert.equal(identificarTipoArquivo("Chips"), null)
})

test("nome usa o dia em America Sao_Paulo", () => {
  assert.equal(
    nomeArquivoRelatorio("resumo", geradoEm),
    "resumo-campanha-2026-09-28.csv"
  )
  assert.equal(
    nomeArquivoRelatorio("chips", geradoEm),
    "chips-campanha-2026-09-28.csv"
  )
})

test("resumo expoe todos os indicadores e horario de geracao", () => {
  assert.equal(
    csvDoRelatorio("resumo", relatorio),
    [
      "\uFEFFindicador;valor",
      "Gerado em;28/09/2026, 23:30:00",
      "Chips utilizados;2",
      "Chips próprios;1",
      "Chips externos;1",
      "Chips com problema;2",
      "Chips com restrição;1",
      "Chips com ban;2",
      "Chips perdidos definitivamente;1",
      "Aparelhos utilizados;2",
      "Aparelhos próprios;1",
      "Aparelhos externos;1",
      "Incidentes;3",
      "Restrições;1",
      "Bans;2",
      "",
    ].join("\r\n")
  )
})

test("chips detalham origem, agregados e perda definitiva", () => {
  assert.equal(
    csvDoRelatorio("chips", relatorio),
    [
      "\uFEFFidentificador;numero;operadora;origem;situacao;primeira_ativacao;aparelhos;contas;incidentes;restricoes;bans;perdido_definitivamente",
      "c1;5511999990001;Operadora A;Própria;em uso;01/09/2026;d1;1;2;1;1;Sim",
      "c2;5511999990002;Operadora B;Externa;em uso;02/09/2026;d2;1;1;0;1;Não",
      "",
    ].join("\r\n")
  )
})

test("incidentes detalham contexto e rotulos de ausencias", () => {
  assert.equal(
    csvDoRelatorio("incidentes", relatorio),
    [
      "\uFEFFidentificador;tipo;inicio;termino;resultado;observacoes;conta;chip;numero_chip;origem_chip;aparelho;apelido_aparelho;origem_aparelho;slot",
      "10;restrição;28/09/2026, 09:00:00;28/09/2026, 10:00:00;recuperada;liberada;1;c1;5511999990001;Própria;d1;Principal;Própria;A",
      "20;ban;28/09/2026, 11:00:00;28/09/2026, 12:00:00;perdida;sem recuperação;1;c1;5511999990001;Própria;d1;Principal;Própria;A",
      "30;ban;28/09/2026, 23:30:00;em aberto;pendente;;2;c2;5511999990002;Externa;d2;;Externa;B",
      "",
    ].join("\r\n")
  )
})

test("aparelhos detalham origem e agregados", () => {
  assert.equal(
    csvDoRelatorio("aparelhos", relatorio),
    [
      "\uFEFFidentificador;apelido;origem;situacao;chips;contas;incidentes;restricoes;bans;chips_perdidos_definitivamente",
      "d1;Principal;Própria;ativo;1;1;2;1;1;1",
      "d2;;Externa;quarentena;1;1;1;0;1;0",
      "",
    ].join("\r\n")
  )
})

test("relatorio vazio mantem apenas cabecalhos dos detalhes", () => {
  const vazio = gerarRelatorio({ contas: [], incidentes: [] }, geradoEm)
  for (const tipo of ["chips", "incidentes", "aparelhos"] as const) {
    const linhas = csvDoRelatorio(tipo, vazio).split("\r\n")
    assert.equal(linhas.length, 2)
    assert.ok(linhas[0].startsWith("\uFEFF"))
    assert.equal(linhas[1], "")
  }
})
