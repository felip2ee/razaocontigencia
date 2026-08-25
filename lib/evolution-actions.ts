"use server"

import { eq } from "drizzle-orm"
import { refresh } from "next/cache"

import { db } from "./db.ts"
import { buscarProxy, buscarStatusConexao, normalizarNumero, pedirQrCode } from "./evolution.ts"
import { account, chip } from "./schema.ts"

/** Instância na Evolution é nomeada com o número — nunca com o ID da conta.
 * Toda action que fala com a Evolution passa por aqui pra resolver o nome. */
async function instanceNameDaConta(accountId: number): Promise<string> {
  const [linha] = await db
    .select({ numero: chip.numero })
    .from(account)
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(eq(account.id, accountId))
  if (!linha) throw new Error("Conta não encontrada.")
  return normalizarNumero(linha.numero)
}

async function verificarSemRefresh(accountId: number): Promise<void> {
  const instanceName = await instanceNameDaConta(accountId)
  const [evolutionStatus, proxyStatus] = await Promise.all([
    buscarStatusConexao(instanceName),
    buscarProxy(instanceName),
  ])

  await db
    .update(account)
    .set({ evolutionStatus, proxyStatus, statusVerificadoEm: new Date() })
    .where(eq(account.id, accountId))
}

/** Consulta status + proxy de uma conta e grava o resultado. Sem cron, sem
 * webhook — é sempre um clique do operador que dispara isto. */
export async function verificarConexao(accountId: number): Promise<void> {
  await verificarSemRefresh(accountId)
  refresh()
}

/** Mesma coisa, em lote — base do botão "Verificar todas" das páginas de
 * lista. Um único `refresh()` no final, não um por conta. */
export async function verificarConexoes(accountIds: number[]): Promise<void> {
  await Promise.all(accountIds.map((id) => verificarSemRefresh(id)))
  refresh()
}

/** Só busca o QR code pro dialog — não grava nada. A conexão de fato só é
 * confirmada quando o operador clica "Já escaneei" e `verificarConexao` roda. */
export async function gerarQrCode(accountId: number): Promise<string> {
  const instanceName = await instanceNameDaConta(accountId)
  return pedirQrCode(instanceName)
}
