import assert from "node:assert/strict"
import { test } from "node:test"

import { responderDownloadRelatorio } from "./relatorio-download.ts"
import { gerarRelatorio } from "./relatorio.ts"

const relatorio = gerarRelatorio(
  { contas: [], incidentes: [] },
  new Date("2026-09-29T02:30:00.000Z"),
)

test("tipo invalido devolve 404 sem chamar o carregador", async () => {
  let chamadas = 0
  const resposta = await responderDownloadRelatorio("invalido", async () => {
    chamadas++
    return relatorio
  })

  assert.equal(resposta.status, 404)
  assert.equal(chamadas, 0)
})

test("sucesso devolve csv completo e headers de download", async () => {
  const resposta = await responderDownloadRelatorio("resumo", async () => relatorio)

  assert.equal(resposta.status, 200)
  assert.equal(resposta.headers.get("content-type"), "text/csv; charset=utf-8")
  assert.equal(
    resposta.headers.get("content-disposition"),
    'attachment; filename="resumo-campanha-2026-09-28.csv"',
  )
  assert.equal(resposta.headers.get("cache-control"), "no-store")
  assert.equal(
    new TextDecoder("utf-8", { ignoreBOM: true }).decode(await resposta.arrayBuffer()),
    [
      "\uFEFFindicador;valor",
      "Gerado em;28/09/2026, 23:30:00",
      "Chips utilizados;0",
      "Chips próprios;0",
      "Chips externos;0",
      "Chips com problema;0",
      "Chips com restrição;0",
      "Chips com ban;0",
      "Chips perdidos definitivamente;0",
      "Aparelhos utilizados;0",
      "Aparelhos próprios;0",
      "Aparelhos externos;0",
      "Incidentes;0",
      "Restrições;0",
      "Bans;0",
      "",
    ].join("\r\n"),
  )
})

test("falha do carregador devolve 500 sem csv nem detalhe interno", async () => {
  const erro = new Error("senha-interna")
  const consoleErrorOriginal = console.error
  const errosRegistrados: unknown[][] = []
  console.error = (...argumentos: unknown[]) => {
    errosRegistrados.push(argumentos)
  }

  try {
    const resposta = await responderDownloadRelatorio("chips", async () => {
      throw erro
    })

    assert.equal(resposta.status, 500)
    assert.equal(resposta.headers.get("content-type"), "text/plain; charset=utf-8")
    assert.doesNotMatch(await resposta.text(), /senha-interna|identificador;/)
    assert.ok(errosRegistrados.some((argumentos) => argumentos.includes(erro)))
  } finally {
    console.error = consoleErrorOriginal
  }
})
