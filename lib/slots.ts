/** Todo aparelho tem estes três slots, ocupados ou não. */
export const SLOTS = ["wa1", "wa2", "business"] as const

/** Um rótulo por slot, igual nas cinco telas. */
export const NOME_DO_SLOT: Record<string, string> = {
  wa1: "WhatsApp 1",
  wa2: "WhatsApp 2",
  business: "WhatsApp Business",
}
