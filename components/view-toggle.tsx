import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * Alterna entre blocos (padrão) e lista via `?view=`. Preserva os outros
 * filtros da URL para não perder status/origem/busca ao trocar de visão.
 */
export function ViewToggle({
  params,
  atual,
}: {
  params: Record<string, string | string[] | undefined>
  atual: "blocos" | "lista"
}) {
  const href = (view: "blocos" | "lista") => {
    const qs = new URLSearchParams()
    for (const [chave, valor] of Object.entries(params)) {
      if (chave === "view" || valor === undefined) continue
      qs.set(chave, Array.isArray(valor) ? valor[0] : valor)
    }
    if (view === "lista") qs.set("view", "lista")
    const s = qs.toString()
    return s ? `?${s}` : "?"
  }

  const item = "h-9 rounded-md border px-3 text-sm flex items-center"
  return (
    <div className="flex gap-1">
      <Link
        href={href("blocos")}
        className={cn(
          item,
          atual === "blocos"
            ? "bg-accent border-input"
            : "border-input bg-background hover:bg-accent",
        )}
      >
        Blocos
      </Link>
      <Link
        href={href("lista")}
        className={cn(
          item,
          atual === "lista"
            ? "bg-accent border-input"
            : "border-input bg-background hover:bg-accent",
        )}
      >
        Lista
      </Link>
    </div>
  )
}
