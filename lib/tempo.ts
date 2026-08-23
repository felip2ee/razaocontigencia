/**
 * Quanto tempo durou — ou já dura — um intervalo.
 *
 * `fim` ausente ou nulo significa incidente em curso: conta até agora. A faixa
 * de minutos existe porque uma restrição de 20 minutos precisa aparecer como
 * "20min" e não como "0h", que é o mesmo fato virando dois números.
 */
export function tempoDecorrido(inicio: Date, fim?: Date | null): string {
  const minutos = Math.floor(((fim ?? new Date()).getTime() - inicio.getTime()) / 60_000)
  if (minutos < 60) return `${minutos}min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `${horas}h`
  return `${Math.floor(horas / 24)}d ${horas % 24}h`
}

/** Data ISO (`2026-08-22`) no formato de quem lê em português: `22/08/2026`. */
export function dataBR(iso: string): string {
  return iso.split("-").reverse().join("/")
}
