export function OrigemBadge({ origem }: { origem: "propria" | "externa" }) {
  if (origem !== "externa") return null
  return (
    <span className="border-border text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
      Externo
    </span>
  )
}
