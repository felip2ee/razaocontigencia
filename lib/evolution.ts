import { ProxyAgent } from "undici"

/** Instância na Evolution é nomeada com o número do WhatsApp, sem formatação.
 * `chip.numero` pode estar salvo com parênteses/traço/DDI — normalizar cobre
 * os dois formatos e sempre compara maçã com maçã contra a Evolution. */
export function normalizarNumero(numero: string): string {
  return numero.replace(/\D/g, "")
}

function baseUrl(): string {
  const url = process.env.EVOLUTION_API_URL
  if (!url) throw new Error("EVOLUTION_API_URL não configurada")
  return url.replace(/\/$/, "")
}

/** Chamada crua contra a Evolution API. Erro de rede ou resposta não-ok vira `null`,
 * nunca lança — quem chama decide o que `null` significa (desconhecido, sem proxy, etc). */
async function chamarEvolution<T>(caminho: string, init?: RequestInit): Promise<T | null> {
  try {
    const resposta = await fetch(`${baseUrl()}${caminho}`, {
      ...init,
      headers: { apikey: process.env.EVOLUTION_API_KEY ?? "", ...init?.headers },
    })
    if (!resposta.ok) return null
    return (await resposta.json()) as T
  } catch {
    return null
  }
}

type ConnectionStateApi = { instance?: { state?: string } }

export async function buscarStatusConexao(
  instanceName: string,
): Promise<"aberta" | "conectando" | "fechada" | "desconhecido"> {
  const dados = await chamarEvolution<ConnectionStateApi>(
    `/instance/connectionState/${instanceName}`,
  )
  const estado = dados?.instance?.state
  if (estado === "open") return "aberta"
  if (estado === "connecting") return "conectando"
  if (estado === "close") return "fechada"
  return "desconhecido"
}

type ProxyApi = {
  enabled?: boolean
  host?: string
  port?: number | string
  protocol?: string
  username?: string | null
  password?: string | null
}

/** Testa se o proxy salvo na Evolution de fato funciona: uma requisição de saída
 * de verdade através dele contra a própria Evolution API (não terceiro), com
 * timeout curto pra não travar a UI. */
async function testarProxy(proxy: {
  host: string
  port: string
  protocol: string
  username?: string | null
  password?: string | null
}): Promise<boolean> {
  const auth = proxy.username && proxy.password ? `${proxy.username}:${proxy.password}@` : ""
  let agente: ProxyAgent | undefined
  try {
    agente = new ProxyAgent(`${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`)
    const resposta = await fetch(baseUrl(), {
      dispatcher: agente,
      signal: AbortSignal.timeout(5000),
    } as RequestInit)
    return resposta.ok
  } catch {
    return false
  } finally {
    await agente?.close()
  }
}

export async function buscarProxy(
  instanceName: string,
): Promise<"sem_conexao" | "ativa" | "inativa"> {
  const dados = await chamarEvolution<ProxyApi>(`/proxy/find/${instanceName}`)
  if (!dados?.host) return "sem_conexao"

  const funcionou = await testarProxy({
    host: dados.host,
    port: String(dados.port ?? "80"),
    protocol: dados.protocol ?? "http",
    username: dados.username,
    password: dados.password,
  })
  return funcionou ? "ativa" : "inativa"
}

type ConnectApi = { base64?: string }

export async function pedirQrCode(instanceName: string): Promise<string> {
  const dados = await chamarEvolution<ConnectApi>(`/instance/connect/${instanceName}`, {
    method: "POST",
  })
  if (!dados?.base64) throw new Error("Evolution API não retornou QR code.")
  return dados.base64
}
