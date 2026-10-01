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
      "'c1;'5511999990001;Operadora A;Própria;em uso;01/09/2026;'d1;1;2;1;1;Sim",
      "'c2;'5511999990002;Operadora B;Externa;em uso;02/09/2026;'d2;1;1;0;1;Não",
      "",
    ].join("\r\n")
  )
})

test("incidentes detalham contexto e rotulos de ausencias", () => {
  assert.equal(
    csvDoRelatorio("incidentes", relatorio),
    [
      "\uFEFFidentificador;tipo;inicio;termino;resultado;observacoes;conta;chip;numero_chip;origem_chip;aparelho;apelido_aparelho;origem_aparelho;slot",
      "'10;restrição;28/09/2026, 09:00:00;28/09/2026, 10:00:00;recuperada;liberada;'1;'c1;'5511999990001;Própria;'d1;Principal;Própria;A",
      "'20;ban;28/09/2026, 11:00:00;28/09/2026, 12:00:00;perdida;sem recuperação;'1;'c1;'5511999990001;Própria;'d1;Principal;Própria;A",
      "'30;ban;28/09/2026, 23:30:00;em aberto;pendente;;'2;'c2;'5511999990002;Externa;'d2;;Externa;B",
      "",
    ].join("\r\n")
  )
})

test("aparelhos detalham origem e agregados", () => {
  assert.equal(
    csvDoRelatorio("aparelhos", relatorio),
    [
      "\uFEFFidentificador;apelido;origem;situacao;chips;contas;incidentes;restricoes;bans;chips_perdidos_definitivamente",
      "'d1;Principal;Própria;ativo;1;1;2;1;1;1",
      "'d2;;Externa;quarentena;1;1;1;0;1;0",
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

for (const valor of ["01", "1", "011999990001", "12345678901234567"]) {
  test(`preserva ${valor} como texto em todos os identificadores e telefones`, () => {
    const dados = gerarRelatorio(
      {
        contas: [
          { ...contas[0], chipId: valor, chipNumero: valor, deviceId: valor },
        ],
        incidentes: [incidentes[0]],
      },
      geradoEm
    )
    // These fixture fields contain no CSV delimiters; inspect emitted cells,
    // including the literal text marker, rather than only the domain values.
    const chips = csvDoRelatorio("chips", dados).split("\r\n")[1].split(";")
    const eventos = csvDoRelatorio("incidentes", dados)
      .split("\r\n")[1]
      .split(";")
    const aparelhos = csvDoRelatorio("aparelhos", dados)
      .split("\r\n")[1]
      .split(";")
    assert.deepEqual(
      [chips[0], chips[1], chips[6]],
      [`'${valor}`, `'${valor}`, `'${valor}`]
    )
    assert.deepEqual(
      [eventos[0], eventos[6], eventos[7], eventos[8], eventos[10]],
      ["'10", "'1", `'${valor}`, `'${valor}`, `'${valor}`]
    )
    assert.equal(aparelhos[0], `'${valor}`)
    assert.deepEqual(chips.slice(7, 11), ["1", "1", "1", "0"])
    assert.deepEqual(aparelhos.slice(4), ["1", "1", "1", "1", "0", "0"])
    assert.ok(
      csvDoRelatorio("resumo", dados).includes("Chips utilizados;1\r\n")
    )
  })
}

for (const valor of ["=1+1", "+cmd", "-12", " @cmd", "\t=1+1"]) {
  test(`neutraliza texto gerencial perigoso ${JSON.stringify(valor)} em cada CSV`, () => {
    const dados = gerarRelatorio(
      {
        contas: [
          {
            ...contas[0],
            chipId: valor,
            chipNumero: valor,
            chipOperadora: valor,
            deviceId: valor,
            deviceApelido: valor,
          },
        ],
        incidentes: [{ ...incidentes[0], notas: valor }],
      },
      geradoEm
    )
    const chips = csvDoRelatorio("chips", dados).split("\r\n")[1].split(";")
    const eventos = csvDoRelatorio("incidentes", dados)
      .split("\r\n")[1]
      .split(";")
    const aparelhos = csvDoRelatorio("aparelhos", dados)
      .split("\r\n")[1]
      .split(";")
    for (const campo of [
      chips[0],
      chips[1],
      chips[2],
      chips[6],
      eventos[5],
      eventos[7],
      eventos[8],
      eventos[10],
      eventos[11],
      aparelhos[0],
      aparelhos[1],
    ]) {
      assert.equal(campo, `'${valor}`)
    }
  })
}

test("escapa identificadores com aspas e separadores mantendo a neutralizacao", () => {
  const valor = '=HYPERLINK("https://example.invalid";"abrir")'
  const dados = gerarRelatorio(
    {
      contas: [
        { ...contas[0], chipId: valor, chipNumero: valor, deviceId: valor },
      ],
      incidentes: [incidentes[0]],
    },
    geradoEm
  )
  const campo = `"'=HYPERLINK(""https://example.invalid"";""abrir"")"`
  for (const tipo of ["chips", "incidentes", "aparelhos"] as const) {
    assert.ok(csvDoRelatorio(tipo, dados).includes(campo))
  }
})
