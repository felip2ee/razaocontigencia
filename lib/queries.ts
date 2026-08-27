import { and, asc, count, desc, eq, gte, ilike, isNotNull, isNull, max, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { db } from "./db.ts"
import { account, chip, device, incident, warmupAction, warmupTask } from "./schema.ts"
import { SLOTS } from "./slots.ts"
import type { AcaoCatalogo, ContaParaSorteio, Par } from "./warmup.ts"

export type ContaNaLista = {
  id: number
  deviceId: string
  slot: string
  chipId: string
  numero: string
  operadora: string
  ativadaEm: string
  evolutionStatus: "desconhecido" | "aberta" | "conectando" | "fechada"
  proxyStatus: "sem_conexao" | "ativa" | "inativa"
  statusVerificadoEm: Date | null
}

export type ContaComIncidente = ContaNaLista & {
  incidentId: number
  tipo: "restricao" | "ban"
  inicio: Date
  resultado: "pendente" | "recuperada" | "perdida" | null
}

const CAMPOS_DA_CONTA = {
  id: account.id,
  deviceId: account.deviceId,
  slot: account.slot,
  chipId: account.chipId,
  numero: chip.numero,
  operadora: chip.operadora,
  ativadaEm: account.ativadaEm,
  evolutionStatus: account.evolutionStatus,
  proxyStatus: account.proxyStatus,
  statusVerificadoEm: account.statusVerificadoEm,
}

export async function listarCatalogo(): Promise<AcaoCatalogo[]> {
  return db.select().from(warmupAction).orderBy(asc(warmupAction.id))
}

/** Contas ativas sem nenhum incidente aberto. */
export async function contasSaudaveis(filtro?: string): Promise<ContaNaLista[]> {
  const abertos = db
    .select({ accountId: incident.accountId })
    .from(incident)
    .where(isNull(incident.fim))

  const termo = filtro?.trim()
  const condicoes = [eq(account.status, "ativa"), sql`${account.id} not in ${abertos}`]

  if (termo) {
    // `%` e `_` são curingas do LIKE: sem escapar, digitar `%` lista tudo em
    // vez de procurar por `%`. A barra invertida é o escape padrão do Postgres.
    const alvo = `%${termo.replace(/[\\%_]/g, (c) => "\\" + c)}%`
    condicoes.push(
      sql`(${account.deviceId} ilike ${alvo} or ${chip.numero} ilike ${alvo} or ${account.chipId} ilike ${alvo})`,
    )
  }

  return db
    .select(CAMPOS_DA_CONTA)
    .from(account)
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(and(...condicoes))
    .orderBy(asc(account.deviceId), asc(account.slot))
}

export async function contasComIncidenteAberto(): Promise<ContaComIncidente[]> {
  return db
    .select({
      ...CAMPOS_DA_CONTA,
      incidentId: incident.id,
      tipo: incident.tipo,
      inicio: incident.inicio,
      resultado: incident.resultado,
    })
    .from(incident)
    .innerJoin(account, eq(account.id, incident.accountId))
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(isNull(incident.fim))
    .orderBy(asc(incident.inicio))
}

/**
 * Chip livre é chip com status `novo`: ainda não gerou conta nenhuma. O local
 * (pasta, gaveta, bandeja) não entra na conta — é só onde ele está guardado, e
 * um chip da gaveta pode ativar uma conta hoje mesmo. Definição única: o painel
 * conta e o cadastro lista exatamente estes.
 */
export async function chipsLivres() {
  return db.select().from(chip).where(eq(chip.status, "novo")).orderBy(asc(chip.id))
}

export async function contadores() {
  const [aparelhos] = await db
    .select({ n: count() })
    .from(device)
    .where(eq(device.status, "ativo"))
  const livres = await chipsLivres()
  const saudaveis = await contasSaudaveis()
  const [conectados] = await db
    .select({ n: count() })
    .from(account)
    .where(and(eq(account.status, "ativa"), eq(account.evolutionStatus, "aberta")))
  const [externos] = await db
    .select({ n: count() })
    .from(account)
    .innerJoin(device, eq(device.id, account.deviceId))
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(
      and(
        eq(account.status, "ativa"),
        sql`(${device.origem} = 'externa' or ${chip.origem} = 'externa')`,
      ),
    )

  return {
    aparelhosAtivos: aparelhos.n,
    contasSaudaveis: saudaveis.length,
    chipsLivres: livres.length,
    conectadosNaEvolution: conectados.n,
    whatsappsExternos: externos.n,
  }
}

export type FichaAparelho = {
  device: typeof device.$inferSelect
  chipNaBandeja: typeof chip.$inferSelect | null
  contas: (ContaNaLista & {
    status: "ativa" | "aposentada"
    instanceName: string | null
    incidenteAberto: ContaComIncidente | null
  })[]
  historico: (typeof incident.$inferSelect & { slot: string; chipId: string })[]
  totalBans: number
}

export async function fichaDoAparelho(id: string): Promise<FichaAparelho | null> {
  const [aparelho] = await db.select().from(device).where(eq(device.id, id))
  if (!aparelho) return null

  const [naBandeja] = await db
    .select()
    .from(chip)
    .where(and(eq(chip.bandejaDeviceId, id), eq(chip.local, "bandeja")))

  const contas = await db
    .select({ ...CAMPOS_DA_CONTA, status: account.status, instanceName: account.instanceName })
    .from(account)
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(and(eq(account.deviceId, id), eq(account.status, "ativa")))
    .orderBy(asc(account.slot))

  const abertos = await contasComIncidenteAberto()

  const historico = await db
    .select({
      id: incident.id,
      accountId: incident.accountId,
      tipo: incident.tipo,
      inicio: incident.inicio,
      fim: incident.fim,
      resultado: incident.resultado,
      notas: incident.notas,
      slot: account.slot,
      chipId: account.chipId,
    })
    .from(incident)
    .innerJoin(account, eq(account.id, incident.accountId))
    .where(eq(account.deviceId, id))
    .orderBy(desc(incident.inicio))

  return {
    device: aparelho,
    chipNaBandeja: naBandeja ?? null,
    contas: contas.map((c) => ({
      ...c,
      incidenteAberto: abertos.find((a) => a.id === c.id) ?? null,
    })),
    historico,
    totalBans: historico.filter((h) => h.tipo === "ban").length,
  }
}

export type FichaChip = {
  chip: typeof chip.$inferSelect
  aparelhoDaBandeja: typeof device.$inferSelect | null
  conta: (typeof account.$inferSelect) | null
}

export async function fichaDoChip(id: string): Promise<FichaChip | null> {
  const [oChip] = await db.select().from(chip).where(eq(chip.id, id))
  if (!oChip) return null

  const [aparelho] = oChip.bandejaDeviceId
    ? await db.select().from(device).where(eq(device.id, oChip.bandejaDeviceId))
    : []

  const [aConta] = await db.select().from(account).where(eq(account.chipId, id))

  return { chip: oChip, aparelhoDaBandeja: aparelho ?? null, conta: aConta ?? null }
}

export type TarefaDoDia = {
  id: number
  accountId: number
  deviceId: string
  slot: string
  numero: string
  acao: string
  categoria: string
  status: "pendente" | "feito" | "pulado"
  parNumero: string | null
  parDeviceId: string | null
}

/**
 * Contas elegíveis ao sorteio: ativas e sem incidente aberto. Carrega junto
 * há quantos dias terminou a última restrição, que é o que faz a conta recuar
 * uma faixa no plano de aquecimento.
 */
export async function contasParaSorteio(): Promise<ContaParaSorteio[]> {
  const saudaveis = await contasSaudaveis()
  if (saudaveis.length === 0) return []

  const externos = await db
    .select({ id: account.id })
    .from(account)
    .innerJoin(device, eq(device.id, account.deviceId))
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(
      and(
        eq(account.status, "ativa"),
        sql`(${device.origem} = 'externa' or ${chip.origem} = 'externa')`,
      ),
    )
  const idsExternos = new Set(externos.map((e) => e.id))
  const elegiveis = saudaveis.filter((c) => !idsExternos.has(c.id))
  if (elegiveis.length === 0) return []

  const ultimasVoltas = await db
    .select({
      accountId: incident.accountId,
      ultimoFim: max(incident.fim).as("ultimo_fim"),
    })
    .from(incident)
    .where(and(eq(incident.tipo, "restricao"), isNotNull(incident.fim)))
    .groupBy(incident.accountId)

  const MS_POR_DIA = 86_400_000

  return elegiveis.map((c) => {
    const volta = ultimasVoltas.find((v) => v.accountId === c.id)
    return {
      id: c.id,
      deviceId: c.deviceId,
      ativadaEm: c.ativadaEm,
      diasDesdeFimDeRestricao: volta?.ultimoFim
        ? Math.floor((Date.now() - new Date(volta.ultimoFim).getTime()) / MS_POR_DIA)
        : null,
    }
  })
}

/** Pares que já conversaram nos últimos 7 dias, para não repetir. */
export async function paresRecentes(dia: string): Promise<Par[]> {
  const desde = new Date(Date.parse(`${dia}T00:00:00Z`) - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10)

  const linhas = await db
    .select({ a: warmupTask.accountId, b: warmupTask.parAccountId })
    .from(warmupTask)
    .where(and(isNotNull(warmupTask.parAccountId), gte(warmupTask.data, desde)))

  return linhas.map((l) => ({ a: l.a, b: l.b! }))
}

export async function tarefasDoDia(dia: string): Promise<TarefaDoDia[]> {
  const par = alias(account, "par")
  const chipDoPar = alias(chip, "chip_do_par")

  return db
    .select({
      id: warmupTask.id,
      accountId: warmupTask.accountId,
      deviceId: account.deviceId,
      slot: account.slot,
      numero: chip.numero,
      acao: warmupAction.nome,
      categoria: warmupAction.categoria,
      status: warmupTask.status,
      parNumero: chipDoPar.numero,
      parDeviceId: par.deviceId,
    })
    .from(warmupTask)
    .innerJoin(account, eq(account.id, warmupTask.accountId))
    .innerJoin(chip, eq(chip.id, account.chipId))
    .innerJoin(warmupAction, eq(warmupAction.id, warmupTask.actionId))
    .leftJoin(par, eq(par.id, warmupTask.parAccountId))
    .leftJoin(chipDoPar, eq(chipDoPar.id, par.chipId))
    .where(eq(warmupTask.data, dia))
    .orderBy(asc(account.deviceId), asc(account.slot), asc(warmupTask.id))
}

export type AparelhoResumo = {
  id: string
  apelido: string | null
  status: "ativo" | "quarentena" | "aposentado"
  origem: "propria" | "externa"
  totalBans: number
  contas: {
    id: number
    slot: string
    chipId: string
    numero: string
    incidenteAberto: "restricao" | "ban" | null
    evolutionStatus: "desconhecido" | "aberta" | "conectando" | "fechada"
    proxyStatus: "sem_conexao" | "ativa" | "inativa"
    statusVerificadoEm: Date | null
  }[]
}

/** Um card por aparelho, com as contas ativas nele e o total de bans no
 * histórico — a visão que faltava entre a ficha individual e o painel geral. */
export async function listarAparelhosComResumo(filtro?: {
  status?: string
  origem?: string
  q?: string
}): Promise<AparelhoResumo[]> {
  const condicoesDevice = []
  if (filtro?.status) condicoesDevice.push(eq(device.status, filtro.status as "ativo" | "quarentena" | "aposentado"))
  if (filtro?.origem) condicoesDevice.push(eq(device.origem, filtro.origem as "propria" | "externa"))
  const termo = filtro?.q?.trim()
  if (termo) {
    const alvo = `%${termo}%`
    condicoesDevice.push(or(ilike(device.id, alvo), ilike(device.apelido, alvo)))
  }

  const [devices, contas, abertos, historico] = await Promise.all([
    db
      .select()
      .from(device)
      .where(condicoesDevice.length > 0 ? and(...condicoesDevice) : undefined)
      .orderBy(asc(device.id)),
    db
      .select({
        id: account.id,
        deviceId: account.deviceId,
        slot: account.slot,
        chipId: account.chipId,
        numero: chip.numero,
        evolutionStatus: account.evolutionStatus,
        proxyStatus: account.proxyStatus,
        statusVerificadoEm: account.statusVerificadoEm,
      })
      .from(account)
      .innerJoin(chip, eq(chip.id, account.chipId))
      .where(eq(account.status, "ativa")),
    contasComIncidenteAberto(),
    db
      .select({ deviceId: account.deviceId, tipo: incident.tipo })
      .from(incident)
      .innerJoin(account, eq(account.id, incident.accountId)),
  ])

  return devices.map((d) => ({
    id: d.id,
    apelido: d.apelido,
    status: d.status,
    origem: d.origem,
    totalBans: historico.filter((h) => h.deviceId === d.id && h.tipo === "ban").length,
    contas: contas
      .filter((c) => c.deviceId === d.id)
      .map((c) => ({
        ...c,
        incidenteAberto: abertos.find((a) => a.id === c.id)?.tipo ?? null,
      })),
  }))
}

export type ChipResumo = {
  id: string
  numero: string
  operadora: string
  status: "novo" | "em_uso" | "aposentado"
  origem: "propria" | "externa"
  local: "pasta" | "gaveta" | "bandeja"
  posicao: string | null
  conta: {
    id: number
    deviceId: string
    slot: string
    evolutionStatus: "desconhecido" | "aberta" | "conectando" | "fechada"
    proxyStatus: "sem_conexao" | "ativa" | "inativa"
    statusVerificadoEm: Date | null
  } | null
}

/** Um card por chip, com a conta que ele gerou (se houver) e a conexão dela. */
export async function listarChipsComResumo(filtro?: {
  status?: string
  origem?: string
  q?: string
}): Promise<ChipResumo[]> {
  const condicoesChip = []
  if (filtro?.status) condicoesChip.push(eq(chip.status, filtro.status as "novo" | "em_uso" | "aposentado"))
  if (filtro?.origem) condicoesChip.push(eq(chip.origem, filtro.origem as "propria" | "externa"))
  const termo = filtro?.q?.trim()
  if (termo) {
    const alvo = `%${termo}%`
    condicoesChip.push(or(ilike(chip.id, alvo), ilike(chip.numero, alvo), ilike(chip.operadora, alvo)))
  }

  const [chips, contas] = await Promise.all([
    db
      .select()
      .from(chip)
      .where(condicoesChip.length > 0 ? and(...condicoesChip) : undefined)
      .orderBy(asc(chip.id)),
    db
      .select({
        id: account.id,
        chipId: account.chipId,
        deviceId: account.deviceId,
        slot: account.slot,
        evolutionStatus: account.evolutionStatus,
        proxyStatus: account.proxyStatus,
        statusVerificadoEm: account.statusVerificadoEm,
      })
      .from(account)
      .where(eq(account.status, "ativa")),
  ])

  return chips.map((c) => ({
    id: c.id,
    numero: c.numero,
    operadora: c.operadora,
    status: c.status,
    origem: c.origem,
    local: c.local,
    posicao: c.posicao,
    conta: contas.find((a) => a.chipId === c.id) ?? null,
  }))
}

export type SlotLivre = { deviceId: string; apelido: string | null; slot: string }

/** Toda combinação aparelho+slot sem conta ativa — o que "Ativar conta"
 * pode de fato oferecer. Aparelho com os 3 slots ocupados simplesmente não
 * contribui nenhuma linha, então some da lista sozinho. */
export async function slotsLivres(): Promise<SlotLivre[]> {
  const [devices, ocupados] = await Promise.all([
    db
      .select({ id: device.id, apelido: device.apelido })
      .from(device)
      .where(eq(device.status, "ativo"))
      .orderBy(asc(device.id)),
    db
      .select({ deviceId: account.deviceId, slot: account.slot })
      .from(account)
      .where(eq(account.status, "ativa")),
  ])

  const livres: SlotLivre[] = []
  for (const d of devices) {
    for (const slot of SLOTS) {
      const ocupado = ocupados.some((o) => o.deviceId === d.id && o.slot === slot)
      if (!ocupado) livres.push({ deviceId: d.id, apelido: d.apelido, slot })
    }
  }
  return livres
}
