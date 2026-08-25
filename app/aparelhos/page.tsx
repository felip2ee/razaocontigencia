import { Smartphone } from "lucide-react"
import Link from "next/link"

import { ConexaoBadge } from "@/components/conexao-badge"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { StatusBadge, StatusDeCadastro } from "@/components/status-badge"
import { VerificarConexao } from "@/components/verificar-conexao"
import { VerificarTodas } from "@/components/verificar-todas"
import { listarAparelhosComResumo } from "@/lib/queries"
import { NOME_DO_SLOT } from "@/lib/slots"
import { cn, LINK } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function Page() {
  const aparelhos = await listarAparelhosComResumo()
  const todasAsContas = aparelhos.flatMap((a) => a.contas.map((c) => c.id))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Aparelhos"
        subtitulo="Panorama de cada aparelho: contas ativas, conexão e histórico de bans."
        acoes={<VerificarTodas accountIds={todasAsContas} />}
      />

      {aparelhos.length === 0 ? (
        <EmptyState
          Icone={Smartphone}
          titulo="Nenhum aparelho cadastrado"
          descricao="Cadastre um aparelho para começar."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {aparelhos.map((a) => (
            <div
              key={a.id}
              className="bg-card border-border flex flex-col gap-3 rounded-xl border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/aparelho/${a.id}`} className={cn(LINK, "font-medium")}>
                    {a.id}
                  </Link>
                  <div className="text-muted-foreground truncate text-sm">
                    {a.apelido ?? "Sem apelido"}
                  </div>
                </div>
                <StatusDeCadastro valor={a.status} />
              </div>

              <div className="text-muted-foreground text-xs tracking-wide uppercase">
                Bans no histórico:{" "}
                <span className="text-foreground font-medium tabular-nums">{a.totalBans}</span>
              </div>

              {a.contas.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma conta ativa.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {a.contas.map((c) => (
                    <div
                      key={c.id}
                      className="border-border flex flex-col gap-1.5 rounded-lg border p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium tabular-nums">{c.numero}</span>
                        <span className="text-muted-foreground text-xs">
                          {NOME_DO_SLOT[c.slot]}
                        </span>
                      </div>
                      <StatusBadge
                        estado={c.incidenteAberto ? (c.incidenteAberto === "ban" ? "ban" : "restricao") : "ok"}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <ConexaoBadge
                          status={c.evolutionStatus}
                          proxy={c.proxyStatus}
                          statusVerificadoEm={c.statusVerificadoEm}
                        />
                        <VerificarConexao accountId={c.id} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
