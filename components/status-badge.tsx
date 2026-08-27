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
      <Icone className="size-3" aria-hidden="true" />
      {TEXTO[estado]}
    </span>
  )
}

/**
 * Ciclo de vida do aparelho e do chip. Mesma pílula do StatusBadge. Por
 * padrão fica neutra de propósito — cor de status é reservada para saúde da
 * conta, e "quarentena" não é irmã de "restrição". A prop `colorido` existe
 * só para o painel de chips, onde a cor ajuda a achar um chip rápido.
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

const CICLO_COR: Record<string, string> = {
  novo: "bg-status-ok/10 text-status-ok",
  em_uso: "bg-status-restricao/10 text-status-restricao",
  aposentado: "bg-muted text-muted-foreground",
  ativo: "bg-status-ok/10 text-status-ok",
  quarentena: "bg-status-restricao/10 text-status-restricao",
}

export function StatusDeCadastro({
  valor,
  colorido,
}: {
  valor: string
  colorido?: boolean
}) {
  const Icone = CICLO_ICONE[valor] ?? Circle
  return (
    <span
      className={`${PILULA} ${colorido ? (CICLO_COR[valor] ?? "bg-muted text-foreground") : "bg-muted text-foreground"}`}
    >
      <Icone className="size-3" aria-hidden="true" />
      {CICLO[valor] ?? valor}
    </span>
  )
}
