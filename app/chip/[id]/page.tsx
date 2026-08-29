import { asc, eq } from "drizzle-orm"
import { Archive, FolderOpen, Smartphone, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { CancelarChip, EditarChip, ReativarChip } from "@/components/chip-form"
import { ConexaoBadge } from "@/components/conexao-badge"
import { OrigemBadge } from "@/components/origem-badge"
import { PageHeader } from "@/components/page-header"
import { ReconectarDialog } from "@/components/reconectar-dialog"
import { StatusDeCadastro } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { moverChip } from "@/lib/actions"
import { db } from "@/lib/db"
import { fichaDoChip } from "@/lib/queries"
import { NOME_DO_SLOT } from "@/lib/slots"
import { cn, LINK } from "@/lib/utils"
import { dataBR } from "@/lib/tempo"
import { device } from "@/lib/schema"
import { VerificarConexao } from "@/components/verificar-conexao"

export const dynamic = "force-dynamic"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ficha = await fichaDoChip(id)
  if (!ficha) notFound()

  const aparelhos = await db
    .select()
    .from(device)
    .where(eq(device.status, "ativo"))
    .orderBy(asc(device.id))

  // A pergunta que esta tela existe para responder. Os quatro ramos são
  // exaustivos de propósito: `bandeja` sem aparelho encontrado tem de dizer
  // isso em voz alta, senão o registro mente sobre onde o chip está.
  const localizacao =
    ficha.chip.local === "bandeja" && ficha.aparelhoDaBandeja ? (
      <>
        <Smartphone className="text-muted-foreground mt-1 size-6 shrink-0" />
        <div>
          <p className="text-2xl leading-tight font-semibold">
            Na bandeja do aparelho{" "}
            <Link
              href={`/aparelho/${ficha.aparelhoDaBandeja.id}`}
              className={LINK}
            >
              {ficha.aparelhoDaBandeja.id}
            </Link>
          </p>
          <p className="text-muted-foreground mt-1 text-sm">Chip de rede, 4G.</p>
        </div>
      </>
    ) : ficha.chip.local === "bandeja" ? (
      <>
        <TriangleAlert className="text-destructive mt-1 size-6 shrink-0" />
        <div>
          <p className="text-2xl leading-tight font-semibold">
            Na bandeja de um aparelho que não existe mais
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {ficha.chip.bandejaDeviceId ? (
              <>
                O registro aponta para o aparelho{" "}
                <span className="font-medium">{ficha.chip.bandejaDeviceId}</span>, que não
                está no cadastro.
              </>
            ) : (
              <>O registro não diz em qual aparelho.</>
            )}{" "}
            Mova o chip para dizer onde ele está de verdade.
          </p>
        </div>
      </>
    ) : ficha.chip.local === "gaveta" ? (
      <>
        <Archive className="text-muted-foreground mt-1 size-6 shrink-0" />
        <div>
          <p className="text-2xl leading-tight font-semibold">Na gaveta</p>
          <p className="text-muted-foreground mt-1 text-sm">Fora de uso, guardado.</p>
        </div>
      </>
    ) : (
      <>
        <FolderOpen className="text-muted-foreground mt-1 size-6 shrink-0" />
        <div>
          <p className="text-2xl leading-tight font-semibold">
            Na pasta{ficha.chip.posicao ? ` — ${ficha.chip.posicao}` : ""}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {ficha.chip.posicao
              ? "Fazenda de SMS."
              : "Fazenda de SMS, sem posição anotada."}
          </p>
        </div>
      </>
    )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo={ficha.chip.id}
        subtitulo={`${ficha.chip.numero} — ${ficha.chip.operadora}`}
      />

      <section className="bg-card border-border rounded-xl border p-6">
        <div className="text-muted-foreground text-xs tracking-wide uppercase">
          Onde está
        </div>
        <div className="mt-3 flex items-start gap-3">{localizacao}</div>
      </section>

      <section className="bg-card border-border flex flex-wrap items-start gap-x-10 gap-y-4 rounded-xl border px-4 py-3 text-sm">
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Status
          </div>
          <div className="mt-1">
            <StatusDeCadastro valor={ficha.chip.status} />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Origem
          </div>
          <div className="mt-1">
            <OrigemBadge origem={ficha.chip.origem} />
            {ficha.chip.origem === "propria" && (
              <span className="text-muted-foreground text-sm">Própria</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs tracking-wide uppercase">
            Conta gerada
          </div>
          <div className="mt-1">
            {ficha.conta ? (
              <span>
                <Link
                  href={`/aparelho/${ficha.conta.deviceId}`}
                  className={cn(LINK, "font-medium")}
                >
                  {ficha.conta.deviceId}
                </Link>{" "}
                — {NOME_DO_SLOT[ficha.conta.slot]} — ativada em{" "}
                <span className="tabular-nums">{dataBR(ficha.conta.ativadaEm)}</span> —{" "}
                {ficha.conta.status}
              </span>
            ) : (
              <span className="text-muted-foreground">
                Nenhuma conta usa este chip. É um chip de rede ou está reservado.
              </span>
            )}
          </div>
        </div>
        {ficha.conta && (
          <div>
            <div className="text-muted-foreground text-xs tracking-wide uppercase">
              Conexão Evolution
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ConexaoBadge
                status={ficha.conta.evolutionStatus}
                proxy={ficha.conta.proxyStatus}
                statusVerificadoEm={ficha.conta.statusVerificadoEm}
              />
              {ficha.conta.evolutionStatus === "fechada" ? (
                <ReconectarDialog accountId={ficha.conta.id} />
              ) : (
                <VerificarConexao accountId={ficha.conta.id} />
              )}
            </div>
          </div>
        )}
      </section>

      <section className="bg-card border-border rounded-xl border">
        <div className="border-border border-b px-4 py-3">
          <h2 className="font-medium">Mover</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Só o campo do destino escolhido é guardado; os outros são apagados.
          </p>
        </div>
        <form action={moverChip} className="flex max-w-md flex-col gap-3 p-4">
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
              {/* Sem aparelho ativo não há bandeja possível: oferecer o destino
                  levaria a uma recusa da action, que estoura a tela inteira. */}
              {aparelhos.length > 0 && (
                <option value="bandeja">Bandeja de um aparelho</option>
              )}
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
            {aparelhos.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nenhum aparelho ativo no cadastro, então não há bandeja para onde mover.{" "}
                <Link href="/cadastro" className={LINK}>
                  Cadastre um aparelho
                </Link>{" "}
                para liberar este destino.
              </p>
            ) : (
              <select
                id="mv-device"
                name="bandejaDeviceId"
                defaultValue={ficha.chip.bandejaDeviceId ?? undefined}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                {aparelhos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} {a.apelido ? `— ${a.apelido}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <Button type="submit" className="self-start">
            Mover chip
          </Button>
        </form>
      </section>

      <section className="bg-card border-border rounded-xl border p-4">
        <h2 className="mb-3 font-medium">Editar chip</h2>
        <EditarChip
          chipId={ficha.chip.id}
          numero={ficha.chip.numero}
          operadora={ficha.chip.operadora}
          origem={ficha.chip.origem}
        />
        <div className="mt-4">
          {ficha.chip.status === "aposentado" && ficha.numeroPerdido ? (
            <p className="text-muted-foreground text-sm">
              Número perdido em ban — chip não pode ser reativado.
            </p>
          ) : ficha.chip.status === "aposentado" ? (
            <ReativarChip chipId={ficha.chip.id} />
          ) : (
            <CancelarChip chipId={ficha.chip.id} />
          )}
        </div>
      </section>
    </div>
  )
}
