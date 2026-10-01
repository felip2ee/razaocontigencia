import {
  CircuitBoard,
  Download,
  FileSpreadsheet,
  ShieldAlert,
  ShieldX,
  Smartphone,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { buttonVariants } from "@/components/ui/button"
import { carregarRelatorio } from "@/lib/relatorio-queries"

export const dynamic = "force-dynamic"

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

const EXPORTACOES = [
  {
    arquivo: "resumo",
    titulo: "Resumo",
    descricao: "Todos os indicadores e suas contagens em uma planilha.",
  },
  {
    arquivo: "chips",
    titulo: "Chips utilizados",
    descricao: "Origem, situação, aparelhos e ocorrências de cada chip usado.",
  },
  {
    arquivo: "incidentes",
    titulo: "Incidentes",
    descricao: "Histórico completo de restrições e bans, inclusive os abertos.",
  },
  {
    arquivo: "aparelhos",
    titulo: "Aparelhos utilizados",
    descricao: "Origem, situação, chips e ocorrências de cada aparelho usado.",
  },
] as const

export default async function RelatorioPage() {
  const { resumo, geradoEm } = await carregarRelatorio()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Relatório da campanha"
        subtitulo="Todo o histórico registrado até agora."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          rotulo="Chips utilizados"
          valor={resumo.chipsUtilizados}
          detalhe="com ao menos uma conta"
          Icone={CircuitBoard}
        />
        <StatCard
          rotulo="Chips com problema"
          valor={resumo.chipsComProblema}
          detalhe="com restrição ou ban"
          Icone={ShieldAlert}
        />
        <StatCard
          rotulo="Chips perdidos"
          valor={resumo.chipsPerdidos}
          detalhe="ban com perda definitiva"
          Icone={ShieldX}
        />
        <StatCard
          rotulo="Aparelhos utilizados"
          valor={resumo.aparelhosUtilizados}
          detalhe="com ao menos uma conta"
          Icone={Smartphone}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium">Resumo do histórico</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <div>
            <h3 className="text-sm text-muted-foreground">Chips utilizados</h3>
            <p className="mt-1 text-sm tabular-nums">
              {resumo.chipsProprios} próprios · {resumo.chipsExternos} externos
            </p>
          </div>
          <div>
            <h3 className="text-sm text-muted-foreground">
              Aparelhos utilizados
            </h3>
            <p className="mt-1 text-sm tabular-nums">
              {resumo.aparelhosProprios} próprios · {resumo.aparelhosExternos}{" "}
              externos
            </p>
          </div>
          <div>
            <h3 className="text-sm text-muted-foreground">Incidentes</h3>
            <p className="mt-1 text-sm tabular-nums">
              {resumo.incidentes} no total · {resumo.restricoes} restrições ·{" "}
              {resumo.bans} bans
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <FileSpreadsheet
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="font-medium">Exportar dados</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {EXPORTACOES.map(({ arquivo, titulo, descricao }) => (
            <div
              key={arquivo}
              className="flex flex-col rounded-xl border border-border bg-card p-4"
            >
              <h3 className="font-medium">{titulo}</h3>
              <p className="mt-1 mb-4 flex-1 text-sm text-muted-foreground">
                {descricao}
              </p>
              <a
                href={`/relatorio/exportar/${arquivo}`}
                download
                className={buttonVariants({ variant: "outline" })}
                aria-label={`Baixar CSV de ${titulo.toLowerCase()}`}
              >
                <Download aria-hidden="true" />
                Baixar CSV
              </a>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Dados gerados em{" "}
        <time dateTime={geradoEm.toISOString()}>
          {formatoDataHora.format(geradoEm)}
        </time>{" "}
        (horário de Brasília).
      </p>
    </div>
  )
}
