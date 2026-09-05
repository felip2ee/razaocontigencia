"use client"

import { DialogAcao } from "@/components/dialog-acao"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ACOES } from "@/lib/acoes"
import { cancelarChip, editarChip, moverChip, reativarChip } from "@/lib/actions"

const CAMPO = "border-input bg-background h-9 rounded-md border px-3 text-sm"

export function EditarChip({
  chipId,
  numero,
  operadora,
  origem,
}: {
  chipId: string
  numero: string
  operadora: string
  origem: "propria" | "externa"
}) {
  return (
    <DialogAcao
      rotulo={ACOES["editar-chip"].rotulo}
      titulo={ACOES["editar-chip"].rotulo}
      descricao={ACOES["editar-chip"].frase}
      confirmar="Salvar"
      acao={editarChip}
    >
      <input type="hidden" name="chipId" value={chipId} />
      <div className="grid gap-1.5">
        <Label htmlFor="ec-numero">Número</Label>
        <Input id="ec-numero" name="numero" defaultValue={numero} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ec-operadora">Operadora</Label>
        <Input id="ec-operadora" name="operadora" defaultValue={operadora} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ec-origem">Origem</Label>
        <select id="ec-origem" name="origem" defaultValue={origem} className={CAMPO}>
          <option value="propria">Própria (interno)</option>
          <option value="externa">Externa (externo)</option>
        </select>
      </div>
    </DialogAcao>
  )
}

/**
 * Os três destinos num formulário só. `moverChip` zera o que não pertence ao
 * destino escolhido, então preencher os dois campos não suja o registro.
 */
export function MoverChip({
  chipId,
  local,
  posicao,
  bandejaDeviceId,
  aparelhos,
}: {
  chipId: string
  local: string
  posicao: string | null
  bandejaDeviceId: string | null
  aparelhos: { id: string; apelido: string | null }[]
}) {
  return (
    <DialogAcao
      rotulo={ACOES["mover-chip"].rotulo}
      titulo={ACOES["mover-chip"].rotulo}
      descricao={ACOES["mover-chip"].frase}
      confirmar="Mover"
      acao={moverChip}
    >
      <input type="hidden" name="chipId" value={chipId} />
      <div className="grid gap-1.5">
        <Label htmlFor="mc-local">Destino</Label>
        <select id="mc-local" name="local" defaultValue={local} className={CAMPO}>
          <option value="pasta">Pasta — fazenda de SMS</option>
          <option value="gaveta">Gaveta — fora de uso, guardado</option>
          {/* Sem aparelho ativo não há bandeja possível: oferecer o destino
              levaria a uma recusa da action. */}
          {aparelhos.length > 0 && (
            <option value="bandeja">Bandeja de um aparelho — internet 4G</option>
          )}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="mc-posicao">Posição na pasta</Label>
        <Input
          id="mc-posicao"
          name="posicao"
          defaultValue={posicao ?? ""}
          placeholder="pasta 2, folha 3"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="mc-device">Aparelho da bandeja</Label>
        {aparelhos.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhum aparelho ativo no cadastro, então não há bandeja para onde mover.
          </p>
        ) : (
          <select
            id="mc-device"
            name="bandejaDeviceId"
            defaultValue={bandejaDeviceId ?? ""}
            className={CAMPO}
          >
            <option value="">— escolher —</option>
            {aparelhos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id}
                {a.apelido ? ` — ${a.apelido}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>
    </DialogAcao>
  )
}

export function AposentarChip({ chipId }: { chipId: string }) {
  return (
    <DialogAcao
      rotulo={ACOES["aposentar-chip"].rotulo}
      titulo={ACOES["aposentar-chip"].rotulo}
      descricao={ACOES["aposentar-chip"].frase}
      confirmar="Aposentar"
      acao={cancelarChip}
      variant="destructive"
    >
      <input type="hidden" name="chipId" value={chipId} />
    </DialogAcao>
  )
}

export function ReativarChip({ chipId }: { chipId: string }) {
  return (
    <DialogAcao
      rotulo={ACOES["reativar-chip"].rotulo}
      titulo={ACOES["reativar-chip"].rotulo}
      descricao={ACOES["reativar-chip"].frase}
      confirmar="Reativar"
      acao={reativarChip}
    >
      <input type="hidden" name="chipId" value={chipId} />
    </DialogAcao>
  )
}
