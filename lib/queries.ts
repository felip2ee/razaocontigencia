import { and, asc, count, desc, eq, gte, isNotNull, isNull, max, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { db } from "./db.ts"
import { account, chip, device, incident, warmupAction, warmupTask } from "./schema.ts"
import type { AcaoCatalogo, ContaParaSorteio, Par } from "./warmup.ts"

export type ContaNaLista = {
  id: number
  deviceId: string
  slot: string
  chipId: string
  numero: string
  operadora: string
  ativadaEm: string
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
}

export async function listarCatalogo(): Promise<AcaoCatalogo[]> {
  return db.select().from(warmupAction).orderBy(asc(warmupAction.id))
}

/** Contas ativas sem nenhum incidente aberto. */
export async function contasSaudaveis(): Promise<ContaNaLista[]> {
  const abertos = db
    .select({ accountId: incident.accountId })
    .from(incident)
    .where(isNull(incident.fim))

  return db
    .select(CAMPOS_DA_CONTA)
    .from(account)
    .innerJoin(chip, eq(chip.id, account.chipId))
    .where(and(eq(account.status, "ativa"), sql`${account.id} not in ${abertos}`))
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
    .orderBy(desc(incident.inicio))
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

  return {
    aparelhosAtivos: aparelhos.n,
    contasSaudaveis: saudaveis.length,
    chipsLivres: livres.length,
  }
}

export type FichaAparelho = {
  device: typeof device.$inferSelect
  chipNaBandeja: typeof chip.$inferSelect | null
  contas: (ContaNaLista & {
    status: "ativa" | "aposentada"
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
    .select({ ...CAMPOS_DA_CONTA, status: account.status })
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

  const ultimasVoltas = await db
    .select({
      accountId: incident.accountId,
      ultimoFim: max(incident.fim).as("ultimo_fim"),
    })
    .from(incident)
    .where(and(eq(incident.tipo, "restricao"), isNotNull(incident.fim)))
    .groupBy(incident.accountId)

  const MS_POR_DIA = 86_400_000

  return saudaveis.map((c) => {
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
