import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"

export function Busca() {
  return (
    <form action="/busca" className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        name="id"
        placeholder="ID do aparelho ou chip"
        className="h-9 w-64 pl-8"
        aria-label="Buscar por ID"
      />
    </form>
  )
}
