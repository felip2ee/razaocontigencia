import type { LucideIcon } from "lucide-react"
import Image from "next/image"

export function EmptyState({
  Icone,
  Ilustracao,
  titulo,
  descricao,
}: {
  Icone: LucideIcon
  Ilustracao?: string
  titulo: string
  descricao: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
      {Ilustracao ? (
        <Image src={Ilustracao} alt="" width={80} height={80} className="mb-2 size-20" />
      ) : (
        <Icone className="text-muted-foreground/50 mb-2 size-8" />
      )}
      <div className="font-medium">{titulo}</div>
      <div className="text-muted-foreground text-sm">{descricao}</div>
    </div>
  )
}
