import { asc, eq, or } from "drizzle-orm"
import { ShieldCheck } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import {
  CancelarConta,
  CorrigirAparelho,
  DefinirInstancia,
  EditarAparelho,
} from "@/components/aparelho-form"
import { ConexaoBadge } from "@/components/conexao-badge"
import { EmptyState } from "@/components/empty-state"
import { FormAcao } from "@/components/form-acao"
import { EncerrarIncidente, RegistrarIncidente } from "@/components/incident-form"
import { OrigemBadge } from "@/components/origem-badge"
import { PageHeader } from "@/components/page-header"
import { ReconectarDialog } from "@/components/reconectar-dialog"
import { StatusBadge, StatusDeCadastro } from "@/components/status-badge"
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
import { db } from "@/lib/db"
import { listarInstancias } from "@/lib/evolution"
import { fichaDoAparelho, servidoresEvolutionAtivos } from "@/lib/queries"
import { device } from "@/lib/schema"
import { NOME_DO_SLOT, SLOTS } from "@/lib/slots"
import { cn, LINK } from "@/lib/utils"
import { tempoDecorrido } from "@/lib/tempo"
import { idadeEmDias } from "@/lib/warmup"
import { VerificarConexao } from "@/components/verificar-conexao"

export const dynamic = "force-dynamic"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ficha = await fichaDoAparelho(id)
  if (!ficha) notFound()

  const aparelhos = await db
    .select({ id: device.id, apelido: device.apelido })
    .from(device)
    .where(or(eq(device.status, "ativo"), eq(device.id, id)))
    .orderBy(asc(device.id))

  const servidores = await servidoresEvolutionAtivos()
  const { instancias, falharam } = await listarInstancias(servidores)

  const hoje = new Date()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo={ficha.device.id}
        subtitulo={ficha.device.apelido ?? "Sem apelido"}
        acoes={
          <FormAcao acao={mudarStatusDoAparelho} className="flex gap-2">
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
          </FormAcao>
        }
      />

      <div className="bg-card border-border flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border px-4 py-3 text-sm">
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Status
          </div>
          <div className="mt-0.5">
            <StatusDeCadastro valor={ficha.device.status} />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Bans no histórico
          </div>
          <div className="mt-0.5 font-medium tabular-nums">{ficha.totalBans}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Origem
          </div>
          <div className="mt-0.5">
            <OrigemBadge origem={ficha.device.origem} />
            {ficha.device.origem === "propria" && (
              <span className="text-muted-foreground text-sm">Própria</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Chip na bandeja
          </div>
          <div className="mt-0.5">
            {ficha.chipNaBandeja ? (
              <Link
                href={`/chip/${ficha.chipNaBandeja.id}`}
                className={cn(LINK, "font-medium")}
              >
                {ficha.chipNaBandeja.id} —{" "}
                <span className="tabular-nums">{ficha.chipNaBandeja.numero}</span> (
                {ficha.chipNaBandeja.operadora})
              </Link>
            ) : (
              <span className="text-muted-foreground">Bandeja vazia</span>
            )}
          </div>
        </div>
      </div>

      <section className="bg-card border-border rounded-xl border p-4">
        <h2 className="mb-3 font-medium">Editar aparelho</h2>
        <EditarAparelho
          deviceId={ficha.device.id}
          apelido={ficha.device.apelido}
          notas={ficha.device.notas}
          origem={ficha.device.origem}
        />
      </section>

      {/* lg e não md: a sidebar fixa de 224px come a largura, então em 900px
          de viewport o conteúdo só tem ~650px e três colunas ficariam apertadas. */}
      <div className="grid gap-3 lg:grid-cols-3">
        {SLOTS.map((slot) => {
          const c = ficha.contas.find((conta) => conta.slot === slot)

          // Slot nunca ativado, ou liberado por ban perdido: o operador
          // precisa ver a vaga, senão ela some da tela e da cabeça dele.
          if (!c) {
            return (
              <div
                key={slot}
                className="bg-card border-border flex flex-col gap-2 rounded-xl border p-4"
              >
                <div className="text-muted-foreground text-xs tracking-wide uppercase">
                  {NOME_DO_SLOT[slot]}
                </div>
                <div className="text-muted-foreground">Slot livre</div>
                <Link href="/cadastro" className={cn(LINK, "mt-auto text-sm")}>
                  Ativar conta aqui
                </Link>
              </div>
            )
          }

          return (
            <div
              key={c.id}
              className="bg-card border-border flex flex-col gap-2 rounded-xl border p-4"
            >
              <div className="text-muted-foreground text-xs tracking-wide uppercase">
                {NOME_DO_SLOT[c.slot]}
              </div>
              <div className="text-lg font-medium tabular-nums">{c.numero}</div>
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-sm">
                <Link href={`/chip/${c.chipId}`} className={LINK}>
                  {c.chipId}
                </Link>
                <span className="tabular-nums">
                  {idadeEmDias(c.ativadaEm, hoje)} dias
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  estado={
                    c.incidenteAberto
                      ? c.incidenteAberto.tipo === "ban"
                        ? "ban"
                        : "restricao"
                      : "ok"
                  }
                />
                {c.incidenteAberto && (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    há {tempoDecorrido(c.incidenteAberto.inicio)}
                  </span>
                )}
              </div>
              <div className="mt-auto pt-1">
                {c.incidenteAberto ? (
                  <EncerrarIncidente
                    incidentId={c.incidenteAberto.incidentId}
                    tipo={c.incidenteAberto.tipo}
                  />
                ) : (
                  <RegistrarIncidente accountId={c.id} />
                )}
              </div>
              <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                <ConexaoBadge
                  status={c.evolutionStatus}
                  proxy={c.proxyStatus}
                  statusVerificadoEm={c.statusVerificadoEm}
                />
                {c.evolutionStatus === "fechada" ? (
                  <ReconectarDialog accountId={c.id} />
                ) : (
                  <VerificarConexao accountId={c.id} />
                )}
              </div>
              <div className="border-border flex flex-col gap-1 border-t pt-2">
                {c.evolutionServerNome && c.instanceName && (
                  <div className="text-muted-foreground text-xs">
                    {c.evolutionServerNome} · {c.instanceName}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <DefinirInstancia
                    accountId={c.id}
                    instanciaAtual={
                      c.evolutionServerId && c.instanceName
                        ? { serverId: c.evolutionServerId, nome: c.instanceName }
                        : null
                    }
                    instancias={instancias}
                    falharam={falharam}
                  />
                </div>
              </div>
              <div className="border-border flex flex-wrap items-center gap-2 border-t pt-2">
                <CorrigirAparelho
                  accountId={c.id}
                  aparelhos={aparelhos}
                  slotAtual={c.slot}
                  deviceIdAtual={c.deviceId}
                />
                <CancelarConta accountId={c.id} />
              </div>
            </div>
          )
        })}
      </div>

      <section className="bg-card border-border overflow-hidden rounded-xl border">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-medium">Histórico de incidentes</h2>
          <span className="text-muted-foreground text-sm tabular-nums">
            {ficha.historico.length}
          </span>
        </div>
        {ficha.historico.length === 0 ? (
          <EmptyState
            Icone={ShieldCheck}
            Ilustracao="/vazio-tudo-certo.png"
            titulo="Nenhum incidente"
            descricao="Nenhum incidente registrado neste aparelho."
          />
        ) : (
          <div className="overflow-x-auto">
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
                    <TableCell className="text-muted-foreground">
                      {NOME_DO_SLOT[h.slot]}
                    </TableCell>
                    <TableCell>{h.chipId}</TableCell>
                    <TableCell>{h.tipo === "ban" ? "Ban" : "Restrição"}</TableCell>
                    <TableCell className="tabular-nums">
                      {h.inicio.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {h.fim ? tempoDecorrido(h.inicio, h.fim) : "em curso"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {h.resultado ?? "—"}
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
