import { FormAcao } from "@/components/form-acao"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { criarAparelho, criarChip } from "@/lib/actions"

export const dynamic = "force-dynamic"

export default async function Page() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Cadastro"
        subtitulo="A ordem natural é aparelho, depois chip, depois a conta que liga os dois."
      />

      {/* lg e não md: a sidebar fixa de 224px come a largura, então em 900px
          de viewport o conteúdo só tem ~650px e duas colunas ficariam apertadas. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card border-border rounded-xl border p-5">
          <h2 className="font-medium">Novo aparelho</h2>
          <p className="text-muted-foreground mt-0.5 mb-4 text-sm">
            Quando um celular novo entra na frota.
          </p>
          <FormAcao acao={criarAparelho} className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ap-id">ID colado no aparelho</Label>
              <Input id="ap-id" name="id" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ap-apelido">Apelido</Label>
              <Input id="ap-apelido" name="apelido" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ap-notas">Notas</Label>
              <Input id="ap-notas" name="notas" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ap-origem">Origem</Label>
              <select
                id="ap-origem"
                name="origem"
                required
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="propria">Própria</option>
                <option value="externa">Externa</option>
              </select>
            </div>
            <Button type="submit">Cadastrar aparelho</Button>
          </FormAcao>
        </div>

        <div className="bg-card border-border rounded-xl border p-5">
          <h2 className="font-medium">Novo chip</h2>
          <p className="text-muted-foreground mt-0.5 mb-4 text-sm">
            Quando um chip novo chega e vai para a pasta.
          </p>
          <FormAcao acao={criarChip} className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ch-id">ID colado no chip</Label>
              <Input id="ch-id" name="id" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ch-operadora">Operadora</Label>
              <Input id="ch-operadora" name="operadora" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ch-numero">Número</Label>
              <Input id="ch-numero" name="numero" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ch-posicao">Posição na pasta</Label>
              <Input id="ch-posicao" name="posicao" placeholder="pasta 2, folha 3" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ch-origem">Origem</Label>
              <select
                id="ch-origem"
                name="origem"
                required
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="propria">Própria</option>
                <option value="externa">Externa</option>
              </select>
            </div>
            <Button type="submit">Cadastrar chip</Button>
          </FormAcao>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        Para ativar uma conta, abra o aparelho e use o slot livre, ou abra o chip e use
        &ldquo;Ativar conta com este chip&rdquo;.
      </p>
    </div>
  )
}
