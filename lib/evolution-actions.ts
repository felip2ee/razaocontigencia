"use server"

import { and, eq, inArray, isNull, or } from "drizzle-orm"
import { refresh } from "next/cache"

import type { EstadoDoForm } from "./actions.ts"
import { db } from "./db.ts"
import {
  acharInstancia,
  buscarProxy,
  buscarStatusConexao,
  listarInstancias,
  pedirQrCode,
  type ServidorEvolution,
} from "./evolution.ts"
import { servidoresEvolutionAtivos } from "./queries.ts"
import { account, chip, evolutionServer } from "./schema.ts"

/**
 * Servidor + nome da instância de uma conta. `null` se faltar servidor ou
 * instância, ou se o servidor estiver desativado. Lança só quando a conta
 * em si não existe.
 */
async function contextoDaConta(
  accountId: number,
): Promise<{ servidor: ServidorEvolution; instanceName: string } | null> {
  const [linha] = await db
    .select({
      instanceName: account.instanceName,
      url: evolutionServer.url,
      apiKey: evolutionServer.apiKey,
      ativo: evolutionServer.ativo,
    })
    .from(account)
    .leftJoin(evolutionServer, eq(evolutionServer.id, account.evolutionServerId))
    .where(eq(account.id, accountId))
  if (!linha) throw new Error("Conta não encontrada.")
  if (!linha.instanceName || !linha.url || !linha.apiKey || !linha.ativo) return null
  return { servidor: { url: linha.url, apiKey: linha.apiKey }, instanceName: linha.instanceName }
}

async function verificarSemRefresh(accountId: number): Promise<void> {
  const ctx = await contextoDaConta(accountId)

  // Sem servidor/instância associada não há o que consultar: registra
  // "desconhecido" e carimba a verificação pra a ficha mostrar que já tentou.
  if (!ctx) {
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
    buscarStatusConexao(ctx.servidor, ctx.instanceName),
    buscarProxy(ctx.servidor, ctx.instanceName),
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

/**
 * Antes de verificar em lote, tenta associar sozinho as contas sem instância:
 * busca a lista de todos os servidores ativos uma vez e casa pelo número do
 * chip. Só grava quando o match é único — 0 ou 2+ instâncias e a conta fica
 * pro operador resolver na ficha.
 */
async function autoAssociarInstancias(accountIds: number[]): Promise<void> {
  if (accountIds.length === 0) return

  const semInstancia = await db
    .select({ id: account.id, numero: chip.numero })
    .from(account)
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(
      and(
        inArray(account.id, accountIds),
        or(isNull(account.instanceName), isNull(account.evolutionServerId)),
      ),
    )

  if (semInstancia.length === 0) return

  const servidores = await servidoresEvolutionAtivos()
  if (servidores.length === 0) return

  const { instancias, falharam } = await listarInstancias(servidores)
  if (falharam.length > 0) {
    console.warn(
      `autoAssociarInstancias: pool incompleto, servidores fora: ${falharam.join(", ")} — nada gravado`,
    )
    return
  }
  if (instancias.length === 0) return

  for (const conta of semInstancia) {
    const achado = acharInstancia(conta.numero, instancias)
    if (achado) {
      await db
        .update(account)
        .set({ evolutionServerId: achado.serverId, instanceName: achado.name })
        .where(eq(account.id, conta.id))
    }
  }
}

/** Mesma coisa, em lote — base do botão "Verificar todas" das páginas de
 * lista. Um único `refresh()` no final, não um por conta.
 *
 * Roda em lotes de `TAMANHO_LOTE` (em vez de disparar tudo de uma vez) pra não
 * afogar a Evolution self-hosted com N contas x (2 chamadas + teste de proxy
 * de até 5s) simultâneas. Falha de uma conta não derruba as outras nem trava
 * o refresh — `allSettled` sempre deixa o refresh rodar no final. */
export async function verificarConexoes(accountIds: number[]): Promise<void> {
  await autoAssociarInstancias(accountIds)

  for (let i = 0; i < accountIds.length; i += TAMANHO_LOTE) {
    const lote = accountIds.slice(i, i + TAMANHO_LOTE)
    await Promise.allSettled(lote.map((id) => verificarSemRefresh(id)))
  }
  refresh()
}

/** Erro com mensagem já pronta para o operador. O catch preserva `.message`
 * em vez de trocar por uma frase genérica — mesmo espírito de `mensagemDoErro`
 * em `lib/actions.ts`, sem cruzar internals entre os módulos. */
class ErroConhecido extends Error {}

/** Associa a conta a um servidor + instância da Evolution (ou limpa, com
 * string vazia/ inválida) e já sincroniza o status na sequência. O valor vem
 * como `"<serverId>::<name>"` — split no primeiro `::` porque o nome pode
 * conter `::`. */
export async function definirInstancia(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  const accountId = Number(formData.get("accountId"))
  try {
    if (!Number.isInteger(accountId) || accountId <= 0) {
      throw new ErroConhecido("Conta inválida.")
    }

    const bruto = formData.get("instancia")
    const valor = typeof bruto === "string" ? bruto.trim() : ""
    const sep = valor.indexOf("::")

    let evolutionServerId: number | null = null
    let instanceName: string | null = null
    if (sep > 0) {
      const id = Number(valor.slice(0, sep))
      const nome = valor.slice(sep + 2)
      if (Number.isInteger(id) && nome) {
        const [existe] = await db
          .select({ id: evolutionServer.id })
          .from(evolutionServer)
          .where(eq(evolutionServer.id, id))
        if (existe) {
          evolutionServerId = id
          instanceName = nome
        }
      }
    }

    const [contaAtualizada] = await db
      .update(account)
      .set({ evolutionServerId, instanceName })
      .where(eq(account.id, accountId))
      .returning({ id: account.id })
    if (!contaAtualizada) throw new ErroConhecido("Conta inválida.")
  } catch (erro) {
    if (erro instanceof ErroConhecido) return { erro: erro.message }
    console.error("definirInstancia:", erro)
    return { erro: "Não foi possível associar a instância." }
  }

  // A associação já foi gravada. Sincronizar o status é best-effort: uma falha
  // aqui não desfaz nada e não pode reportar "não foi possível associar" —
  // isso seria um erro falso sobre uma escrita que deu certo.
  try {
    await verificarSemRefresh(accountId)
  } catch (erro) {
    console.warn("definirInstancia: associada, falhou ao sincronizar status:", erro)
  }
  refresh()
  return { ok: true as const, aviso: "Instância associada." }
}

/** Só busca o QR code pro dialog — não grava nada. A conexão de fato só é
 * confirmada quando o operador clica "Já escaneei" e `verificarConexao` roda. */
export async function gerarQrCode(accountId: number): Promise<string> {
  const ctx = await contextoDaConta(accountId)
  if (!ctx) {
    throw new Error("Associe esta conta a um servidor e uma instância da Evolution primeiro.")
  }
  return pedirQrCode(ctx.servidor, ctx.instanceName)
}
