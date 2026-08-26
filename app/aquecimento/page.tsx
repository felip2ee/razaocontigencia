import { CheckCircle2, Flame, Smartphone } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { FormAcao } from "@/components/form-acao"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { gerarAquecimentoDeHoje, marcarTarefa } from "@/lib/actions"
import { tarefasDoDia, type TarefaDoDia } from "@/lib/queries"
import { NOME_DO_SLOT } from "@/lib/slots"
import { hojeISO } from "@/lib/warmup"

export const dynamic = "force-dynamic"

export default async function Page() {
  const tarefas = await tarefasDoDia(hojeISO())

  const porAparelho = new Map<string, TarefaDoDia[]>()
  for (const t of tarefas) {
    const lista = porAparelho.get(t.deviceId) ?? []
    lista.push(t)
    porAparelho.set(t.deviceId, lista)
  }

  const feitas = tarefas.filter((t) => t.status !== "pendente").length
  const total = tarefas.length
  const percentual = total === 0 ? 0 : Math.round((feitas / total) * 100)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Aquecimento de hoje"
        subtitulo="Faça um aparelho por vez. Marque o que fez para não repetir."
        acoes={
          <FormAcao acao={gerarAquecimentoDeHoje}>
            <Button type="submit">Gerar tarefas de hoje</Button>
          </FormAcao>
        }
      />

      {total > 0 && (
        <div className="bg-card border-border rounded-xl border p-4">
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-medium">
              <span className="tabular-nums">{feitas}</span> de{" "}
              <span className="tabular-nums">{total}</span> feitas
            </div>
            <div className="text-muted-foreground text-sm tabular-nums">{percentual}%</div>
          </div>
          <div
            role="progressbar"
            aria-valuenow={feitas}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label="Tarefas feitas hoje"
            className="bg-muted mt-2 h-2 overflow-hidden rounded-full"
          >
            <div
              className="bg-primary h-full rounded-full transition-[width]"
              style={{ width: `${percentual}%` }}
            />
          </div>
        </div>
      )}

      {total === 0 && (
        <div className="bg-card border-border rounded-xl border">
          <EmptyState
            Icone={Flame}
            Ilustracao="/vazio-busca.png"
            titulo="Nada sorteado para hoje"
            descricao="Clique em Gerar tarefas de hoje. Contas com restrição ou ban aberto ficam de fora."
          />
        </div>
      )}

      {[...porAparelho.entries()].map(([deviceId, lista]) => {
        const feitasNoAparelho = lista.filter((t) => t.status !== "pendente").length
        const concluido = feitasNoAparelho === lista.length

        return (
          <details
            key={deviceId}
            open={!concluido}
            className="bg-card border-border group rounded-xl border"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
              {concluido ? (
                <CheckCircle2 className="text-status-ok size-4 shrink-0" />
              ) : (
                <Smartphone className="text-muted-foreground size-4 shrink-0" />
              )}
              <span className="font-medium">{deviceId}</span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {feitasNoAparelho}/{lista.length}
              </span>
              <div
                role="progressbar"
                aria-valuenow={feitasNoAparelho}
                aria-valuemin={0}
                aria-valuemax={lista.length}
                aria-label={`Tarefas feitas no aparelho ${deviceId}`}
                className="bg-muted ml-auto h-1.5 w-24 overflow-hidden rounded-full"
              >
                <div
                  className={concluido ? "bg-status-ok h-full" : "bg-primary h-full"}
                  style={{ width: `${(feitasNoAparelho / lista.length) * 100}%` }}
                />
              </div>
            </summary>

            <ul className="border-border flex flex-col border-t">
              {lista.map((t) => (
                <li
                  key={t.id}
                  className="border-border flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0"
                >
                  <span className="text-muted-foreground w-32 shrink-0 text-xs">
                    {NOME_DO_SLOT[t.slot]}
                  </span>
                  <span className="w-32 shrink-0 tabular-nums">{t.numero}</span>
                  <span className="min-w-48 flex-1">
                    {t.acao}
                    {t.parNumero && (
                      <span className="text-muted-foreground">
                        {" "}
                        — com {t.parNumero} ({t.parDeviceId})
                      </span>
                    )}
                  </span>
                  {t.status === "pendente" ? (
                    <div className="flex gap-2">
                      <form action={marcarTarefa}>
                        <input type="hidden" name="tarefaId" value={t.id} />
                        <input type="hidden" name="status" value="feito" />
                        <Button type="submit" size="sm">
                          Feito
                        </Button>
                      </form>
                      <form action={marcarTarefa}>
                        <input type="hidden" name="tarefaId" value={t.id} />
                        <input type="hidden" name="status" value="pulado" />
                        <Button type="submit" size="sm" variant="outline">
                          Pular
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <span
                      className={
                        t.status === "feito"
                          ? "text-status-ok text-xs font-medium"
                          : "text-muted-foreground text-xs"
                      }
                    >
                      {t.status === "feito" ? "Feito" : "Pulado"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )
      })}
    </div>
  )
}
