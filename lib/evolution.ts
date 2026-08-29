/** Instância na Evolution é nomeada com o número do WhatsApp, sem formatação.
 * `chip.numero` pode estar salvo com parênteses/traço/DDI — normalizar cobre
 * os dois formatos e sempre compara maçã com maçã contra a Evolution. */
export function normalizarNumero(numero: string): string {
  return numero.replace(/\D/g, "")
}

export type ServidorEvolution = { url: string; apiKey: string }
export type ServidorComId = ServidorEvolution & { id: number; nome: string }

/** Chamada crua contra uma Evolution. Erro de rede ou resposta não-ok → `null`,
 * nunca lança — quem chama decide o que `null` significa (desconhecido, sem proxy, etc). */
async function chamarEvolution<T>(
  servidor: ServidorEvolution,
  caminho: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const base = servidor.url.replace(/\/$/, "")
    const resposta = await fetch(`${base}${caminho}`, {
      ...init,
      headers: { apikey: servidor.apiKey, ...init?.headers },
      signal: AbortSignal.timeout(8000),
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
  serverId: number
  serverNome: string
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
): { serverId: number; name: string } | null {
  const alvo = numeroChip.replace(/\D/g, "")
  if (alvo.length < MIN_DIGITOS) return null

  const casa = (a: string, b: string) =>
    a.length >= MIN_DIGITOS && b.length >= MIN_DIGITOS && (a.endsWith(b) || b.endsWith(a))

  const achados = instancias.filter((i) => i.digitos.some((d) => casa(alvo, d)))
  return achados.length === 1
    ? { serverId: achados[0].serverId, name: achados[0].name }
    : null
}

/** Lista as instâncias que existem na Evolution — a fonte pra associar cada
 * conta ao nome certo. O nome é rótulo livre; o número é só pra ajudar o
 * operador a reconhecer qual é qual. */
export async function listarInstancias(
  servidores: ServidorComId[],
): Promise<{ instancias: InstanciaEvolution[]; falharam: string[] }> {
  const porServidor = await Promise.allSettled(
    servidores.map(async (s) => {
      const dados = await chamarEvolution<InstanciaApi[]>(s, `/instance/fetchInstances`)
      if (!Array.isArray(dados)) {
        console.warn(`listarInstancias: ${s.nome} não devolveu lista`)
        throw new Error(s.nome)
      }
      return dados
        .filter((i): i is InstanciaApi & { name: string } => typeof i.name === "string")
        .map((i) => {
          const doNumber = (i.number ?? "").replace(/\D/g, "")
          const doOwner = (i.ownerJid ?? "").replace(/\D/g, "")
          return {
            serverId: s.id,
            serverNome: s.nome,
            name: i.name,
            numero: i.number ?? i.ownerJid?.replace(/@.*/, "") ?? null,
            status: mapearEstado(i.connectionStatus),
            digitos: [doNumber, doOwner].filter((d) => d.length >= 10),
          } satisfies InstanciaEvolution
        })
    }),
  )

  const falharam = servidores
    .filter((_, i) => porServidor[i].status === "rejected")
    .map((s) => s.nome)

  const instancias = porServidor
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .sort((a, b) => a.serverNome.localeCompare(b.serverNome) || a.name.localeCompare(b.name))

  return { instancias, falharam }
}

type ConnectionStateApi = { instance?: { state?: string } }

export async function buscarStatusConexao(
  servidor: ServidorEvolution,
  instanceName: string,
): Promise<"aberta" | "conectando" | "fechada" | "desconhecido"> {
  const dados = await chamarEvolution<ConnectionStateApi>(
    servidor,
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
  servidor: ServidorEvolution,
  instanceName: string,
): Promise<"sem_conexao" | "ativa" | "inativa"> {
  const dados = await chamarEvolution<ProxyApi>(servidor, `/proxy/find/${instanceName}`)
  if (!dados?.host) return "sem_conexao"
  return dados.enabled === false ? "inativa" : "ativa"
}

type ConnectApi = { base64?: string }

export async function pedirQrCode(
  servidor: ServidorEvolution,
  instanceName: string,
): Promise<string> {
  const dados = await chamarEvolution<ConnectApi>(servidor, `/instance/connect/${instanceName}`, {
    method: "POST",
  })
  if (!dados?.base64) throw new Error("Evolution API não retornou QR code.")
  return dados.base64
}
