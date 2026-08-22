import { Input } from "@/components/ui/input"

export function Busca() {
  return (
    <form action="/busca" className="ml-auto">
      <Input
        name="id"
        placeholder="ID do aparelho ou chip"
        className="h-8 w-56"
        aria-label="Buscar por ID"
      />
    </form>
  )
}
