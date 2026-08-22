"use client"

import { useActionState } from "react"

import type { EstadoDoForm } from "@/lib/actions"

/**
 * Formulário que mostra, na própria tela, o que a Server Action respondeu: a
 * regra que o banco recusou ("Já existe um aparelho com esse ID") ou o aviso do
 * que de fato aconteceu. Sem isto o erro de constraint vira tela de erro e o
 * operador não sabe o que houve — e num sistema cuja chave é código de fita
 * digitado à mão, o ID repetido é o caso de todo dia.
 */
export function FormAcao({
  acao,
  className,
  children,
}: {
  acao: (estado: EstadoDoForm, formData: FormData) => Promise<EstadoDoForm>
  className?: string
  children: React.ReactNode
}) {
  const [estado, enviar] = useActionState(acao, null)

  return (
    <form action={enviar} className={className}>
      {children}
      {estado?.erro && (
        <p role="alert" className="text-destructive text-sm">
          {estado.erro}
        </p>
      )}
      {estado?.aviso && (
        <p role="status" className="text-muted-foreground text-sm">
          {estado.aviso}
        </p>
      )}
    </form>
  )
}
