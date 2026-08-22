"use server"

import { and, eq, isNull } from "drizzle-orm"
import { refresh } from "next/cache"

import { db } from "./db.ts"
import { account, chip, device, incident } from "./schema.ts"

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

export async function registrarIncidente(formData: FormData) {
  const tipo = texto(formData, "tipo") as "restricao" | "ban"
  await db.insert(incident).values({
    accountId: Number(texto(formData, "accountId")),
    tipo,
    inicio: new Date(texto(formData, "inicio")),
    resultado: tipo === "ban" ? "pendente" : null,
    notas: textoOpcional(formData, "notas"),
  })
  refresh()
}

/** Restrição acabou: carimba o fim. A duração é sempre calculada, nunca digitada. */
export async function encerrarIncidente(formData: FormData) {
  await db
    .update(incident)
    .set({ fim: new Date() })
    .where(and(eq(incident.id, Number(texto(formData, "incidentId"))), isNull(incident.fim)))
  refresh()
}

/**
 * Resultado da análise de um ban. Se o número foi perdido, a conta é aposentada
 * e o chip também, liberando o slot para um chip novo.
 */
export async function resolverBan(formData: FormData) {
  const incidentId = Number(texto(formData, "incidentId"))
  const resultado = texto(formData, "resultado") as "recuperada" | "perdida"

  await db.transaction(async (tx) => {
    const [oIncidente] = await tx
      .update(incident)
      .set({ resultado, fim: new Date() })
      .where(eq(incident.id, incidentId))
      .returning({ accountId: incident.accountId })

    if (resultado === "perdida") {
      const [aConta] = await tx
        .update(account)
        .set({ status: "aposentada" })
        .where(eq(account.id, oIncidente.accountId))
        .returning({ chipId: account.chipId })
      await tx.update(chip).set({ status: "aposentado" }).where(eq(chip.id, aConta.chipId))
    }
  })
  refresh()
}

export async function mudarStatusDoAparelho(formData: FormData) {
  await db
    .update(device)
    .set({ status: texto(formData, "status") as "ativo" | "quarentena" | "aposentado" })
    .where(eq(device.id, texto(formData, "deviceId")))
  refresh()
}

/**
 * Move o chip entre pasta, gaveta e bandeja de um aparelho. Os campos que não
 * pertencem ao destino são zerados para o registro não mentir sobre onde o
 * chip está.
 */
export async function moverChip(formData: FormData) {
  const local = texto(formData, "local") as "pasta" | "gaveta" | "bandeja"
  const deviceId = textoOpcional(formData, "bandejaDeviceId")

  if (local === "bandeja" && !deviceId) {
    throw new Error("Escolha o aparelho da bandeja")
  }

  await db
    .update(chip)
    .set({
      local,
      bandejaDeviceId: local === "bandeja" ? deviceId : null,
      posicao: local === "pasta" ? textoOpcional(formData, "posicao") : null,
    })
    .where(eq(chip.id, texto(formData, "chipId")))
  refresh()
}
