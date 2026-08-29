"use server"

import { and, eq, isNull, sql } from "drizzle-orm"
import { refresh } from "next/cache"

import { db } from "./db.ts"
import { account, chip, device, evolutionServer, incident, warmupTask } from "./schema.ts"
import { contasParaSorteio, listarCatalogo, paresRecentes } from "./queries.ts"
import { gerarTarefasDoDia, hojeISO } from "./warmup.ts"

/** O que uma action devolve para o formulário, via `useActionState`. */
export type EstadoDoForm = { erro?: string; aviso?: string } | null

/**
 * As regras que importam são constraints no banco. Aqui elas viram frase em
 * português — o nome do índice é o único jeito de saber qual regra bateu.
 */
const MENSAGEM_DA_CONSTRAINT: Record<string, string> = {
  device_pkey: "Já existe um aparelho com esse ID.",
  chip_pkey: "Já existe um chip com esse ID.",
  account_slot_ativo: "Esse slot já tem uma conta ativa neste aparelho.",
  account_chip_ativo: "Esse chip já está em uso por outra conta ativa.",
  incident_aberto_unico: "Essa conta já tem um incidente aberto. Encerre o atual antes.",
  warmup_task_unica: "Essa tarefa já foi sorteada hoje para essa conta.",
  evolution_server_url: "Já existe um servidor com essa URL.",
}

/** O erro do pg pode vir embrulhado pelo drizzle; a constraint fica na cadeia de causas. */
function constraintDoErro(erro: unknown): string | undefined {
  let atual: unknown = erro
  while (atual && typeof atual === "object") {
    const nome = (atual as { constraint?: unknown }).constraint
    if (typeof nome === "string") return nome
    atual = (atual as { cause?: unknown }).cause
  }
  return undefined
}

/** Erro pensado para o operador ler: a mensagem já está pronta em português. */
class ErroDeValidacao extends Error {}

function mensagemDoErro(erro: unknown): string {
  const constraint = constraintDoErro(erro)
  if (constraint && MENSAGEM_DA_CONSTRAINT[constraint]) {
    return MENSAGEM_DA_CONSTRAINT[constraint]
  }
  if (erro instanceof ErroDeValidacao) {
    return erro.message
  }
  return "Não foi possível salvar. Confira os dados e tente de novo."
}

/**
 * Roda a escrita e devolve estado em vez de estourar: o operador precisa ler o
 * que houve, em português, sem perder a página nem o que já digitou.
 */
async function comMensagem(
  trabalho: () => Promise<EstadoDoForm | void>,
): Promise<EstadoDoForm> {
  try {
    const estado = await trabalho()
    refresh()
    return estado ?? null
  } catch (erro) {
    return { erro: mensagemDoErro(erro) }
  }
}

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo)
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new ErroDeValidacao(`Campo obrigatório: ${campo}`)
  }
  return valor.trim()
}

function textoOpcional(formData: FormData, campo: string): string | null {
  const valor = formData.get(campo)
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null
}

function urlDeServidor(formData: FormData): string {
  const bruta = texto(formData, "url").replace(/\/$/, "")
  if (!/^https?:\/\//i.test(bruta)) {
    throw new ErroDeValidacao("A URL deve começar com http:// ou https://")
  }
  return bruta
}

export async function criarAparelho(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db.insert(device).values({
      id: texto(formData, "id"),
      apelido: textoOpcional(formData, "apelido"),
      notas: textoOpcional(formData, "notas"),
      origem: texto(formData, "origem") as "propria" | "externa",
    })
    return { aviso: "Aparelho cadastrado." }
  })
}

export async function criarChip(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db.insert(chip).values({
      id: texto(formData, "id"),
      operadora: texto(formData, "operadora"),
      numero: texto(formData, "numero"),
      posicao: textoOpcional(formData, "posicao"),
      origem: texto(formData, "origem") as "propria" | "externa",
    })
    return { aviso: "Chip cadastrado." }
  })
}

export async function ativarConta(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    const chipId = texto(formData, "chipId")
    const [deviceId, slot] = texto(formData, "destino").split("|")
    const instancia = textoOpcional(formData, "instancia")
    let idServidor: number | null = null
    let nomeInstancia: string | null = null
    if (instancia) {
      const sep = instancia.indexOf("::")
      if (sep > 0) {
        const id = Number(instancia.slice(0, sep))
        const nome = instancia.slice(sep + 2)
        if (Number.isInteger(id) && nome) {
          idServidor = id
          nomeInstancia = nome
        }
      }
    }

    await db.transaction(async (tx) => {
      let evolutionServerId: number | null = null
      let instanceName: string | null = null
      if (idServidor !== null && nomeInstancia) {
        const [existe] = await tx
          .select({ id: evolutionServer.id })
          .from(evolutionServer)
          .where(eq(evolutionServer.id, idServidor))
        if (existe) {
          evolutionServerId = idServidor
          instanceName = nomeInstancia
        }
      }

      await tx.insert(account).values({
        deviceId,
        slot: slot as "wa1" | "wa2" | "business",
        chipId,
        ativadaEm: texto(formData, "ativadaEm"),
        evolutionServerId,
        instanceName,
      })
      await tx.update(chip).set({ status: "em_uso" }).where(eq(chip.id, chipId))
    })
    return { aviso: "Conta ativada." }
  })
}

export async function registrarIncidente(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    const tipo = texto(formData, "tipo") as "restricao" | "ban"
    await db.insert(incident).values({
      accountId: Number(texto(formData, "accountId")),
      tipo,
      inicio: new Date(texto(formData, "inicio")),
      resultado: tipo === "ban" ? "pendente" : null,
      notas: textoOpcional(formData, "notas"),
    })
  })
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
      .where(and(eq(incident.id, incidentId), isNull(incident.fim)))
      .returning({ accountId: incident.accountId })

    // Já encerrado por outro clique: nada a fazer, e a tela recarregada mostra
    // a situação real. Sem linha não há accountId, e seguir estouraria aqui.
    if (!oIncidente) return

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

/** Chave arbitrária do advisory lock que serializa a geração do aquecimento. */
const LOCK_DO_AQUECIMENTO = 20260822

/**
 * Sorteia as tarefas de hoje. Quem garante a idempotência é o filtro
 * `contasSemTarefa`: a conta que já tem qualquer tarefa hoje não sorteia de
 * novo, senão um segundo clique somaria ações além da cota da faixa. A
 * constraint `warmup_task_unica` só impede repetir a mesma ação — sozinha ela
 * deixaria passar ações diferentes. Não remova o filtro confiando nela.
 *
 * O filtro e o insert correm na mesma transação, sob `pg_advisory_xact_lock`,
 * porque dois cliques simultâneos passariam ambos pelo filtro.
 */
export async function gerarAquecimentoDeHoje(): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    const dia = hojeISO()
    const [contas, catalogo, pares] = await Promise.all([
      contasParaSorteio(),
      listarCatalogo(),
      paresRecentes(dia),
    ])

    if (contas.length === 0) {
      return { aviso: "Nenhuma conta saudável para aquecer hoje." }
    }

    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_DO_AQUECIMENTO})`)

      const jaTemTarefa = await tx
        .selectDistinct({ accountId: warmupTask.accountId })
        .from(warmupTask)
        .where(eq(warmupTask.data, dia))

      const jaSorteadas = new Set(jaTemTarefa.map((c) => c.accountId))
      const contasSemTarefa = contas.filter((c) => !jaSorteadas.has(c.id))
      if (contasSemTarefa.length === 0) {
        return { aviso: "Todas as contas saudáveis já têm as tarefas de hoje." }
      }

      // O pool de pares é a frota saudável inteira, não só quem falta sortear.
      const tarefas = gerarTarefasDoDia(
        contasSemTarefa,
        catalogo,
        pares,
        new Date(),
        Math.random,
        contas,
      )
      if (tarefas.length === 0) {
        return { aviso: "Nenhuma ação do catálogo é elegível para as contas de hoje." }
      }

      await tx
        .insert(warmupTask)
        .values(tarefas.map((t) => ({ ...t, data: dia })))
        .onConflictDoNothing()

      return {
        aviso: `${tarefas.length} tarefa(s) sorteada(s) para ${contasSemTarefa.length} conta(s).`,
      }
    })
  })
}

export async function marcarTarefa(formData: FormData) {
  const status = texto(formData, "status") as "feito" | "pulado"
  await db
    .update(warmupTask)
    .set({ status, feitoEm: new Date() })
    .where(eq(warmupTask.id, Number(texto(formData, "tarefaId"))))
  refresh()
}

/**
 * Corrige o aparelho/slot de uma conta já ativa, sem tocar em chipId,
 * ativadaEm nem no histórico — o histórico é todo por accountId, que não
 * muda. A constraint account_slot_ativo recusa se o destino já estiver
 * ocupado; a mensagem já existe em MENSAGEM_DA_CONSTRAINT.
 */
export async function corrigirAparelho(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db
      .update(account)
      .set({
        deviceId: texto(formData, "deviceId"),
        slot: texto(formData, "slot") as "wa1" | "wa2" | "business",
      })
      .where(eq(account.id, Number(texto(formData, "accountId"))))
    return { aviso: "Aparelho da conta corrigido." }
  })
}

export async function editarChip(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db
      .update(chip)
      .set({
        numero: texto(formData, "numero"),
        operadora: texto(formData, "operadora"),
        origem: texto(formData, "origem") as "propria" | "externa",
      })
      .where(eq(chip.id, texto(formData, "chipId")))
    return { aviso: "Chip atualizado." }
  })
}

export async function editarAparelho(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db
      .update(device)
      .set({
        apelido: textoOpcional(formData, "apelido"),
        notas: textoOpcional(formData, "notas"),
        origem: texto(formData, "origem") as "propria" | "externa",
      })
      .where(eq(device.id, texto(formData, "deviceId")))
    return { aviso: "Aparelho atualizado." }
  })
}

export async function cancelarChip(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    const chipId = texto(formData, "chipId")
    const [contaAtiva] = await db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.chipId, chipId), eq(account.status, "ativa")))
    if (contaAtiva) {
      throw new ErroDeValidacao(
        "Este chip tem uma conta ativa. Cancele a conta antes de cancelar o chip.",
      )
    }
    await db.update(chip).set({ status: "aposentado" }).where(eq(chip.id, chipId))
    return { aviso: "Chip cancelado." }
  })
}

export async function cancelarConta(formData: FormData) {
  const accountId = Number(texto(formData, "accountId"))
  await db.transaction(async (tx) => {
    const [conta] = await tx
      .update(account)
      .set({ status: "aposentada" })
      .where(eq(account.id, accountId))
      .returning({ chipId: account.chipId })
    if (conta) {
      await tx.update(chip).set({ status: "novo" }).where(eq(chip.id, conta.chipId))
    }
  })
  refresh()
}

export async function reativarChip(formData: FormData) {
  await db
    .update(chip)
    .set({ status: "novo" })
    .where(eq(chip.id, texto(formData, "chipId")))
  refresh()
}

export async function criarServidorEvolution(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    await db.insert(evolutionServer).values({
      nome: texto(formData, "nome"),
      url: urlDeServidor(formData),
      apiKey: texto(formData, "apiKey"),
    })
    return { aviso: "Servidor cadastrado." }
  })
}

export async function editarServidorEvolution(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    const novaKey = textoOpcional(formData, "apiKey")
    await db
      .update(evolutionServer)
      .set({
        nome: texto(formData, "nome"),
        url: urlDeServidor(formData),
        ...(novaKey ? { apiKey: novaKey } : {}),
      })
      .where(eq(evolutionServer.id, Number(texto(formData, "serverId"))))
    return { aviso: "Servidor atualizado." }
  })
}

export async function alternarServidorEvolution(formData: FormData) {
  const id = Number(texto(formData, "serverId"))
  const [atual] = await db
    .select({ ativo: evolutionServer.ativo })
    .from(evolutionServer)
    .where(eq(evolutionServer.id, id))
  if (atual) {
    await db
      .update(evolutionServer)
      .set({ ativo: !atual.ativo })
      .where(eq(evolutionServer.id, id))
  }
  refresh()
}

export async function removerServidorEvolution(
  estadoAnterior: EstadoDoForm,
  formData: FormData,
): Promise<EstadoDoForm> {
  return comMensagem(async () => {
    const id = Number(texto(formData, "serverId"))
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(account)
      .where(eq(account.evolutionServerId, id))
    if (n > 0) {
      throw new ErroDeValidacao(
        `${n} conta(s) usam este servidor. Desative em vez de remover.`,
      )
    }
    await db.delete(evolutionServer).where(eq(evolutionServer.id, id))
    return { aviso: "Servidor removido." }
  })
}
