import Link from "next/link"
import { notFound } from "next/navigation"

import { EncerrarIncidente, RegistrarIncidente } from "@/components/incident-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { mudarStatusDoAparelho } from "@/lib/actions"
import { fichaDoAparelho } from "@/lib/queries"
import { idadeEmDias } from "@/lib/warmup"

export const dynamic = "force-dynamic"

const NOME_DO_SLOT: Record<string, string> = {
  wa1: "WhatsApp 1",
  wa2: "WhatsApp 2",
  business: "Business",
}

function duracao(inicio: Date, fim: Date | null): string {
  const horas = Math.floor(((fim ?? new Date()).getTime() - inicio.getTime()) / 3_600_000)
  if (horas < 24) return `${horas}h`
  return `${Math.floor(horas / 24)}d ${horas % 24}h`
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ficha = await fichaDoAparelho(id)
  if (!ficha) notFound()

  const hoje = new Date()

  return (
    <div className="flex flex-col gap-8 p-6">
      <header className="flex items-center gap-4">
        <h1 className="text-xl font-medium">{ficha.device.id}</h1>
        {ficha.device.apelido && (
          <span className="text-muted-foreground">{ficha.device.apelido}</span>
        )}
        <Badge variant={ficha.device.status === "ativo" ? "secondary" : "destructive"}>
          {ficha.device.status}
        </Badge>
        <span className="text-muted-foreground text-sm">
          {ficha.totalBans} ban(s) no histórico
        </span>
        <form action={mudarStatusDoAparelho} className="ml-auto flex gap-2">
          <input type="hidden" name="deviceId" value={ficha.device.id} />
          <select
            name="status"
            defaultValue={ficha.device.status}
            className="border-input bg-background h-8 rounded-md border px-2 text-sm"
            aria-label="Status do aparelho"
          >
            <option value="ativo">ativo</option>
            <option value="quarentena">quarentena</option>
            <option value="aposentado">aposentado</option>
          </select>
          <Button type="submit" size="sm" variant="outline">
            Mudar status
          </Button>
        </form>
      </header>

      <section className="text-sm">
        <h2 className="mb-1 font-medium">Chip de rede na bandeja</h2>
        {ficha.chipNaBandeja ? (
          <Link href={`/chip/${ficha.chipNaBandeja.id}`} className="underline">
            {ficha.chipNaBandeja.id} — {ficha.chipNaBandeja.numero} (
            {ficha.chipNaBandeja.operadora})
          </Link>
        ) : (
          <span className="text-muted-foreground">Bandeja vazia.</span>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Contas</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Slot</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Chip</TableHead>
              <TableHead>Idade</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ficha.contas.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{NOME_DO_SLOT[c.slot]}</TableCell>
                <TableCell>{c.numero}</TableCell>
                <TableCell>
                  <Link href={`/chip/${c.chipId}`} className="underline">
                    {c.chipId}
                  </Link>
                </TableCell>
                <TableCell>{idadeEmDias(c.ativadaEm, hoje)} dias</TableCell>
                <TableCell>
                  {c.incidenteAberto ? (
                    <Badge
                      variant={
                        c.incidenteAberto.tipo === "ban" ? "destructive" : "secondary"
                      }
                    >
                      {c.incidenteAberto.tipo === "ban" ? "Ban" : "Restrição"} há{" "}
                      {duracao(c.incidenteAberto.inicio, null)}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Saudável</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {c.incidenteAberto ? (
                    <EncerrarIncidente
                      incidentId={c.incidenteAberto.incidentId}
                      tipo={c.incidenteAberto.tipo}
                    />
                  ) : (
                    <RegistrarIncidente accountId={c.id} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Histórico de incidentes</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Slot</TableHead>
              <TableHead>Chip</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Análise</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ficha.historico.map((h) => (
              <TableRow key={h.id}>
                <TableCell>{NOME_DO_SLOT[h.slot]}</TableCell>
                <TableCell>{h.chipId}</TableCell>
                <TableCell>{h.tipo === "ban" ? "Ban" : "Restrição"}</TableCell>
                <TableCell>{h.inicio.toLocaleString("pt-BR")}</TableCell>
                <TableCell>{h.fim ? duracao(h.inicio, h.fim) : "em curso"}</TableCell>
                <TableCell>{h.resultado ?? "—"}</TableCell>
              </TableRow>
            ))}
            {ficha.historico.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Nenhum incidente registrado neste aparelho.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
