"use client"

import { FormAcao } from "@/components/form-acao"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cancelarConta, corrigirAparelho, editarAparelho } from "@/lib/actions"
import { definirInstancia } from "@/lib/evolution-actions"
import type { InstanciaEvolution } from "@/lib/evolution"
import { NOME_DO_SLOT } from "@/lib/slots"

export function CorrigirAparelho({
  accountId,
  aparelhos,
  slotAtual,
  deviceIdAtual,
}: {
  accountId: number
  aparelhos: { id: string; apelido: string | null }[]
  slotAtual: string
  deviceIdAtual: string
}) {
  return (
    <FormAcao acao={corrigirAparelho} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <select
        name="deviceId"
        defaultValue={deviceIdAtual}
        className="border-input bg-background h-8 rounded-md border px-2 text-sm"
        aria-label="Aparelho correto"
      >
        {aparelhos.map((a) => (
          <option key={a.id} value={a.id}>
            {a.id} {a.apelido ? `— ${a.apelido}` : ""}
          </option>
        ))}
      </select>
      <select
        name="slot"
        defaultValue={slotAtual}
        className="border-input bg-background h-8 rounded-md border px-2 text-sm"
        aria-label="Slot correto"
      >
        <option value="wa1">{NOME_DO_SLOT.wa1}</option>
        <option value="wa2">{NOME_DO_SLOT.wa2}</option>
        <option value="business">{NOME_DO_SLOT.business}</option>
      </select>
      <Button type="submit" size="sm" variant="outline">
        Corrigir aparelho
      </Button>
    </FormAcao>
  )
}

export function DefinirInstancia({
  accountId,
  instanceAtual,
  instancias,
}: {
  accountId: number
  instanceAtual: string | null
  instancias: InstanciaEvolution[]
}) {
  // A instância salva pode não estar mais na lista da Evolution (renomeada,
  // apagada). Mantém a opção visível pra não sumir silenciosamente.
  const faltando =
    instanceAtual && !instancias.some((i) => i.name === instanceAtual) ? instanceAtual : null

  return (
    <form action={definirInstancia} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <select
        name="instanceName"
        defaultValue={instanceAtual ?? ""}
        className="border-input bg-background h-8 rounded-md border px-2 text-sm"
        aria-label="Instância na Evolution"
      >
        <option value="">— sem instância —</option>
        {faltando && <option value={faltando}>{faltando} (não está mais na Evolution)</option>}
        {instancias.map((i) => (
          <option key={i.name} value={i.name}>
            {i.name}
            {i.numero ? ` — ${i.numero}` : ""} ({i.status})
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline">
        Salvar instância
      </Button>
    </form>
  )
}

export function CancelarConta({ accountId }: { accountId: number }) {
  return (
    <form action={cancelarConta}>
      <input type="hidden" name="accountId" value={accountId} />
      <Button type="submit" size="sm" variant="destructive">
        Cancelar conta
      </Button>
    </form>
  )
}

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
    <FormAcao acao={editarAparelho} className="flex flex-col gap-3">
      <input type="hidden" name="deviceId" value={deviceId} />
      <div className="grid gap-1.5">
        <Label htmlFor={`ea-apelido-${deviceId}`}>Apelido</Label>
        <Input id={`ea-apelido-${deviceId}`} name="apelido" defaultValue={apelido ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`ea-origem-${deviceId}`}>Origem</Label>
        <select
          id={`ea-origem-${deviceId}`}
          name="origem"
          defaultValue={origem}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="propria">Própria (interno)</option>
          <option value="externa">Externa (externo)</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`ea-notas-${deviceId}`}>Notas</Label>
        <Input id={`ea-notas-${deviceId}`} name="notas" defaultValue={notas ?? ""} />
      </div>
      <Button type="submit" size="sm" variant="outline" className="self-start">
        Salvar
      </Button>
    </FormAcao>
  )
}
