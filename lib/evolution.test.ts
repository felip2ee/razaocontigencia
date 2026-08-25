import assert from "node:assert/strict"
import { afterEach, test } from "node:test"

import {
  buscarProxy,
  buscarStatusConexao,
  normalizarNumero,
  pedirQrCode,
} from "./evolution.ts"

process.env.EVOLUTION_API_URL = "http://evolution.test"
process.env.EVOLUTION_API_KEY = "chave-de-teste"

const fetchOriginal = globalThis.fetch

afterEach(() => {
  globalThis.fetch = fetchOriginal
})

function mockFetch(porCaminho: Record<string, () => Response>) {
  globalThis.fetch = (async (entrada: string | URL) => {
    const caminho = new URL(String(entrada)).pathname
    const resposta = porCaminho[caminho]
    if (!resposta) throw new Error(`Caminho não mockado: ${caminho}`)
    return resposta()
  }) as typeof fetch
}

test("normalizarNumero: remove tudo que não é dígito", () => {
  assert.equal(normalizarNumero("+55 (11) 99999-8888"), "5511999998888")
  assert.equal(normalizarNumero("5511999998888"), "5511999998888")
})

test("buscarStatusConexao: open vira aberta", async () => {
  mockFetch({
    "/instance/connectionState/5511999998888": () =>
      Response.json({ instance: { state: "open" } }),
  })
  assert.equal(await buscarStatusConexao("5511999998888"), "aberta")
})

test("buscarStatusConexao: connecting vira conectando", async () => {
  mockFetch({
    "/instance/connectionState/5511999998888": () =>
      Response.json({ instance: { state: "connecting" } }),
  })
  assert.equal(await buscarStatusConexao("5511999998888"), "conectando")
})

test("buscarStatusConexao: close vira fechada", async () => {
  mockFetch({
    "/instance/connectionState/5511999998888": () =>
      Response.json({ instance: { state: "close" } }),
  })
  assert.equal(await buscarStatusConexao("5511999998888"), "fechada")
})

test("buscarStatusConexao: erro de rede vira desconhecido", async () => {
  globalThis.fetch = (async () => {
    throw new Error("network down")
  }) as typeof fetch
  assert.equal(await buscarStatusConexao("5511999998888"), "desconhecido")
})

test("buscarStatusConexao: resposta sem instance vira desconhecido", async () => {
  mockFetch({ "/instance/connectionState/5511999998888": () => Response.json({}) })
  assert.equal(await buscarStatusConexao("5511999998888"), "desconhecido")
})

test("buscarProxy: sem proxy configurado vira sem_conexao", async () => {
  mockFetch({ "/proxy/find/5511999998888": () => Response.json({ enabled: false }) })
  assert.equal(await buscarProxy("5511999998888"), "sem_conexao")
})

test("buscarProxy: configurado e conectividade ok vira ativa", async () => {
  mockFetch({
    "/proxy/find/5511999998888": () =>
      Response.json({ host: "1.2.3.4", port: 8080, protocol: "http" }),
    "/": () => new Response("ok", { status: 200 }),
  })
  assert.equal(await buscarProxy("5511999998888"), "ativa")
})

test("buscarProxy: configurado mas conectividade falha vira inativa", async () => {
  let chamada = 0
  globalThis.fetch = (async (entrada: string | URL) => {
    const caminho = new URL(String(entrada)).pathname
    chamada++
    if (caminho === "/proxy/find/5511999998888") {
      return Response.json({ host: "1.2.3.4", port: 8080, protocol: "http" })
    }
    throw new Error("proxy indisponível")
  }) as typeof fetch
  assert.equal(await buscarProxy("5511999998888"), "inativa")
  assert.equal(chamada, 2)
})

test("pedirQrCode: devolve o base64 da resposta", async () => {
  mockFetch({
    "/instance/connect/5511999998888": () =>
      Response.json({ base64: "data:image/png;base64,ABC123" }),
  })
  assert.equal(await pedirQrCode("5511999998888"), "data:image/png;base64,ABC123")
})

test("pedirQrCode: sem base64 na resposta lança erro", async () => {
  mockFetch({ "/instance/connect/5511999998888": () => Response.json({}) })
  await assert.rejects(() => pedirQrCode("5511999998888"), /não retornou QR code/)
})
