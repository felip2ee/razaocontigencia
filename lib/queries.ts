import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm"

import { db } from "./db.ts"
import { account, chip, device, incident, warmupAction } from "./schema.ts"
import type { AcaoCatalogo } from "./warmup.ts"

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

export async function contadores() {
  const [aparelhos] = await db
    .select({ n: count() })
    .from(device)
    .where(eq(device.status, "ativo"))
  const [chipsNaPasta] = await db
    .select({ n: count() })
    .from(chip)
    .where(and(eq(chip.local, "pasta"), eq(chip.status, "novo")))
  const saudaveis = await contasSaudaveis()

  return {
    aparelhosAtivos: aparelhos.n,
    contasSaudaveis: saudaveis.length,
    chipsNaPasta: chipsNaPasta.n,
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
