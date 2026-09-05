"use client"

import { useActionState, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { EstadoDoForm } from "@/lib/actions"

/**
 * Botão nomeado que abre uma janela explicada.
 *
 * Antes, cada operação era um `<select>` e um botão soltos no meio do cartão,
 * sem nada dizendo o que aquilo fazia. Aqui o operador lê o título e a frase
 * antes de confirmar, e o erro do banco aparece dentro da janela em vez de
 * derrubar a página.
 *
 * Sem `children` visíveis (só inputs escondidos) vira janela de confirmação.
 */
export function DialogAcao({
  rotulo,
  titulo,
  descricao,
  confirmar = "Confirmar",
  acao,
  variant = "outline",
  size = "sm",
  className,
  children,
}: {
  rotulo: string
  titulo: string
  descricao: string
  confirmar?: string
  acao: (estado: EstadoDoForm, formData: FormData) => Promise<EstadoDoForm>
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost"
  size?: "default" | "sm" | "xs" | "lg"
  className?: string
  children?: React.ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const formulario = useRef<HTMLFormElement>(null)
  const ultimoEnvio = useRef<FormData | null>(null)

  const [estado, enviar, pendente] = useActionState(
    async (anterior: EstadoDoForm, formData: FormData) => {
      ultimoEnvio.current = formData
      return acao(anterior, formData)
    },
    null,
  )

  // Fecha só quando a action confirmou sucesso. É para isto que `ok` existe:
  // sucesso sem aviso e "ainda não enviei" eram os dois `null`.
  useEffect(() => {
    if (estado?.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAberto(false)
    }
  }, [estado])

  // Deu erro: devolve o que foi digitado. O React limpa o formulário depois da
  // action, e aqui se digita código de fita à mão.
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
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setAberto(true)}
      >
        {rotulo}
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>{descricao}</DialogDescription>
          </DialogHeader>
          <form ref={formulario} action={enviar} className="flex flex-col gap-3">
            {children}
            {estado?.erro && (
              <p role="alert" className="text-destructive text-sm">
                {estado.erro}
              </p>
            )}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={pendente}>
                {pendente ? "Salvando…" : confirmar}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
