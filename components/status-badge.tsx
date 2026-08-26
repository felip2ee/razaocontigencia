import { AlertTriangle, Ban, CheckCircle2, Circle, CircleDot, Clock, type LucideIcon } from "lucide-react"

const PILULA = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"

const ESTILO = {
  ok: "bg-status-ok/10 text-status-ok",
  restricao: "bg-status-restricao/10 text-status-restricao",
  ban: "bg-status-ban/10 text-status-ban",
} as const

const TEXTO = {
  ok: "Saudável",
  restricao: "Restrição",
  ban: "Ban",
} as const

const ICONE_SAUDE = {
  ok: CheckCircle2,
  restricao: AlertTriangle,
  ban: Ban,
} as const

export function StatusBadge({ estado }: { estado: keyof typeof ESTILO }) {
  const Icone = ICONE_SAUDE[estado]
  return (
    <span className={`${PILULA} ${ESTILO[estado]}`}>
      <Icone className="size-3" />
      {TEXTO[estado]}
    </span>
  )
}

/**
 * Ciclo de vida do aparelho e do chip. Mesma pílula do StatusBadge, mas em
 * neutro de propósito: cor de status é reservada para saúde da conta, e
 * "quarentena" não é irmã de "restrição". O mapa só existe para o enum não
 * vazar cru na tela.
 */
const CICLO: Record<string, string> = {
  ativo: "Ativo",
  quarentena: "Quarentena",
  aposentado: "Aposentado",
  novo: "Novo",
  em_uso: "Em uso",
}

const CICLO_ICONE: Record<string, LucideIcon> = {
  ativo: CircleDot,
  em_uso: CircleDot,
  quarentena: Clock,
  aposentado: Circle,
  novo: Circle,
}

export function StatusDeCadastro({ valor }: { valor: string }) {
  const Icone = CICLO_ICONE[valor] ?? Circle
  return (
    <span className={`${PILULA} bg-muted text-foreground`}>
      <Icone className="size-3" />
      {CICLO[valor] ?? valor}
    </span>
  )
}
