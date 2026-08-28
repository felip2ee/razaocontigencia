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

function mapearEstado(
  estado: string | undefined,
): "aberta" | "conectando" | "fechada" | "desconhecido" {
  if (estado === "open") return "aberta"
  if (estado === "connecting") return "conectando"
  if (estado === "close") return "fechada"
  return "desconhecido"
}

type InstanciaApi = {
  name?: string
  number?: string | null
  ownerJid?: string | null
  connectionStatus?: string
}

export type InstanciaEvolution = {
  name: string
  numero: string | null
  status: "aberta" | "conectando" | "fechada" | "desconhecido"
  /** `number` e `ownerJid` só com dígitos, ≥ 10 — usados no auto-match. */
  digitos: string[]
}

/** Comprimento mínimo pra um par de números ser comparável sem falso
 * positivo — DDD + assinante. Abaixo disso o sufixo coincide fácil demais. */
const MIN_DIGITOS = 10

/**
 * Acha a instância de um número de chip por sufixo de dígitos: o app guarda
 * `63981263783`, a Evolution guarda `5563981263783` — um é sufixo do outro.
 * Compara contra `number` e `ownerJid` de cada instância. Devolve o nome só
 * quando **exatamente uma** instância casa; 0 ou 2+ → `null` (impossível
 * associar sem chutar).
 */
export function acharInstancia(
  numeroChip: string,
  instancias: InstanciaEvolution[],
): string | null {
  const alvo = numeroChip.replace(/\D/g, "")
  if (alvo.length < MIN_DIGITOS) return null

  const casa = (a: string, b: string) =>
    a.length >= MIN_DIGITOS && b.length >= MIN_DIGITOS && (a.endsWith(b) || b.endsWith(a))

  const achados = instancias.filter((i) => i.digitos.some((d) => casa(alvo, d)))
  return achados.length === 1 ? achados[0].name : null
}

/** Lista as instâncias que existem na Evolution — a fonte pra associar cada
 * conta ao nome certo. O nome é rótulo livre; o número é só pra ajudar o
 * operador a reconhecer qual é qual. */
export async function listarInstancias(): Promise<InstanciaEvolution[]> {
  const dados = await chamarEvolution<InstanciaApi[]>(`/instance/fetchInstances`)
  if (!Array.isArray(dados)) return []
  return dados
    .filter((i): i is InstanciaApi & { name: string } => typeof i.name === "string")
    .map((i) => {
      const doNumber = (i.number ?? "").replace(/\D/g, "")
      const doOwner = (i.ownerJid ?? "").replace(/\D/g, "")
      return {
        name: i.name,
        numero: i.number ?? i.ownerJid?.replace(/@.*/, "") ?? null,
        status: mapearEstado(i.connectionStatus),
        digitos: [doNumber, doOwner].filter((d) => d.length >= 10),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

type ConnectionStateApi = { instance?: { state?: string } }

export async function buscarStatusConexao(
  instanceName: string,
): Promise<"aberta" | "conectando" | "fechada" | "desconhecido"> {
  const dados = await chamarEvolution<ConnectionStateApi>(
    `/instance/connectionState/${instanceName}`,
  )
  return mapearEstado(dados?.instance?.state)
}

type ProxyApi = {
  enabled?: boolean
  host?: string
}

/**
 * Estado do proxy pelo que a Evolution já sabe — sem teste de conectividade
 * ao vivo. O teste antigo batia na própria Evolution através do proxy, e o
 * host da Evolution recusa IP de datacenter de proxy: dava "inativa" pra todo
 * proxy funcionando. Quem de fato usa o proxy é a Evolution nas mensagens; se
 * estiver quebrado, aparece no status da conexão.
 *
 * - sem host        → sem_conexao (sem proxy configurado)
 * - host + off      → inativa (configurado mas desligado)
 * - host + ligado   → ativa
 */
export async function buscarProxy(
  instanceName: string,
): Promise<"sem_conexao" | "ativa" | "inativa"> {
  const dados = await chamarEvolution<ProxyApi>(`/proxy/find/${instanceName}`)
  if (!dados?.host) return "sem_conexao"
  return dados.enabled === false ? "inativa" : "ativa"
}

type ConnectApi = { base64?: string }

export async function pedirQrCode(instanceName: string): Promise<string> {
  const dados = await chamarEvolution<ConnectApi>(`/instance/connect/${instanceName}`, {
    method: "POST",
  })
  if (!dados?.base64) throw new Error("Evolution API não retornou QR code.")
  return dados.base64
}
