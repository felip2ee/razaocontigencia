"use client"

import { useSyncExternalStore } from "react"

const HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

const DATA = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
})

function subscribe(callback: () => void) {
  const id = setInterval(callback, 1000)
  return () => clearInterval(id)
}

function getSnapshot() {
  return Date.now()
}

function getServerSnapshot() {
  return null
}

export function Relogio() {
  // useSyncExternalStore evita o padrão "setState direto dentro de effect"
  // (bloqueado pelo eslint-plugin-react-hooks) mantendo o mesmo efeito do
  // brief: nada de hora real no servidor, o relógio liga sozinho ao montar.
  const timestamp = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const agora = timestamp === null ? null : new Date(timestamp)

  // Até montar no navegador, o espaço fica reservado com um traço no lugar da
  // hora. Renderizar a hora no servidor causaria erro de hidratação, porque o
  // relógio do servidor não bate com o do cliente no instante da hidratação.
  return (
    <div className="text-right tabular-nums">
      <div className="font-mono text-2xl leading-none font-medium">
        {agora ? HORA.format(agora) : "--:--:--"}
      </div>
      <div className="text-muted-foreground mt-1 text-xs first-letter:uppercase">
        {agora ? DATA.format(agora) : " "}
      </div>
    </div>
  )
}
