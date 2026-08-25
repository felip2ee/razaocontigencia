import { sql } from "drizzle-orm"
import {
  date,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const deviceStatus = pgEnum("device_status", ["ativo", "quarentena", "aposentado"])
export const chipStatus = pgEnum("chip_status", ["novo", "em_uso", "aposentado"])
export const chipLocal = pgEnum("chip_local", ["pasta", "gaveta", "bandeja"])
export const accountSlot = pgEnum("account_slot", ["wa1", "wa2", "business"])
export const accountStatus = pgEnum("account_status", ["ativa", "aposentada"])
export const incidentTipo = pgEnum("incident_tipo", ["restricao", "ban"])
export const incidentResultado = pgEnum("incident_resultado", ["pendente", "recuperada", "perdida"])
export const warmupCategoria = pgEnum("warmup_categoria", ["conversa", "perfil", "grupo", "midia"])
export const warmupTaskStatus = pgEnum("warmup_task_status", ["pendente", "feito", "pulado"])
export const evolutionStatus = pgEnum("evolution_status", [
  "desconhecido",
  "aberta",
  "conectando",
  "fechada",
])
export const proxyStatus = pgEnum("proxy_status", ["sem_conexao", "ativa", "inativa"])

export const device = pgTable("device", {
  id: text("id").primaryKey(),
  apelido: text("apelido"),
  status: deviceStatus("status").notNull().default("ativo"),
  notas: text("notas"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const chip = pgTable("chip", {
  id: text("id").primaryKey(),
  operadora: text("operadora").notNull(),
  numero: text("numero").notNull(),
  status: chipStatus("status").notNull().default("novo"),
  local: chipLocal("local").notNull().default("pasta"),
  posicao: text("posicao"),
  bandejaDeviceId: text("bandeja_device_id").references(() => device.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const account = pgTable(
  "account",
  {
    id: serial("id").primaryKey(),
    deviceId: text("device_id")
      .notNull()
      .references(() => device.id),
    slot: accountSlot("slot").notNull(),
    chipId: text("chip_id")
      .notNull()
      .references(() => chip.id),
    ativadaEm: date("ativada_em").notNull(),
    status: accountStatus("status").notNull().default("ativa"),
    evolutionStatus: evolutionStatus("evolution_status").notNull().default("desconhecido"),
    proxyStatus: proxyStatus("proxy_status").notNull().default("sem_conexao"),
    statusVerificadoEm: timestamp("status_verificado_em", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("account_slot_ativo")
      .on(t.deviceId, t.slot)
      .where(sql`${t.status} = 'ativa'`),
    uniqueIndex("account_chip_ativo")
      .on(t.chipId)
      .where(sql`${t.status} = 'ativa'`),
  ],
)

export const incident = pgTable(
  "incident",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => account.id),
    tipo: incidentTipo("tipo").notNull(),
    inicio: timestamp("inicio", { withTimezone: true }).notNull().defaultNow(),
    fim: timestamp("fim", { withTimezone: true }),
    resultado: incidentResultado("resultado"),
    notas: text("notas"),
  },
  (t) => [
    uniqueIndex("incident_aberto_unico")
      .on(t.accountId)
      .where(sql`${t.fim} is null`),
  ],
)

export const warmupAction = pgTable("warmup_action", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull().unique(),
  categoria: warmupCategoria("categoria").notNull(),
  idadeMinDias: integer("idade_min_dias").notNull().default(0),
  idadeMaxDias: integer("idade_max_dias"),
  peso: integer("peso").notNull().default(1),
})

export const warmupTask = pgTable(
  "warmup_task",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => account.id),
    actionId: integer("action_id")
      .notNull()
      .references(() => warmupAction.id),
    data: date("data").notNull(),
    parAccountId: integer("par_account_id").references(() => account.id),
    status: warmupTaskStatus("status").notNull().default("pendente"),
    feitoEm: timestamp("feito_em", { withTimezone: true }),
  },
  (t) => [uniqueIndex("warmup_task_unica").on(t.accountId, t.actionId, t.data)],
)
