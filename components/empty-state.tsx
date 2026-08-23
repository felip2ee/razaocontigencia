import type { LucideIcon } from "lucide-react"

export function EmptyState({
  Icone,
  titulo,
  descricao,
}: {
  Icone: LucideIcon
  titulo: string
  descricao: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
      <Icone className="text-muted-foreground/50 mb-2 size-8" />
      <div className="font-medium">{titulo}</div>
      <div className="text-muted-foreground text-sm">{descricao}</div>
    </div>
  )
}
