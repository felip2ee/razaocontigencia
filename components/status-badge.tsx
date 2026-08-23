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

export function StatusBadge({ estado }: { estado: keyof typeof ESTILO }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ESTILO[estado]}`}
    >
      {TEXTO[estado]}
    </span>
  )
}
