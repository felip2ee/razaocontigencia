"use server"

import { eq } from "drizzle-orm"
import { refresh } from "next/cache"

import { db } from "./db.ts"
import { account, chip, device } from "./schema.ts"

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo)
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new Error(`Campo obrigatório: ${campo}`)
  }
  return valor.trim()
}

function textoOpcional(formData: FormData, campo: string): string | null {
  const valor = formData.get(campo)
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null
}

export async function criarAparelho(formData: FormData) {
  await db.insert(device).values({
    id: texto(formData, "id"),
    apelido: textoOpcional(formData, "apelido"),
    notas: textoOpcional(formData, "notas"),
  })
  refresh()
}

export async function criarChip(formData: FormData) {
  await db.insert(chip).values({
    id: texto(formData, "id"),
    operadora: texto(formData, "operadora"),
    numero: texto(formData, "numero"),
    posicao: textoOpcional(formData, "posicao"),
  })
  refresh()
}

export async function ativarConta(formData: FormData) {
  const chipId = texto(formData, "chipId")
  await db.transaction(async (tx) => {
    await tx.insert(account).values({
      deviceId: texto(formData, "deviceId"),
      slot: texto(formData, "slot") as "wa1" | "wa2" | "business",
      chipId,
      ativadaEm: texto(formData, "ativadaEm"),
    })
    await tx.update(chip).set({ status: "em_uso" }).where(eq(chip.id, chipId))
  })
  refresh()
}
