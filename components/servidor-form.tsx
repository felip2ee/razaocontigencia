"use client"

import { FormAcao } from "@/components/form-acao"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  alternarServidorEvolution,
  criarServidorEvolution,
  editarServidorEvolution,
  removerServidorEvolution,
} from "@/lib/actions"

export function CriarServidor() {
  return (
    <FormAcao acao={criarServidorEvolution} className="flex flex-col gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="sv-nome">Nome</Label>
        <Input id="sv-nome" name="nome" required placeholder="Evo Principal" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sv-url">URL</Label>
        <Input id="sv-url" name="url" required placeholder="https://evo.exemplo.com.br" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sv-key">API key</Label>
        <Input id="sv-key" name="apiKey" type="password" required />
      </div>
      <Button type="submit" className="self-start">
        Cadastrar servidor
      </Button>
    </FormAcao>
  )
}

export function EditarServidor({
  servidor,
}: {
  servidor: { id: number; nome: string; url: string; apiKeyMascara: string }
}) {
  return (
    <FormAcao acao={editarServidorEvolution} className="flex flex-col gap-3">
      <input type="hidden" name="serverId" value={servidor.id} />
      <div className="grid gap-1.5">
        <Label htmlFor={`sv-nome-${servidor.id}`}>Nome</Label>
        <Input id={`sv-nome-${servidor.id}`} name="nome" defaultValue={servidor.nome} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`sv-url-${servidor.id}`}>URL</Label>
        <Input id={`sv-url-${servidor.id}`} name="url" defaultValue={servidor.url} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`sv-key-${servidor.id}`}>API key</Label>
        <Input
          id={`sv-key-${servidor.id}`}
          name="apiKey"
          type="password"
          placeholder={`${servidor.apiKeyMascara} — deixe vazio para manter`}
        />
      </div>
      <Button type="submit" size="sm" variant="outline" className="self-start">
        Salvar
      </Button>
    </FormAcao>
  )
}

export function AlternarServidor({ id, ativo }: { id: number; ativo: boolean }) {
  return (
    <form action={alternarServidorEvolution}>
      <input type="hidden" name="serverId" value={id} />
      <Button type="submit" size="sm" variant="outline">
        {ativo ? "Desativar" : "Ativar"}
      </Button>
    </form>
  )
}

export function RemoverServidor({ id }: { id: number }) {
  return (
    <FormAcao acao={removerServidorEvolution}>
      <input type="hidden" name="serverId" value={id} />
      <Button type="submit" size="sm" variant="destructive">
        Remover
      </Button>
    </FormAcao>
  )
}
