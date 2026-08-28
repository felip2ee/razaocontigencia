import { CircuitBoard } from "lucide-react"
import Link from "next/link"

import { ConexaoBadge } from "@/components/conexao-badge"
import { EmptyState } from "@/components/empty-state"
import { FiltroLista } from "@/components/filtro-lista"
import { OrigemBadge } from "@/components/origem-badge"
import { PageHeader } from "@/components/page-header"
import { StatusDeCadastro } from "@/components/status-badge"
import { VerificarConexao } from "@/components/verificar-conexao"
import { VerificarTodas } from "@/components/verificar-todas"
import { ViewToggle } from "@/components/view-toggle"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { listarChipsComResumo } from "@/lib/queries"
import { NOME_DO_SLOT } from "@/lib/slots"
import { cn, LINK } from "@/lib/utils"

export const dynamic = "force-dynamic"

const LOCAL_TEXTO: Record<string, string> = {
  pasta: "Pasta",
  gaveta: "Gaveta",
  bandeja: "Bandeja",
}

function textoDoLocal(local: string, posicao: string | null) {
  if (local === "pasta" && posicao) return `Pasta — ${posicao}`
  return LOCAL_TEXTO[local] ?? local
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const status = typeof params.status === "string" && params.status !== "" ? params.status : undefined
  const origem = typeof params.origem === "string" && params.origem !== "" ? params.origem : undefined
  const q = typeof params.q === "string" && params.q !== "" ? params.q : undefined
  const view = params.view === "lista" ? "lista" : "blocos"

  const chips = await listarChipsComResumo({ status, origem, q })
  const todasAsContas = chips.flatMap((c) => (c.conta ? [c.conta.id] : []))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Chips"
        subtitulo="Cada chip, o número, onde está guardado e a conexão da conta que ele gerou."
        acoes={<VerificarTodas accountIds={todasAsContas} />}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FiltroLista
          statusOpcoes={[
            { valor: "novo", rotulo: "Novo" },
            { valor: "em_uso", rotulo: "Em uso" },
            { valor: "aposentado", rotulo: "Aposentado" },
          ]}
          statusAtual={status}
          origemAtual={origem}
          buscaAtual={q}
          viewAtual={view === "lista" ? "lista" : undefined}
          buscaPlaceholder="ID, número ou operadora"
        />
        <ViewToggle params={params} atual={view} />
      </div>

      {chips.length === 0 ? (
        <EmptyState
          Icone={CircuitBoard}
          Ilustracao="/vazio-cadastro.png"
          titulo="Nenhum chip encontrado"
          descricao="Ajuste a busca ou os filtros, ou cadastre um chip."
        />
      ) : view === "lista" ? (
        <div className="bg-card border-border overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Operadora</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Conexão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chips.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/chip/${c.id}`} className={cn(LINK, "font-medium")}>
                      {c.id}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">{c.numero}</TableCell>
                  <TableCell className="text-muted-foreground">{c.operadora}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {textoDoLocal(c.local, c.posicao)}
                  </TableCell>
                  <TableCell>
                    <StatusDeCadastro valor={c.status} colorido />
                  </TableCell>
                  <TableCell>
                    <OrigemBadge origem={c.origem} />
                    {c.origem === "propria" && (
                      <span className="text-muted-foreground text-xs">Própria</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.conta ? (
                      <Link href={`/aparelho/${c.conta.deviceId}`} className={LINK}>
                        {c.conta.deviceId} — {NOME_DO_SLOT[c.conta.slot]}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.conta ? (
                      <div className="flex items-center gap-2">
                        <ConexaoBadge
                          status={c.conta.evolutionStatus}
                          proxy={c.conta.proxyStatus}
                          statusVerificadoEm={c.conta.statusVerificadoEm}
                        />
                        <VerificarConexao accountId={c.conta.id} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
                <div className="flex flex-col items-end gap-1">
                  <StatusDeCadastro valor={c.status} colorido />
                  <OrigemBadge origem={c.origem} />
                </div>
              </div>

              <div className="text-muted-foreground text-xs tracking-wide uppercase">
                {LOCAL_TEXTO[c.local]}
                {c.local === "pasta" && c.posicao && (
                  <span className="text-foreground normal-case"> — {c.posicao}</span>
                )}
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
