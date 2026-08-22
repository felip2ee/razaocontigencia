"use client"

import { Button } from "@/components/ui/button"

/**
 * Rede de segurança: o que as actions não conseguem transformar em mensagem de
 * formulário cai aqui, em vez de deixar o operador numa tela de erro crua.
 */
export default function Erro({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <div className="flex flex-col items-start gap-3 p-6">
      <h1 className="text-xl font-medium">Algo deu errado</h1>
      <p className="text-muted-foreground text-sm">
        A operação não foi concluída. Os dados anteriores continuam no lugar.
      </p>
      <p className="text-destructive font-mono text-xs">{error.message}</p>
      <Button onClick={() => unstable_retry()}>Tentar de novo</Button>
    </div>
  )
}
