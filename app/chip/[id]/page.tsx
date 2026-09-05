import { asc, eq } from "drizzle-orm"
import { ShieldCheck } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import {
  AposentarChip,
  EditarChip,
  MoverChip,
  ReativarChip,
} from "@/components/acoes/chip"
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
import { fichaDoChip, servidoresEvolutionAtivos, slotsLivres } from "@/lib/queries"
import { device } from "@/lib/schema"
import { NOME_DO_SLOT } from "@/lib/slots"
import { cn, LINK } from "@/lib/utils"
import { tempoDecorrido } from "@/lib/tempo"
import { idadeEmDias } from "@/lib/warmup"
import { VerificarConexao } from "@/components/verificar-conexao"

export const dynamic = "force-dynamic"

const LOCAL_TEXTO: Record<string, string> = {
  pasta: "Na pasta",
  gaveta: "Na gaveta",
  bandeja: "Na bandeja de um aparelho",
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ficha = await fichaDoChip(id)
  if (!ficha) notFound()

  const aparelhos = await db
    .select({ id: device.id, apelido: device.apelido })
    .from(device)
    .where(eq(device.status, "ativo"))
    .orderBy(asc(device.id))

  const servidores = await servidoresEvolutionAtivos()
  const { instancias, falharam } = await listarInstancias(servidores)
  const vagas = ficha.chip.status === "novo" ? await slotsLivres() : []

  const c = ficha.conta
  const hoje = new Date()

  const ondeEsta =
    ficha.chip.local === "bandeja" && ficha.aparelhoDaBandeja ? (
      <>
        Na bandeja do aparelho{" "}
        <Link
          href={`/aparelho/${ficha.aparelhoDaBandeja.id}`}
          className={cn(LINK, "font-medium")}
        >
          {ficha.aparelhoDaBandeja.id}
        </Link>{" "}
        — só internet 4G
      </>
    ) : ficha.chip.local === "bandeja" ? (
      <span className="text-destructive">
        Na bandeja de um aparelho que não existe mais
        {ficha.chip.bandejaDeviceId ? ` (${ficha.chip.bandejaDeviceId})` : ""}. Mova o
        chip para dizer onde ele está de verdade.
      </span>
    ) : ficha.chip.local === "pasta" && ficha.chip.posicao ? (
      <>Na pasta — {ficha.chip.posicao}</>
    ) : (
      <>{LOCAL_TEXTO[ficha.chip.local] ?? ficha.chip.local}</>
    )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo={ficha.chip.id}
        subtitulo={`${ficha.chip.numero} — ${ficha.chip.operadora}`}
        acoes={
          <div className="flex flex-wrap gap-2">
            <EditarChip
              chipId={ficha.chip.id}
              numero={ficha.chip.numero}
              operadora={ficha.chip.operadora}
              origem={ficha.chip.origem}
            />
            {ficha.chip.status === "aposentado" && !ficha.numeroPerdido && (
              <ReativarChip chipId={ficha.chip.id} />
            )}
            {ficha.chip.status !== "aposentado" && <AposentarChip chipId={ficha.chip.id} />}
          </div>
        }
      />

      <div className="bg-card border-border flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border px-4 py-3 text-sm">
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Situação
          </div>
          <div className="mt-0.5">
            <StatusDeCadastro valor={ficha.chip.status} />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Origem
          </div>
          <div className="mt-0.5">
            <OrigemBadge origem={ficha.chip.origem} />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Onde está
          </div>
          <div className="mt-0.5">{ondeEsta}</div>
        </div>
      </div>

      {c ? (
        <section className="bg-card border-border rounded-xl border p-4">
          <h2 className="font-medium">Conta de WhatsApp</h2>
          <p className="mt-1 text-sm">
            No aparelho{" "}
            <Link href={`/aparelho/${c.deviceId}`} className={cn(LINK, "font-medium")}>
              {c.deviceId}
            </Link>
            {c.deviceApelido ? ` · ${c.deviceApelido}` : ""} — {NOME_DO_SLOT[c.slot]} —
            ativada há <span className="tabular-nums">{idadeEmDias(c.ativadaEm, hoje)}</span>{" "}
            dias
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
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
            <ConexaoBadge
              status={c.evolutionStatus}
              proxy={c.proxyStatus}
              statusVerificadoEm={c.statusVerificadoEm}
            />
            {c.evolutionServerNome && c.instanceName && (
              <span className="text-muted-foreground text-xs">
                {c.evolutionServerNome} · {c.instanceName}
              </span>
            )}
          </div>

          <div className="border-border mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
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

          <div className="border-border mt-3 border-t pt-3">
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
        </section>
      ) : (
        <section className="bg-card border-border rounded-xl border p-4">
          <h2 className="font-medium">Conta de WhatsApp</h2>
          {ficha.chip.status === "aposentado" && ficha.numeroPerdido ? (
            <p className="text-muted-foreground mt-1 text-sm">
              O número deste chip foi perdido em ban. Ele não pode voltar a ser usado.
            </p>
          ) : ficha.chip.status === "aposentado" ? (
            <p className="text-muted-foreground mt-1 text-sm">
              Este chip foi aposentado. Reative para deixá-lo disponível de novo.
            </p>
          ) : ficha.chip.local === "bandeja" ? (
            <p className="text-muted-foreground mt-1 text-sm">
              Este chip não é WhatsApp. Está na bandeja
              {ficha.aparelhoDaBandeja ? ` do ${ficha.aparelhoDaBandeja.id}` : ""} dando
              internet 4G. Restrição e ban não se aplicam.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground mt-1 text-sm">
                Este chip ainda não virou WhatsApp. Ative uma conta para poder registrar
                restrição e ban.
              </p>
              <div className="mt-3">
                <AtivarConta
                  rotulo="Ativar conta com este chip"
                  destino={{ opcoes: vagas }}
                  chip={{
                    id: ficha.chip.id,
                    numero: ficha.chip.numero,
                    operadora: ficha.chip.operadora,
                  }}
                  instancias={instancias}
                  servidores={servidores}
                  falharam={falharam}
                />
              </div>
            </>
          )}
        </section>
      )}

      <section className="bg-card border-border rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Onde está</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">{ondeEsta}</p>
          </div>
          <MoverChip
            chipId={ficha.chip.id}
            local={ficha.chip.local}
            posicao={ficha.chip.posicao}
            bandejaDeviceId={ficha.chip.bandejaDeviceId}
            aparelhos={aparelhos}
          />
        </div>
      </section>

      <section className="bg-card border-border overflow-hidden rounded-xl border">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-medium">Histórico deste número</h2>
          <span className="text-muted-foreground text-sm tabular-nums">
            {ficha.historico.length}
          </span>
        </div>
        {ficha.historico.length === 0 ? (
          <EmptyState
            Icone={ShieldCheck}
            Ilustracao="/vazio-tudo-certo.png"
            titulo="Nenhum incidente"
            descricao="Este número nunca teve restrição nem ban registrados."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Análise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ficha.historico.map((h) => (
                  <TableRow key={h.id}>
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
