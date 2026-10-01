import assert from "node:assert/strict"
import { test } from "node:test"
import type { PoolClient, QueryConfig } from "pg"

import { db } from "./db.ts"
import { buscarDadosRelatorio } from "./relatorio-queries.ts"

test("le contas e incidentes no mesmo snapshot repeatable read somente leitura", async (t) => {
  const consultas: { conexao: string; sql: string }[] = []
  const consultar = (conexao: string) => async (query: QueryConfig) => {
    consultas.push({ conexao, sql: query.text })
    return { rows: [] }
  }
  let liberacoes = 0
  const cliente = {
    query: consultar("transacao"),
    release: () => {
      liberacoes++
    },
  } as unknown as PoolClient
  // Only replace network I/O: Drizzle still builds and executes all SQL.
  t.mock.method(db.$client, "connect", async () => cliente)
  t.mock.method(db.$client, "query", consultar("pool"))

  assert.deepEqual(await buscarDadosRelatorio(), { contas: [], incidentes: [] })
  assert.equal(
    consultas[0]?.sql,
    "begin isolation level repeatable read read only"
  )
  assert.equal(consultas.length, 4)
  assert.ok(consultas.every(({ conexao }) => conexao === "transacao"))
  assert.match(consultas[1].sql, /from "account"/)
  assert.match(consultas[2].sql, /from "incident"/)
  assert.equal(consultas[3].sql, "commit")
  assert.equal(liberacoes, 1)
})
