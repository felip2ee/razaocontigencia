"use client"

import { useActionState, useEffect, useRef } from "react"

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
  const formulario = useRef<HTMLFormElement>(null)
  const ultimoEnvio = useRef<FormData | null>(null)

  const [estado, enviar] = useActionState(
    async (anterior: EstadoDoForm, formData: FormData) => {
      ultimoEnvio.current = formData
      return acao(anterior, formData)
    },
    null,
  )

  // O React limpa o formulário depois da action. Quando deu erro isso obriga a
  // redigitar tudo, e aqui se digita código de fita à mão: devolvemos os
  // valores para o operador só corrigir o que estava errado.
  useEffect(() => {
    if (!estado?.erro || !formulario.current || !ultimoEnvio.current) return
    for (const [nome, valor] of ultimoEnvio.current.entries()) {
      const campo = formulario.current.elements.namedItem(nome)
      if (typeof valor === "string" && campo && "value" in campo) {
        campo.value = valor
      }
    }
  }, [estado])

  return (
    <form ref={formulario} action={enviar} className={className}>
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
