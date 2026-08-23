import { asc, eq } from "drizzle-orm"

import { FormAcao } from "@/components/form-acao"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ativarConta, criarAparelho, criarChip } from "@/lib/actions"
import { db } from "@/lib/db"
import { chipsLivres } from "@/lib/queries"
import { NOME_DO_SLOT } from "@/lib/slots"
import { device } from "@/lib/schema"

export const dynamic = "force-dynamic"

export default async function Page() {
  const aparelhos = await db
    .select()
    .from(device)
    .where(eq(device.status, "ativo"))
    .orderBy(asc(device.id))
  const livres = await chipsLivres()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Cadastro"
        subtitulo="A ordem natural é aparelho, depois chip, depois a conta que liga os dois."
      />

      {/* lg e não md: a sidebar fixa de 224px come a largura, então em 900px
          de viewport o conteúdo só tem ~650px e três colunas ficariam apertadas. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-card border-border rounded-xl border p-5">
          <h2 className="font-medium">Novo aparelho</h2>
          <p className="text-muted-foreground mt-0.5 mb-4 text-sm">
            Quando um celular novo entra na frota.
          </p>
          <FormAcao acao={criarAparelho} className="flex flex-col gap-3">
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
          </FormAcao>
        </div>

        <div className="bg-card border-border rounded-xl border p-5">
          <h2 className="font-medium">Novo chip</h2>
          <p className="text-muted-foreground mt-0.5 mb-4 text-sm">
            Quando um chip novo chega e vai para a pasta.
          </p>
          <FormAcao acao={criarChip} className="flex flex-col gap-3">
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
          </FormAcao>
        </div>

        <div className="bg-card border-border rounded-xl border p-5">
          <h2 className="font-medium">Ativar conta</h2>
          <p className="text-muted-foreground mt-0.5 mb-4 text-sm">
            Quando um chip livre vira WhatsApp num slot do aparelho.
          </p>
          <FormAcao acao={ativarConta} className="flex flex-col gap-3">
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
                <option value="wa1">{NOME_DO_SLOT.wa1}</option>
                <option value="wa2">{NOME_DO_SLOT.wa2}</option>
                <option value="business">{NOME_DO_SLOT.business}</option>
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
                {livres.map((c) => (
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
          </FormAcao>
        </div>
      </div>
    </div>
  )
}
