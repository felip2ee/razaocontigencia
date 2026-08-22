import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { contadores, contasComIncidenteAberto, contasSaudaveis } from "@/lib/queries"

export const dynamic = "force-dynamic"

const NOME_DO_SLOT: Record<string, string> = {
  wa1: "WhatsApp 1",
  wa2: "WhatsApp 2",
  business: "Business",
}

function haQuantoTempo(desde: Date): string {
  const horas = Math.floor((Date.now() - desde.getTime()) / 3_600_000)
  if (horas < 24) return `${horas}h`
  return `${Math.floor(horas / 24)}d ${horas % 24}h`
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const [numeros, saudaveis, comIncidente, params] = await Promise.all([
    contadores(),
    contasSaudaveis(),
    contasComIncidenteAberto(),
    searchParams,
  ])
  const naoEncontrado = params["nao-encontrado"]
  const idNaoEncontrado = Array.isArray(naoEncontrado) ? naoEncontrado[0] : naoEncontrado

  return (
    <div className="flex flex-col gap-8 p-6">
      {idNaoEncontrado && (
        <div className="rounded-md border border-destructive/50 px-4 py-2 text-sm text-destructive">
          ID não encontrado: {idNaoEncontrado}
        </div>
      )}

      <div className="flex gap-8 text-sm">
        <div>
          <div className="text-2xl font-medium">{numeros.aparelhosAtivos}</div>
          <div className="text-muted-foreground">aparelhos ativos</div>
        </div>
        <div>
          <div className="text-2xl font-medium">{numeros.contasSaudaveis}</div>
          <div className="text-muted-foreground">contas saudáveis</div>
        </div>
        <div>
          <div className="text-2xl font-medium">{numeros.chipsNaPasta}</div>
          <div className="text-muted-foreground">chips livres na pasta</div>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Fora do ar ({comIncidente.length})</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aparelho</TableHead>
              <TableHead>Slot</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Há quanto tempo</TableHead>
              <TableHead>Análise</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comIncidente.map((c) => (
              <TableRow key={c.incidentId}>
                <TableCell>
                  <Link href={`/aparelho/${c.deviceId}`} className="underline">
                    {c.deviceId}
                  </Link>
                </TableCell>
                <TableCell>{NOME_DO_SLOT[c.slot]}</TableCell>
                <TableCell>{c.numero}</TableCell>
                <TableCell>
                  <Badge variant={c.tipo === "ban" ? "destructive" : "secondary"}>
                    {c.tipo === "ban" ? "Ban" : "Restrição"}
                  </Badge>
                </TableCell>
                <TableCell>{haQuantoTempo(c.inicio)}</TableCell>
                <TableCell>{c.resultado ?? "—"}</TableCell>
              </TableRow>
            ))}
            {comIncidente.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Nada restrito no momento.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Saudáveis ({saudaveis.length})</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aparelho</TableHead>
              <TableHead>Slot</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Operadora</TableHead>
              <TableHead>Chip</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {saudaveis.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/aparelho/${c.deviceId}`} className="underline">
                    {c.deviceId}
                  </Link>
                </TableCell>
                <TableCell>{NOME_DO_SLOT[c.slot]}</TableCell>
                <TableCell>{c.numero}</TableCell>
                <TableCell>{c.operadora}</TableCell>
                <TableCell>
                  <Link href={`/chip/${c.chipId}`} className="underline">
                    {c.chipId}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
