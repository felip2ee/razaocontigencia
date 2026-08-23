import { CircuitBoard, Search, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/empty-state"
import { EncerrarIncidente } from "@/components/incident-form"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Input } from "@/components/ui/input"
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
  const minutos = Math.floor((Date.now() - desde.getTime()) / 60_000)
  if (minutos < 60) return `${minutos}min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `${horas}h`
  return `${Math.floor(horas / 24)}d ${horas % 24}h`
}

function texto(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const idNaoEncontrado = texto(params["nao-encontrado"])
  const filtro = texto(params.filtro)

  const [numeros, saudaveis, comIncidente] = await Promise.all([
    contadores(),
    contasSaudaveis(filtro),
    contasComIncidenteAberto(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Painel"
        subtitulo="O que está no ar, o que caiu e o que precisa de você agora."
      />

      {idNaoEncontrado && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-4 py-2.5 text-sm">
          Nenhum aparelho ou chip com o ID <strong>{idNaoEncontrado}</strong>.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          rotulo="Aparelhos"
          valor={numeros.aparelhosAtivos}
          detalhe="em circulação"
          Icone={Smartphone}
        />
        <StatCard
          rotulo="Contas saudáveis"
          valor={numeros.contasSaudaveis}
          detalhe="prontas para uso"
          Icone={ShieldCheck}
        />
        <StatCard
          rotulo="Fora do ar"
          valor={comIncidente.length}
          detalhe="com restrição ou ban aberto"
          Icone={ShieldAlert}
        />
        <StatCard
          rotulo="Chips livres"
          valor={numeros.chipsLivres}
          detalhe="disponíveis para ativar"
          Icone={CircuitBoard}
        />
      </div>

      <section className="bg-card border-border overflow-hidden rounded-xl border">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-medium">Precisa de você</h2>
          <span className="text-muted-foreground text-sm tabular-nums">
            {comIncidente.length}
          </span>
        </div>
        {comIncidente.length === 0 ? (
          <EmptyState
            Icone={ShieldCheck}
            titulo="Nada fora do ar"
            descricao="Nenhuma conta está com restrição ou ban aberto."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aparelho</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Há</TableHead>
                  <TableHead>Análise</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comIncidente.map((c) => (
                  <TableRow key={c.incidentId}>
                    <TableCell>
                      <Link
                        href={`/aparelho/${c.deviceId}`}
                        className="hover:text-primary font-medium"
                      >
                        {c.deviceId}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {NOME_DO_SLOT[c.slot]}
                    </TableCell>
                    <TableCell className="tabular-nums">{c.numero}</TableCell>
                    <TableCell>
                      <StatusBadge estado={c.tipo === "ban" ? "ban" : "restricao"} />
                    </TableCell>
                    <TableCell className="tabular-nums">{haQuantoTempo(c.inicio)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.resultado ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <EncerrarIncidente incidentId={c.incidentId} tipo={c.tipo} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="bg-card border-border overflow-hidden rounded-xl border">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="font-medium">
            Saudáveis{" "}
            <span className="text-muted-foreground font-normal tabular-nums">
              ({saudaveis.length})
            </span>
          </h2>
          <form className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              name="filtro"
              defaultValue={filtro ?? ""}
              placeholder="Filtrar por aparelho, número ou chip"
              className="h-9 w-72 pl-8"
              aria-label="Filtrar contas saudáveis"
            />
          </form>
        </div>
        {saudaveis.length === 0 ? (
          <EmptyState
            Icone={Search}
            titulo={filtro ? "Nada encontrado" : "Nenhuma conta ativa"}
            descricao={
              filtro
                ? `Nenhuma conta saudável combina com "${filtro}".`
                : "Ative uma conta no cadastro para começar."
            }
          />
        ) : (
          <div className="overflow-x-auto">
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
                      <Link
                        href={`/aparelho/${c.deviceId}`}
                        className="hover:text-primary font-medium"
                      >
                        {c.deviceId}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {NOME_DO_SLOT[c.slot]}
                    </TableCell>
                    <TableCell className="tabular-nums">{c.numero}</TableCell>
                    <TableCell className="text-muted-foreground">{c.operadora}</TableCell>
                    <TableCell>
                      <Link href={`/chip/${c.chipId}`} className="hover:text-primary">
                        {c.chipId}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
