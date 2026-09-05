"use client"

import { DialogAcao } from "@/components/dialog-acao"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ACOES } from "@/lib/acoes"
import { editarAparelho, moverChip, mudarStatusDoAparelho } from "@/lib/actions"
import type { ChipParaBandeja } from "@/lib/queries"

const CAMPO = "border-input bg-background h-9 rounded-md border px-3 text-sm"

export function EditarAparelho({
  deviceId,
  apelido,
  notas,
  origem,
}: {
  deviceId: string
  apelido: string | null
  notas: string | null
  origem: "propria" | "externa"
}) {
  return (
    <DialogAcao
      rotulo={ACOES["editar-aparelho"].rotulo}
      titulo={ACOES["editar-aparelho"].rotulo}
      descricao={ACOES["editar-aparelho"].frase}
      confirmar="Salvar"
      acao={editarAparelho}
    >
      <input type="hidden" name="deviceId" value={deviceId} />
      <div className="grid gap-1.5">
        <Label htmlFor="ea-apelido">Apelido</Label>
        <Input id="ea-apelido" name="apelido" defaultValue={apelido ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ea-origem">Origem</Label>
        <select id="ea-origem" name="origem" defaultValue={origem} className={CAMPO}>
          <option value="propria">Própria (interno)</option>
          <option value="externa">Externa (externo)</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ea-notas">Notas</Label>
        <Input id="ea-notas" name="notas" defaultValue={notas ?? ""} />
      </div>
    </DialogAcao>
  )
}

export function MudarSituacao({
  deviceId,
  status,
}: {
  deviceId: string
  status: string
}) {
  return (
    <DialogAcao
      rotulo={ACOES["mudar-situacao"].rotulo}
      titulo={ACOES["mudar-situacao"].rotulo}
      descricao={ACOES["mudar-situacao"].frase}
      confirmar="Mudar"
      acao={mudarStatusDoAparelho}
    >
      <input type="hidden" name="deviceId" value={deviceId} />
      <div className="grid gap-1.5">
        <Label htmlFor="ms-status">Situação</Label>
        <select id="ms-status" name="status" defaultValue={status} className={CAMPO}>
          <option value="ativo">Ativo — em circulação, recebe conta nova</option>
          <option value="quarentena">Quarentena — parado, sem receber conta nova</option>
          <option value="aposentado">Aposentado — fora da frota</option>
        </select>
      </div>
    </DialogAcao>
  )
}

/**
 * A bandeja é física: cabe um chip. O select traz os candidatos e `moverChip`
 * tira quem estava lá antes de colocar o novo.
 */
export function TrocarChipDaBandeja({
  deviceId,
  chipAtualId,
  chips,
}: {
  deviceId: string
  chipAtualId: string | null
  chips: ChipParaBandeja[]
}) {
  return (
    <DialogAcao
      rotulo={ACOES["trocar-chip-bandeja"].rotulo}
      titulo={ACOES["trocar-chip-bandeja"].rotulo}
      descricao={ACOES["trocar-chip-bandeja"].frase}
      confirmar="Colocar na bandeja"
      acao={moverChip}
    >
      <input type="hidden" name="local" value="bandeja" />
      <input type="hidden" name="bandejaDeviceId" value={deviceId} />
      <div className="grid gap-1.5">
        <Label htmlFor="tb-chip">Chip que fica na bandeja</Label>
        {chips.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhum chip disponível. Todo chip não aposentado já está em uma conta ativa.
          </p>
        ) : (
          <select
            id="tb-chip"
            name="chipId"
            defaultValue={chipAtualId ?? ""}
            required
            className={CAMPO}
          >
            <option value="">— escolher —</option>
            {chips.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.numero} ({c.operadora})
              </option>
            ))}
          </select>
        )}
      </div>
    </DialogAcao>
  )
}
