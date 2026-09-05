import assert from "node:assert/strict"
import { mock, test } from "node:test"

mock.module("next/cache", { namedExports: { refresh() {} } })
mock.module(new URL("./db.ts", import.meta.url).href, {
  namedExports: {
    db: {
      update() {
        return {
          set() {
            return {
              where() {
                return { returning: async () => [] }
              },
            }
          },
        }
      },
      select() {
        throw new Error("não deve sincronizar uma conta inválida")
      },
    },
  },
})

const { definirInstancia } = await import("./evolution-actions.ts")

test("definirInstancia rejeita ID ausente ou conta inexistente", async () => {
  for (const accountId of [null, "999999"]) {
    const formData = new FormData()
    if (accountId !== null) formData.set("accountId", accountId)

    assert.deepEqual(await definirInstancia(null, formData), { erro: "Conta inválida." })
  }
})
