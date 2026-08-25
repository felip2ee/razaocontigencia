import assert from "node:assert/strict"
import http from "node:http"
import type { AddressInfo } from "node:net"
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

test("buscarProxy: dados de proxy malformados (URL inválida) vira inativa, não lança", async () => {
  mockFetch({
    "/proxy/find/5511999998888": () =>
      Response.json({ host: "proxy inválido", port: "not-a-port", protocol: "não-http" }),
  })
  assert.equal(await buscarProxy("5511999998888"), "inativa")
})

/** Proxy HTTP mínimo: reencaminha o request pra URL absoluta pedida.
 * Simula um proxy de verdade (o operador configura um na Evolution) —
 * é isto que a `ProxyAgent`/dispatcher precisa atravessar de fato.
 *
 * `testarProxy` faz a chamada de conectividade com o fetch do próprio undici
 * (não o fetch global), então essas duas continuam mockando só o global fetch
 * pra `/proxy/find` — a etapa de conectividade em si atravessa rede de
 * verdade contra um proxy e um alvo locais, exatamente como Critical 2 pede. */
function criarProxyHttp(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const alvo = new URL(req.url ?? "")
      const proxyReq = http.request(
        {
          hostname: alvo.hostname,
          port: alvo.port,
          path: alvo.pathname + alvo.search,
          method: req.method,
          headers: req.headers,
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
          proxyRes.pipe(res)
        },
      )
      req.pipe(proxyReq)
    })
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: (server.address() as AddressInfo).port })
    })
  })
}

test("buscarProxy: atravessa de fato um proxy HTTP real via ProxyAgent (não mocka o transporte)", async () => {
  const { server: proxy, port: proxyPort } = await criarProxyHttp()
  const alvo = http.createServer((req, res) => {
    if (req.url === "/proxy/find/5511999998888") {
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify({ host: "127.0.0.1", port: proxyPort, protocol: "http" }))
      return
    }
    res.end("ok")
  })
  await new Promise<void>((resolve) => alvo.listen(0, "127.0.0.1", () => resolve()))
  const alvoPort = (alvo.address() as AddressInfo).port
  const urlOriginal = process.env.EVOLUTION_API_URL
  process.env.EVOLUTION_API_URL = `http://127.0.0.1:${alvoPort}`

  try {
    // Se testarProxy voltar a usar o fetch global em vez do fetch do undici,
    // o dispatcher da ProxyAgent não funciona com o fetch global (versões
    // incompatíveis de undici) e isto cai pra "inativa".
    assert.equal(await buscarProxy("5511999998888"), "ativa")
  } finally {
    process.env.EVOLUTION_API_URL = urlOriginal
    await new Promise((resolve) => alvo.close(resolve))
    await new Promise((resolve) => proxy.close(resolve))
  }
})

test("buscarProxy: proxy configurado mas inalcançável vira inativa", async () => {
  // Porta fechada de propósito: conexão recusada rápido, sem depender de IP
  // não roteável (que pendura no timeout de 5s do testarProxy).
  const { server: portaFechada, port: proxyPort } = await criarProxyHttp()
  await new Promise((resolve) => portaFechada.close(resolve))

  const alvo = http.createServer((req, res) => {
    if (req.url === "/proxy/find/5511999998888") {
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify({ host: "127.0.0.1", port: proxyPort, protocol: "http" }))
      return
    }
    res.end("ok")
  })
  await new Promise<void>((resolve) => alvo.listen(0, "127.0.0.1", () => resolve()))
  const alvoPort = (alvo.address() as AddressInfo).port
  const urlOriginal = process.env.EVOLUTION_API_URL
  process.env.EVOLUTION_API_URL = `http://127.0.0.1:${alvoPort}`

  try {
    assert.equal(await buscarProxy("5511999998888"), "inativa")
  } finally {
    process.env.EVOLUTION_API_URL = urlOriginal
    await new Promise((resolve) => alvo.close(resolve))
  }
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
