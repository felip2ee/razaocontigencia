import type { LucideIcon } from "lucide-react"

export function StatCard({
  rotulo,
  valor,
  detalhe,
  Icone,
}: {
  rotulo: string
  valor: number
  detalhe: string
  Icone: LucideIcon
}) {
  return (
    <div className="bg-card border-border flex items-start gap-3 rounded-xl border p-4">
      <div className="bg-muted text-muted-foreground rounded-lg p-2">
        <Icone className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-muted-foreground text-[0.6875rem] font-medium tracking-wider uppercase">
          {rotulo}
        </div>
        <div className="mt-0.5 text-2xl leading-none font-semibold tabular-nums">{valor}</div>
        <div className="text-muted-foreground mt-1 truncate text-xs">{detalhe}</div>
      </div>
    </div>
  )
}
