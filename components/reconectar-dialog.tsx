"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { gerarQrCode, verificarConexao } from "@/lib/evolution-actions"

export function ReconectarDialog({ accountId }: { accountId: number }) {
  const [aberto, setAberto] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function abrir() {
    setAberto(true)
    setQr(null)
    setErro(null)
    startTransition(async () => {
      try {
        setQr(await gerarQrCode(accountId))
      } catch {
        setErro("Não foi possível gerar o QR code.")
      }
    })
  }

  function jaEscaneei() {
    startTransition(async () => {
      await verificarConexao(accountId)
      setAberto(false)
    })
  }

  return (
    <>
      <Button size="sm" disabled={pending} onClick={abrir}>
        Reconectar
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reconectar conta {accountId}</DialogTitle>
          </DialogHeader>
          {pending && !qr && !erro && (
            <p className="text-muted-foreground text-sm">Gerando QR code…</p>
          )}
          {erro && <p className="text-destructive text-sm">{erro}</p>}
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL, não faz sentido pelo next/image
            <img
              src={qr}
              alt="QR code para reconectar o WhatsApp"
              className="mx-auto size-64"
            />
          )}
          {qr && (
            <Button onClick={jaEscaneei} disabled={pending}>
              Já escaneei, verificar
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
