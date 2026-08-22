import { asc, eq } from "drizzle-orm"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ativarConta, criarAparelho, criarChip } from "@/lib/actions"
import { db } from "@/lib/db"
import { chip, device } from "@/lib/schema"

export const dynamic = "force-dynamic"

export default async function Page() {
  const aparelhos = await db
    .select()
    .from(device)
    .where(eq(device.status, "ativo"))
    .orderBy(asc(device.id))
  const chipsLivres = await db
    .select()
    .from(chip)
    .where(eq(chip.status, "novo"))
    .orderBy(asc(chip.id))

  return (
    <div className="grid gap-8 p-6 md:grid-cols-3">
      <form action={criarAparelho} className="flex flex-col gap-3">
        <h2 className="font-medium">Novo aparelho</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="ap-id">ID colado no aparelho</Label>
          <Input id="ap-id" name="id" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ap-apelido">Apelido</Label>
          <Input id="ap-apelido" name="apelido" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ap-notas">Notas</Label>
          <Input id="ap-notas" name="notas" />
        </div>
        <Button type="submit">Cadastrar aparelho</Button>
      </form>

      <form action={criarChip} className="flex flex-col gap-3">
        <h2 className="font-medium">Novo chip</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="ch-id">ID colado no chip</Label>
          <Input id="ch-id" name="id" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ch-operadora">Operadora</Label>
          <Input id="ch-operadora" name="operadora" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ch-numero">Número</Label>
          <Input id="ch-numero" name="numero" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ch-posicao">Posição na pasta</Label>
          <Input id="ch-posicao" name="posicao" placeholder="pasta 2, folha 3" />
        </div>
        <Button type="submit">Cadastrar chip</Button>
      </form>

      <form action={ativarConta} className="flex flex-col gap-3">
        <h2 className="font-medium">Ativar conta</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="co-device">Aparelho</Label>
          <select
            id="co-device"
            name="deviceId"
            required
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            {aparelhos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} {a.apelido ? `— ${a.apelido}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="co-slot">Slot</Label>
          <select
            id="co-slot"
            name="slot"
            required
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            <option value="wa1">WhatsApp 1</option>
            <option value="wa2">WhatsApp 2</option>
            <option value="business">WhatsApp Business</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="co-chip">Chip</Label>
          <select
            id="co-chip"
            name="chipId"
            required
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            {chipsLivres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.numero} ({c.operadora})
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="co-data">Ativada em</Label>
          <Input id="co-data" name="ativadaEm" type="date" required />
        </div>
        <Button type="submit">Ativar conta</Button>
      </form>
    </div>
  )
}
