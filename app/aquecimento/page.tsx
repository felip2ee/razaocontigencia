import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { gerarAquecimentoDeHoje, marcarTarefa } from "@/lib/actions"
import { tarefasDoDia, type TarefaDoDia } from "@/lib/queries"

export const dynamic = "force-dynamic"

const NOME_DO_SLOT: Record<string, string> = {
  wa1: "WhatsApp 1",
  wa2: "WhatsApp 2",
  business: "Business",
}

export default async function Page() {
  const dia = new Date().toISOString().slice(0, 10)
  const tarefas = await tarefasDoDia(dia)

  const porAparelho = new Map<string, TarefaDoDia[]>()
  for (const t of tarefas) {
    const lista = porAparelho.get(t.deviceId) ?? []
    lista.push(t)
    porAparelho.set(t.deviceId, lista)
  }

  const pendentes = tarefas.filter((t) => t.status === "pendente").length

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-center gap-4">
        <h1 className="text-xl font-medium">Aquecimento de hoje</h1>
        <span className="text-muted-foreground text-sm">
          {pendentes} pendente(s) de {tarefas.length}
        </span>
        <form action={gerarAquecimentoDeHoje} className="ml-auto">
          <Button type="submit">Gerar tarefas de hoje</Button>
        </form>
      </header>

      {tarefas.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Nada sorteado ainda. Clique em &quot;Gerar tarefas de hoje&quot;.
        </p>
      )}

      {[...porAparelho.entries()].map(([deviceId, lista]) => (
        <section key={deviceId} className="flex flex-col gap-2">
          <h2 className="font-medium">Aparelho {deviceId}</h2>
          <ul className="flex flex-col gap-1">
            {lista.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <Badge variant="outline">{NOME_DO_SLOT[t.slot]}</Badge>
                <span className="text-muted-foreground w-32 shrink-0">{t.numero}</span>
                <span className="flex-1">
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
                  <Badge variant={t.status === "feito" ? "secondary" : "outline"}>
                    {t.status}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
