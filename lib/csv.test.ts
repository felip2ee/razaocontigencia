import assert from "node:assert/strict"
import { test } from "node:test"

import { serializarCsv } from "./csv.ts"

test("gera UTF-8 com BOM, ponto e virgula e CRLF", () => {
  const csv = serializarCsv(["nome", "valor"], [["item", 2]])
  assert.equal(csv, "\uFEFFnome;valor\r\nitem;2\r\n")
})

test("escapa separador, aspas e quebras de linha", () => {
  const csv = serializarCsv(["texto"], [['a; "b"\nlinha']])
  assert.ok(csv.includes('"a; ""b""\nlinha"'))
})

test("neutraliza prefixos de formula inclusive apos espacos", () => {
  const csv = serializarCsv(["valor"], [["=1+1"], ["  @cmd"], ["-12"], [-12]])
  assert.ok(csv.includes("'=1+1"))
  assert.ok(csv.includes("'  @cmd"))
  assert.ok(csv.includes("'-12"))
  assert.ok(csv.includes("\r\n-12\r\n"))
})

test("representa null como campo vazio e rejeita linha de tamanho incorreto", () => {
  assert.equal(serializarCsv(["a"], [[null]]), "\uFEFFa\r\n\r\n")
  assert.throws(() => serializarCsv(["a"], [["x", "y"]]))
})

test("neutraliza formula no cabecalho e apos tabulacao", () => {
  assert.equal(
    serializarCsv(["+total"], [["\t=1+1"]]),
    "\uFEFF'+total\r\n'\t=1+1\r\n"
  )
})

test("rejeita tambem linha menor que o cabecalho", () => {
  assert.throws(() => serializarCsv(["a", "b"], [["x"]]))
})
