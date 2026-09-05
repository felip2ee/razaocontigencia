import { asc, eq, or } from "drizzle-orm"
import { ShieldCheck } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import {
  EditarAparelho,
  MudarSituacao,
  TrocarChipDaBandeja,
} from "@/components/acoes/aparelho"
import {
  AtivarConta,
  MaisAcoesDaConta,
  RegistrarQueda,
  ResolverBan,
  VoltouAoAr,
} from "@/components/acoes/conta"
import { ConexaoBadge } from "@/components/conexao-badge"
import { EmptyState } from "@/components/empty-state"
import { OrigemBadge } from "@/components/origem-badge"
import { PageHeader } from "@/components/page-header"
import { ReconectarDialog } from "@/components/reconectar-dialog"
import { StatusBadge, StatusDeCadastro } from "@/components/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { db } from "@/lib/db"
import { listarInstancias } from "@/lib/evolution"
import {
  chipsLivres,
  chipsParaBandeja,
  fichaDoAparelho,
  servidoresEvolutionAtivos,
} from "@/lib/queries"
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
  const paraBandeja = await chipsParaBandeja(id)
  const livres = await chipsLivres()

  const hoje = new Date()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo={ficha.device.id}
        subtitulo={ficha.device.apelido ?? "Sem apelido"}
        acoes={
          <div className="flex flex-wrap gap-2">
            <EditarAparelho
              deviceId={ficha.device.id}
              apelido={ficha.device.apelido}
              notas={ficha.device.notas}
              origem={ficha.device.origem}
            />
            <MudarSituacao deviceId={ficha.device.id} status={ficha.device.status} />
          </div>
        }
      />

      <div className="bg-card border-border flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border px-4 py-3 text-sm">
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Situação
          </div>
          <div className="mt-0.5">
            <StatusDeCadastro valor={ficha.device.status} />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Origem
          </div>
          <div className="mt-0.5">
            <OrigemBadge origem={ficha.device.origem} />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Contas
          </div>
          <div className="mt-0.5 font-medium tabular-nums">
            {ficha.contas.length} de {SLOTS.length}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Bans no histórico
          </div>
          <div className="mt-0.5 font-medium tabular-nums">{ficha.totalBans}</div>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Contas de WhatsApp</h2>
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
                  <div className="text-muted-foreground">Nenhuma conta aqui</div>
                  <div className="mt-auto pt-1">
                    <AtivarConta
                      rotulo="Ativar conta neste slot"
                      destino={{ deviceId: ficha.device.id, slot }}
                      chip={{ opcoes: livres }}
                      instancias={instancias}
                      servidores={servidores}
                      falharam={falharam}
                    />
                  </div>
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

                <div className="flex flex-wrap items-center gap-2">
                  <ConexaoBadge
                    status={c.evolutionStatus}
                    proxy={c.proxyStatus}
                    statusVerificadoEm={c.statusVerificadoEm}
                  />
                </div>
                {c.evolutionServerNome && c.instanceName && (
                  <div className="text-muted-foreground text-xs">
                    {c.evolutionServerNome} · {c.instanceName}
                  </div>
                )}

                <div className="border-border mt-auto flex flex-wrap items-center gap-2 border-t pt-2">
                  {c.incidenteAberto?.tipo === "ban" ? (
                    <ResolverBan incidentId={c.incidenteAberto.incidentId} />
                  ) : c.incidenteAberto ? (
                    <VoltouAoAr incidentId={c.incidenteAberto.incidentId} />
                  ) : (
                    <RegistrarQueda accountId={c.id} />
                  )}
                  {c.evolutionStatus === "fechada" ? (
                    <ReconectarDialog accountId={c.id} />
                  ) : (
                    <VerificarConexao accountId={c.id} />
                  )}
                </div>

                <div className="border-border border-t pt-2">
                  <MaisAcoesDaConta
                    conta={{
                      id: c.id,
                      deviceId: c.deviceId,
                      slot: c.slot,
                      instanceName: c.instanceName,
                      evolutionServerId: c.evolutionServerId,
                    }}
                    aparelhos={aparelhos}
                    instancias={instancias}
                    servidores={servidores}
                    falharam={falharam}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="bg-card border-border rounded-xl border p-4">
        <h2 className="font-medium">Chip de rede (bandeja)</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Só internet 4G. Não é WhatsApp.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
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
              <span className="text-muted-foreground text-sm">Bandeja vazia</span>
            )}
          </div>
          <TrocarChipDaBandeja
            deviceId={ficha.device.id}
            chipAtualId={ficha.chipNaBandeja?.id ?? null}
            chips={paraBandeja}
          />
        </div>
      </section>

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
