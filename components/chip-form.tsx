"use client"

import { FormAcao } from "@/components/form-acao"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cancelarChip, editarChip } from "@/lib/actions"

export function EditarChip({
  chipId,
  numero,
  operadora,
}: {
  chipId: string
  numero: string
  operadora: string
}) {
  return (
    <FormAcao acao={editarChip} className="flex flex-col gap-3">
      <input type="hidden" name="chipId" value={chipId} />
      <div className="grid gap-1.5">
        <Label htmlFor={`ec-numero-${chipId}`}>Número</Label>
        <Input id={`ec-numero-${chipId}`} name="numero" defaultValue={numero} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`ec-operadora-${chipId}`}>Operadora</Label>
        <Input
          id={`ec-operadora-${chipId}`}
          name="operadora"
          defaultValue={operadora}
          required
        />
      </div>
      <Button type="submit" size="sm" variant="outline" className="self-start">
        Salvar
      </Button>
    </FormAcao>
  )
}

export function CancelarChip({ chipId }: { chipId: string }) {
  return (
    <FormAcao acao={cancelarChip}>
      <input type="hidden" name="chipId" value={chipId} />
      <Button type="submit" size="sm" variant="destructive">
        Cancelar chip
      </Button>
    </FormAcao>
  )
}
