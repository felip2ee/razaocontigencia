import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Afordância de link de navegação, igual nas cinco telas: cor de link em
 * repouso (o que faz o texto se ler como link) e sublinhado no hover. A
 * sidebar e o wordmark ficam de fora — são o shell, não texto corrido.
 */
export const LINK = "text-primary underline-offset-4 hover:underline"
