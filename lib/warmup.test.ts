import assert from "node:assert/strict"
import { test } from "node:test"

import {
  acoesElegiveis,
  escolherPar,
  faixaDe,
  faixaEfetiva,
  gerarTarefasDoDia,
  idadeEmDias,
  sortearAcoes,
  type AcaoCatalogo,
  type ContaParaSorteio,
} from "./warmup.ts"

const catalogo: AcaoCatalogo[] = [
  { id: 1, nome: "foto de perfil", categoria: "perfil", idadeMinDias: 0, idadeMaxDias: 3, peso: 1 },
  { id: 2, nome: "ficar online", categoria: "perfil", idadeMinDias: 0, idadeMaxDias: null, peso: 1 },
  { id: 3, nome: "conversa curta", categoria: "conversa", idadeMinDias: 4, idadeMaxDias: null, peso: 1 },
  { id: 4, nome: "mandar audio", categoria: "midia", idadeMinDias: 8, idadeMaxDias: null, peso: 1 },
]

// rng determinístico: devolve os valores da lista, em ordem, e repete o último.
function rngFixo(valores: number[]): () => number {
  let i = 0
  return () => valores[Math.min(i++, valores.length - 1)]
}

test("idadeEmDias conta os dias entre a ativação e hoje", () => {
  assert.equal(idadeEmDias("2026-08-01", new Date("2026-08-11T12:00:00Z")), 10)
  assert.equal(idadeEmDias("2026-08-11", new Date("2026-08-11T23:00:00Z")), 0)
})

test("faixaDe escolhe a faixa pela idade, inclusive nos limites", () => {
  assert.equal(faixaDe(0).acoesPorDia, 2)
  assert.equal(faixaDe(3).acoesPorDia, 2)
  assert.equal(faixaDe(4).acoesPorDia, 5)
  assert.equal(faixaDe(14).acoesPorDia, 8)
  assert.equal(faixaDe(30).acoesPorDia, 12)
  assert.equal(faixaDe(365).acoesPorDia, 5)
})

test("faixaEfetiva recua uma faixa nos 7 dias seguintes ao fim de uma restrição", () => {
  assert.equal(faixaEfetiva(20, null).acoesPorDia, 12)
  assert.equal(faixaEfetiva(20, 3).acoesPorDia, 8)
  assert.equal(faixaEfetiva(20, 7).acoesPorDia, 12)
})

test("faixaEfetiva não recua abaixo da primeira faixa", () => {
  assert.equal(faixaEfetiva(1, 0).acoesPorDia, 2)
})

test("acoesElegiveis respeita idade mínima e máxima", () => {
  assert.deepEqual(
    acoesElegiveis(catalogo, 1).map((a) => a.id),
    [1, 2],
  )
  assert.deepEqual(
    acoesElegiveis(catalogo, 5).map((a) => a.id),
    [2, 3],
  )
  assert.deepEqual(
    acoesElegiveis(catalogo, 10).map((a) => a.id),
    [2, 3, 4],
  )
})

test("sortearAcoes nunca repete a mesma ação no mesmo dia", () => {
  const sorteadas = sortearAcoes(catalogo, 10, 3, rngFixo([0, 0, 0]))
  const ids = sorteadas.map((a) => a.id)
  assert.equal(ids.length, 3)
  assert.equal(new Set(ids).size, 3)
})

test("sortearAcoes devolve no máximo o que existe de elegível", () => {
  const sorteadas = sortearAcoes(catalogo, 1, 10, rngFixo([0]))
  assert.equal(sorteadas.length, 2)
})

const contaA: ContaParaSorteio = { id: 1, deviceId: "AP1", ativadaEm: "2026-08-01" }
const contaB: ContaParaSorteio = { id: 2, deviceId: "AP1", ativadaEm: "2026-08-01" }
const contaC: ContaParaSorteio = { id: 3, deviceId: "AP2", ativadaEm: "2026-08-01" }
const contaD: ContaParaSorteio = { id: 4, deviceId: "AP3", ativadaEm: "2026-08-01" }

test("escolherPar nunca escolhe conta do mesmo aparelho", () => {
  const par = escolherPar(contaA, [contaB, contaC], [], rngFixo([0]))
  assert.equal(par, contaC.id)
})

test("escolherPar evita par repetido nos últimos 7 dias", () => {
  const par = escolherPar(contaA, [contaC, contaD], [{ a: 1, b: 3 }], rngFixo([0]))
  assert.equal(par, contaD.id)
})

test("escolherPar trata par recente na ordem invertida", () => {
  const par = escolherPar(contaA, [contaC, contaD], [{ a: 3, b: 1 }], rngFixo([0]))
  assert.equal(par, contaD.id)
})

test("escolherPar devolve null quando não há candidata possível", () => {
  assert.equal(escolherPar(contaA, [contaB], [], rngFixo([0])), null)
})

test("gerarTarefasDoDia só dá par a ações de conversa", () => {
  const hoje = new Date("2026-08-11T09:00:00Z")
  const tarefas = gerarTarefasDoDia([contaA, contaC], catalogo, [], hoje, rngFixo([0]))
  for (const t of tarefas) {
    const acao = catalogo.find((a) => a.id === t.actionId)!
    if (acao.categoria === "conversa") assert.notEqual(t.parAccountId, null)
    else assert.equal(t.parAccountId, null)
  }
})

test("gerarTarefasDoDia respeita a quantidade da faixa de cada conta", () => {
  const hoje = new Date("2026-08-11T09:00:00Z")
  const novinha: ContaParaSorteio = { id: 9, deviceId: "AP9", ativadaEm: "2026-08-10" }
  const tarefas = gerarTarefasDoDia([novinha], catalogo, [], hoje, rngFixo([0]))
  assert.equal(tarefas.length, 2)
})
