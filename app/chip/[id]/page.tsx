import { asc, eq } from "drizzle-orm"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { moverChip } from "@/lib/actions"
import { db } from "@/lib/db"
import { fichaDoChip } from "@/lib/queries"
import { device } from "@/lib/schema"

export const dynamic = "force-dynamic"

const NOME_DO_SLOT: Record<string, string> = {
  wa1: "WhatsApp 1",
  wa2: "WhatsApp 2",
  business: "Business",
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ficha = await fichaDoChip(id)
  if (!ficha) notFound()

  const aparelhos = await db
    .select()
    .from(device)
    .where(eq(device.status, "ativo"))
    .orderBy(asc(device.id))

  return (
    <div className="flex max-w-2xl flex-col gap-8 p-6">
      <header className="flex items-center gap-4">
        <h1 className="text-xl font-medium">{ficha.chip.id}</h1>
        <span className="text-muted-foreground">
          {ficha.chip.numero} — {ficha.chip.operadora}
        </span>
        <Badge variant={ficha.chip.status === "aposentado" ? "destructive" : "secondary"}>
          {ficha.chip.status}
        </Badge>
      </header>

      <section className="text-sm">
        <h2 className="mb-1 font-medium">Onde está</h2>
        {ficha.chip.local === "bandeja" && ficha.aparelhoDaBandeja ? (
          <p>
            Na bandeja do aparelho{" "}
            <Link href={`/aparelho/${ficha.aparelhoDaBandeja.id}`} className="underline">
              {ficha.aparelhoDaBandeja.id}
            </Link>{" "}
            (chip de rede, 4G).
          </p>
        ) : ficha.chip.local === "gaveta" ? (
          <p>Na gaveta.</p>
        ) : (
          <p>Na pasta{ficha.chip.posicao ? ` — ${ficha.chip.posicao}` : ""}.</p>
        )}
      </section>

      <section className="text-sm">
        <h2 className="mb-1 font-medium">Conta gerada</h2>
        {ficha.conta ? (
          <p>
            <Link href={`/aparelho/${ficha.conta.deviceId}`} className="underline">
              {ficha.conta.deviceId}
            </Link>{" "}
            — {NOME_DO_SLOT[ficha.conta.slot]} — ativada em {ficha.conta.ativadaEm} —{" "}
            {ficha.conta.status}
          </p>
        ) : (
          <p className="text-muted-foreground">
            Nenhuma conta usa este chip. É um chip de rede ou está reservado.
          </p>
        )}
      </section>

      <form action={moverChip} className="flex flex-col gap-3">
        <h2 className="font-medium">Mover</h2>
        <input type="hidden" name="chipId" value={ficha.chip.id} />
        <div className="grid gap-1.5">
          <Label htmlFor="mv-local">Destino</Label>
          <select
            id="mv-local"
            name="local"
            defaultValue={ficha.chip.local}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            <option value="pasta">Pasta (fazenda de SMS)</option>
            <option value="gaveta">Gaveta</option>
            <option value="bandeja">Bandeja de um aparelho</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mv-posicao">Posição na pasta</Label>
          <Input
            id="mv-posicao"
            name="posicao"
            defaultValue={ficha.chip.posicao ?? ""}
            placeholder="pasta 2, folha 3"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mv-device">Aparelho da bandeja</Label>
          <select
            id="mv-device"
            name="bandejaDeviceId"
            defaultValue={ficha.chip.bandejaDeviceId ?? ""}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            <option value="">—</option>
            {aparelhos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.id} {a.apelido ? `— ${a.apelido}` : ""}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" className="self-start">
          Mover chip
        </Button>
      </form>
    </div>
  )
}
