"use client"

import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import { verificarConexao } from "@/lib/evolution-actions"

export function VerificarConexao({ accountId }: { accountId: number }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => verificarConexao(accountId))}
    >
      {pending ? "Verificando…" : "Verificar"}
    </Button>
  )
}
