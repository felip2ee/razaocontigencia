import { CircuitBoard } from "lucide-react"
import Link from "next/link"

import { ConexaoBadge } from "@/components/conexao-badge"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { StatusDeCadastro } from "@/components/status-badge"
import { VerificarConexao } from "@/components/verificar-conexao"
import { VerificarTodas } from "@/components/verificar-todas"
import { listarChipsComResumo } from "@/lib/queries"
import { NOME_DO_SLOT } from "@/lib/slots"
import { cn, LINK } from "@/lib/utils"

export const dynamic = "force-dynamic"

const LOCAL_TEXTO: Record<string, string> = {
  pasta: "Pasta",
  gaveta: "Gaveta",
  bandeja: "Bandeja",
}

export default async function Page() {
  const chips = await listarChipsComResumo()
  const todasAsContas = chips.flatMap((c) => (c.conta ? [c.conta.id] : []))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Chips"
        subtitulo="Cada chip, o número, onde está guardado e a conexão da conta que ele gerou."
        acoes={<VerificarTodas accountIds={todasAsContas} />}
      />

      {chips.length === 0 ? (
        <EmptyState
          Icone={CircuitBoard}
          titulo="Nenhum chip cadastrado"
          descricao="Cadastre um chip para começar."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {chips.map((c) => (
            <div
              key={c.id}
              className="bg-card border-border flex flex-col gap-2 rounded-xl border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/chip/${c.id}`} className={cn(LINK, "font-medium")}>
                    {c.id}
                  </Link>
                  <div className="text-sm tabular-nums">{c.numero}</div>
                  <div className="text-muted-foreground truncate text-xs">{c.operadora}</div>
                </div>
                <StatusDeCadastro valor={c.status} />
              </div>

              <div className="text-muted-foreground text-xs tracking-wide uppercase">
                {LOCAL_TEXTO[c.local]}
              </div>

              {c.conta ? (
                <div className="border-border flex flex-col gap-1.5 rounded-lg border p-2.5">
                  <div className="text-muted-foreground text-xs">
                    <Link href={`/aparelho/${c.conta.deviceId}`} className={LINK}>
                      {c.conta.deviceId}
                    </Link>{" "}
                    — {NOME_DO_SLOT[c.conta.slot]}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ConexaoBadge
                      status={c.conta.evolutionStatus}
                      proxy={c.conta.proxyStatus}
                      statusVerificadoEm={c.conta.statusVerificadoEm}
                    />
                    <VerificarConexao accountId={c.conta.id} />
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhuma conta vinculada.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
