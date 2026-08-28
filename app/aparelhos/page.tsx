import { Smartphone } from "lucide-react"
import Link from "next/link"

import { ConexaoBadge } from "@/components/conexao-badge"
import { EmptyState } from "@/components/empty-state"
import { FiltroLista } from "@/components/filtro-lista"
import { OrigemBadge } from "@/components/origem-badge"
import { PageHeader } from "@/components/page-header"
import { StatusBadge, StatusDeCadastro } from "@/components/status-badge"
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
import { listarAparelhosComResumo } from "@/lib/queries"
import { NOME_DO_SLOT, tipoDoSlot } from "@/lib/slots"
import { cn, LINK } from "@/lib/utils"

export const dynamic = "force-dynamic"

function estadoDaConta(incidenteAberto: "restricao" | "ban" | null) {
  return incidenteAberto ? (incidenteAberto === "ban" ? "ban" : "restricao") : "ok"
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

  const aparelhos = await listarAparelhosComResumo({ status, origem, q })
  const todasAsContas = aparelhos.flatMap((a) => a.contas.map((c) => c.id))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Aparelhos"
        subtitulo="Panorama de cada aparelho: contas ativas, conexão e histórico de bans."
        acoes={<VerificarTodas accountIds={todasAsContas} />}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FiltroLista
          statusOpcoes={[
            { valor: "ativo", rotulo: "Ativo" },
            { valor: "quarentena", rotulo: "Quarentena" },
            { valor: "aposentado", rotulo: "Aposentado" },
          ]}
          statusAtual={status}
          origemAtual={origem}
          buscaAtual={q}
          viewAtual={view === "lista" ? "lista" : undefined}
          buscaPlaceholder="ID ou apelido"
        />
        <ViewToggle params={params} atual={view} />
      </div>

      {aparelhos.length === 0 ? (
        <EmptyState
          Icone={Smartphone}
          Ilustracao="/vazio-cadastro.png"
          titulo="Nenhum aparelho encontrado"
          descricao="Ajuste a busca ou os filtros, ou cadastre um aparelho."
        />
      ) : view === "lista" ? (
        <div className="bg-card border-border overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Apelido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Bans</TableHead>
                <TableHead>Chip</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Saúde</TableHead>
                <TableHead>Conexão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aparelhos.map((a) => {
                const semContas = a.contas.length === 0
                // Cada coluna de conta empilha um valor por conta, na mesma
                // ordem — a linha N de "Chip" é a mesma conta da linha N de
                // "Conexão". É isso que dá o efeito de colunas sem quebrar
                // o aparelho em várias linhas.
                const coluna = (
                  render: (c: (typeof a.contas)[number]) => React.ReactNode,
                ) =>
                  semContas ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {a.contas.map((c) => (
                        <div key={c.id}>{render(c)}</div>
                      ))}
                    </div>
                  )

                return (
                  <TableRow key={a.id}>
                    <TableCell className="align-top">
                      <Link href={`/aparelho/${a.id}`} className={cn(LINK, "font-medium")}>
                        {a.id}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top">
                      {a.apelido ?? "Sem apelido"}
                    </TableCell>
                    <TableCell className="align-top">
                      <StatusDeCadastro valor={a.status} />
                    </TableCell>
                    <TableCell className="align-top">
                      <OrigemBadge origem={a.origem} />
                      {a.origem === "propria" && (
                        <span className="text-muted-foreground text-xs">Própria</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top tabular-nums">{a.totalBans}</TableCell>
                    <TableCell className="align-top">
                      {coluna((c) => (
                        <Link href={`/chip/${c.chipId}`} className={cn(LINK, "text-sm")}>
                          {c.chipId}
                        </Link>
                      ))}
                    </TableCell>
                    <TableCell className="align-top">
                      {coluna((c) => (
                        <span className="text-sm tabular-nums">{c.numero}</span>
                      ))}
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top">
                      {coluna((c) => <span className="text-sm">{tipoDoSlot(c.slot)}</span>)}
                    </TableCell>
                    <TableCell className="align-top">
                      {coluna((c) => (
                        <StatusBadge estado={estadoDaConta(c.incidenteAberto)} />
                      ))}
                    </TableCell>
                    <TableCell className="align-top">
                      {coluna((c) => (
                        <ConexaoBadge
                          status={c.evolutionStatus}
                          proxy={c.proxyStatus}
                          statusVerificadoEm={c.statusVerificadoEm}
                        />
                      ))}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
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
                <div className="flex items-center gap-2">
                  <StatusDeCadastro valor={a.status} />
                  <OrigemBadge origem={a.origem} />
                </div>
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
                        <span className="text-muted-foreground text-xs">{c.chipId}</span>
                        <span className="text-muted-foreground text-xs">
                          {NOME_DO_SLOT[c.slot]}
                        </span>
                      </div>
                      <StatusBadge estado={estadoDaConta(c.incidenteAberto)} />
                      <ConexaoBadge
                        status={c.evolutionStatus}
                        proxy={c.proxyStatus}
                        statusVerificadoEm={c.statusVerificadoEm}
                      />
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
