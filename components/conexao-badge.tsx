import { HelpCircle, Loader2, Wifi, WifiOff, type LucideIcon } from "lucide-react"

import { tempoDecorrido } from "@/lib/tempo"

type Status = "desconhecido" | "aberta" | "conectando" | "fechada"
type Proxy = "sem_conexao" | "ativa" | "inativa"

const STATUS_TEXTO: Record<Status, string> = {
  desconhecido: "Nunca verificado",
  aberta: "Conectado",
  conectando: "Conectando",
  fechada: "Desconectado",
}

const STATUS_COR: Record<Status, string> = {
  desconhecido: "bg-muted text-muted-foreground",
  aberta: "bg-status-ok/10 text-status-ok",
  conectando: "bg-status-restricao/10 text-status-restricao",
  fechada: "bg-status-ban/10 text-status-ban",
}

const STATUS_ICONE: Record<Status, LucideIcon> = {
  desconhecido: HelpCircle,
  aberta: Wifi,
  conectando: Loader2,
  fechada: WifiOff,
}

const PROXY_TEXTO: Record<Proxy, string> = {
  sem_conexao: "sem proxy",
  ativa: "proxy ativo",
  inativa: "proxy inativo",
}

export function ConexaoBadge({
  status,
  proxy,
  statusVerificadoEm,
}: {
  status: Status
  proxy: Proxy
  statusVerificadoEm: Date | null
}) {
  const Icone = STATUS_ICONE[status]
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COR[status]}`}
      >
        <Icone className={`size-3 ${status === "conectando" ? "animate-spin" : ""}`} aria-hidden="true" />
        {STATUS_TEXTO[status]}
      </span>
      <span className="text-muted-foreground text-xs">{PROXY_TEXTO[proxy]}</span>
      {statusVerificadoEm && (
        <span className="text-muted-foreground text-xs tabular-nums">
          verificado há {tempoDecorrido(statusVerificadoEm)}
        </span>
      )}
    </div>
  )
}
