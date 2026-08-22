import { FormAcao } from "@/components/form-acao"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { encerrarIncidente, registrarIncidente, resolverBan } from "@/lib/actions"

export function RegistrarIncidente({ accountId }: { accountId: number }) {
  return (
    <FormAcao acao={registrarIncidente} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <select
        name="tipo"
        className="border-input bg-background h-8 rounded-md border px-2 text-sm"
        aria-label="Tipo de incidente"
      >
        <option value="restricao">Restrição</option>
        <option value="ban">Ban</option>
      </select>
      <Input
        type="datetime-local"
        name="inicio"
        required
        className="h-8 w-48"
        aria-label="Início"
      />
      <Button type="submit" size="sm" variant="outline">
        Registrar
      </Button>
    </FormAcao>
  )
}

export function EncerrarIncidente({
  incidentId,
  tipo,
}: {
  incidentId: number
  tipo: "restricao" | "ban"
}) {
  if (tipo === "restricao") {
    return (
      <form action={encerrarIncidente}>
        <input type="hidden" name="incidentId" value={incidentId} />
        <Button type="submit" size="sm">
          Voltou
        </Button>
      </form>
    )
  }

  return (
    <div className="flex gap-2">
      <form action={resolverBan}>
        <input type="hidden" name="incidentId" value={incidentId} />
        <input type="hidden" name="resultado" value="recuperada" />
        <Button type="submit" size="sm">
          Análise devolveu
        </Button>
      </form>
      <form action={resolverBan}>
        <input type="hidden" name="incidentId" value={incidentId} />
        <input type="hidden" name="resultado" value="perdida" />
        <Button type="submit" size="sm" variant="destructive">
          Perdido
        </Button>
      </form>
    </div>
  )
}
