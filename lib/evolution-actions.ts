"use server"

import { eq } from "drizzle-orm"
import { refresh } from "next/cache"

import { db } from "./db.ts"
import { buscarProxy, buscarStatusConexao, pedirQrCode } from "./evolution.ts"
import { account } from "./schema.ts"

/** Nome da instância na Evolution vem da coluna `account.instance_name`, que o
 * operador associa pela ficha do aparelho. É rótulo livre lá, nunca derivável
 * do número — por isso é guardado e não calculado. `null` = ainda não
 * associada. */
async function instanceNameDaConta(accountId: number): Promise<string | null> {
  const [linha] = await db
    .select({ instanceName: account.instanceName })
    .from(account)
    .where(eq(account.id, accountId))
  if (!linha) throw new Error("Conta não encontrada.")
  return linha.instanceName
}

async function verificarSemRefresh(accountId: number): Promise<void> {
  const instanceName = await instanceNameDaConta(accountId)

  // Sem instância associada não há o que consultar: registra "desconhecido" e
  // carimba a verificação pra a ficha mostrar que já tentou.
  if (!instanceName) {
    await db
      .update(account)
      .set({
        evolutionStatus: "desconhecido",
        proxyStatus: "sem_conexao",
        statusVerificadoEm: new Date(),
      })
      .where(eq(account.id, accountId))
    return
  }

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

const TAMANHO_LOTE = 8

/** Mesma coisa, em lote — base do botão "Verificar todas" das páginas de
 * lista. Um único `refresh()` no final, não um por conta.
 *
 * Roda em lotes de `TAMANHO_LOTE` (em vez de disparar tudo de uma vez) pra não
 * afogar a Evolution self-hosted com N contas x (2 chamadas + teste de proxy
 * de até 5s) simultâneas. Falha de uma conta não derruba as outras nem trava
 * o refresh — `allSettled` sempre deixa o refresh rodar no final. */
export async function verificarConexoes(accountIds: number[]): Promise<void> {
  for (let i = 0; i < accountIds.length; i += TAMANHO_LOTE) {
    const lote = accountIds.slice(i, i + TAMANHO_LOTE)
    await Promise.allSettled(lote.map((id) => verificarSemRefresh(id)))
  }
  refresh()
}

/** Associa a conta a uma instância da Evolution (ou limpa, com string vazia) e
 * já sincroniza o status na sequência. */
export async function definirInstancia(formData: FormData): Promise<void> {
  const accountId = Number(formData.get("accountId"))
  if (!Number.isInteger(accountId)) throw new Error("Conta inválida.")
  const bruto = formData.get("instanceName")
  const instanceName = typeof bruto === "string" && bruto.trim() !== "" ? bruto.trim() : null

  await db.update(account).set({ instanceName }).where(eq(account.id, accountId))
  await verificarSemRefresh(accountId)
  refresh()
}

/** Só busca o QR code pro dialog — não grava nada. A conexão de fato só é
 * confirmada quando o operador clica "Já escaneei" e `verificarConexao` roda. */
export async function gerarQrCode(accountId: number): Promise<string> {
  const instanceName = await instanceNameDaConta(accountId)
  if (!instanceName) {
    throw new Error("Associe esta conta a uma instância da Evolution primeiro.")
  }
  return pedirQrCode(instanceName)
}
