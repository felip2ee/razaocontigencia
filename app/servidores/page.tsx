import { Server } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import {
  AlternarServidor,
  CriarServidor,
  EditarServidor,
  RemoverServidor,
} from "@/components/servidor-form"
import { listarServidoresEvolution } from "@/lib/queries"

export const dynamic = "force-dynamic"

export default async function Page() {
  const servidores = await listarServidoresEvolution()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Servidores"
        subtitulo="As Evolutions que o sistema consulta. Cada conta é associada a um servidor."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          {servidores.length === 0 ? (
            <EmptyState
              Icone={Server}
              Ilustracao="/vazio-cadastro.png"
              titulo="Nenhum servidor cadastrado"
              descricao="Cadastre uma Evolution para começar a sincronizar."
            />
          ) : (
            servidores.map((s) => (
              <div
                key={s.id}
                className="bg-card border-border flex flex-col gap-3 rounded-xl border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{s.nome}</div>
                    <div className="text-muted-foreground truncate text-sm">{s.url}</div>
                    <div className="text-muted-foreground text-xs">
                      key {s.apiKeyMascara} · {s.contasVinculadas} conta(s)
                    </div>
                  </div>
                  <span
                    className={
                      s.ativo
                        ? "text-xs font-medium text-emerald-600"
                        : "text-muted-foreground text-xs font-medium"
                    }
                  >
                    {s.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <EditarServidor servidor={s} />
                <div className="flex flex-wrap gap-2">
                  <AlternarServidor id={s.id} ativo={s.ativo} />
                  <RemoverServidor id={s.id} />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-card border-border h-fit rounded-xl border p-5">
          <h2 className="mb-4 font-medium">Novo servidor</h2>
          <CriarServidor />
        </div>
      </div>
    </div>
  )
}
