"use client"

import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import { verificarConexoes } from "@/lib/evolution-actions"

export function VerificarTodas({ accountIds }: { accountIds: number[] }) {
  const [pending, startTransition] = useTransition()

  if (accountIds.length === 0) return null

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => verificarConexoes(accountIds))}
    >
      {pending ? "Verificando…" : `Verificar todas (${accountIds.length})`}
    </Button>
  )
}
