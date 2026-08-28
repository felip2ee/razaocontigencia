import assert from "node:assert/strict"
import { afterEach, test } from "node:test"

import {
  acharInstancia,
  buscarProxy,
  buscarStatusConexao,
  type InstanciaEvolution,
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

function inst(name: string, digitos: string[]): InstanciaEvolution {
  return { name, numero: digitos[0] ?? null, status: "aberta", digitos }
}

test("acharInstancia: casa por sufixo de dígitos (chip sem DDI, instância com)", () => {
  const instancias = [
    inst("39fernanda", ["5563992026453"]),
    inst("02- 5563981263783", ["5563981263783", "556381263783"]),
  ]
  assert.equal(acharInstancia("63981263783", instancias), "02- 5563981263783")
})

test("acharInstancia: 2+ instâncias casam → null", () => {
  const instancias = [
    inst("a", ["5563981263783"]),
    inst("b", ["553563981263783"]),
  ]
  assert.equal(acharInstancia("63981263783", instancias), null)
})

test("acharInstancia: nenhuma casa → null", () => {
  assert.equal(acharInstancia("63999999999", [inst("x", ["5563981263783"])]), null)
})

test("acharInstancia: número curto demais → null", () => {
  assert.equal(acharInstancia("12345", [inst("x", ["12345"])]), null)
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

test("buscarProxy: sem host vira sem_conexao", async () => {
  mockFetch({ "/proxy/find/5511999998888": () => Response.json({ enabled: false }) })
  assert.equal(await buscarProxy("5511999998888"), "sem_conexao")
})

test("buscarProxy: host com enabled vira ativa", async () => {
  mockFetch({
    "/proxy/find/5511999998888": () =>
      Response.json({ enabled: true, host: "proxy.x.com", port: "8080" }),
  })
  assert.equal(await buscarProxy("5511999998888"), "ativa")
})

test("buscarProxy: host com enabled:false vira inativa", async () => {
  mockFetch({
    "/proxy/find/5511999998888": () =>
      Response.json({ enabled: false, host: "proxy.x.com", port: "8080" }),
  })
  assert.equal(await buscarProxy("5511999998888"), "inativa")
})

test("buscarProxy: erro de rede vira sem_conexao, não lança", async () => {
  globalThis.fetch = (async () => {
    throw new Error("network down")
  }) as typeof fetch
  assert.equal(await buscarProxy("5511999998888"), "sem_conexao")
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
