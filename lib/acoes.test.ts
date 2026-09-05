import { strict as assert } from "node:assert"
import { test } from "node:test"

import { ACOES } from "./acoes.ts"

test("toda ação tem rótulo e frase preenchidos", () => {
  for (const [chave, acao] of Object.entries(ACOES)) {
    assert.ok(acao.rotulo.trim().length > 0, `${chave} está sem rótulo`)
    assert.ok(acao.frase.trim().length > 0, `${chave} está sem frase`)
  }
})

test("nenhum rótulo se repete entre ações", () => {
  const vistos = new Map<string, string>()
  for (const [chave, acao] of Object.entries(ACOES)) {
    const anterior = vistos.get(acao.rotulo)
    assert.equal(
      anterior,
      undefined,
      `"${acao.rotulo}" aparece em ${chave} e em ${anterior}`,
    )
    vistos.set(acao.rotulo, chave)
  }
})

test("as chaves que as telas usam existem", () => {
  for (const chave of [
    "registrar-queda",
    "voltou-ao-ar",
    "ban-recuperado",
    "ban-perdido",
    "ativar-conta",
    "trocar-chip-bandeja",
    "mover-chip",
  ] as const) {
    assert.ok(chave in ACOES, `falta a chave ${chave}`)
  }
})
