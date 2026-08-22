import assert from "node:assert/strict"
import { test } from "node:test"

import {
  acoesElegiveis,
  escolherPar,
  faixaDe,
  faixaEfetiva,
  gerarTarefasDoDia,
  hojeISO,
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
  { id: 5, nome: "chamada de voz", categoria: "midia", idadeMinDias: 15, idadeMaxDias: null, peso: 1 },
]

// rng determinístico: devolve os valores da lista, em ordem, e repete o último.
function rngFixo(valores: number[]): () => number {
  let i = 0
  return () => valores[Math.min(i++, valores.length - 1)]
}

// As datas de teste são construídas no fuso local de propósito: a idade e o
// "hoje" do sistema são locais, porque `ativadaEm` vem de um input de data.
test("idadeEmDias conta os dias entre a ativação e hoje", () => {
  assert.equal(idadeEmDias("2026-08-01", new Date(2026, 7, 11, 12, 0)), 10)
  assert.equal(idadeEmDias("2026-08-11", new Date(2026, 7, 11, 23, 0)), 0)
})

test("idadeEmDias e hojeISO usam a data local, não a UTC", () => {
  // 22h30 do dia 22 num fuso a oeste de Greenwich já é dia 23 em UTC.
  const noiteDoDia22 = new Date(2026, 7, 22, 22, 30)
  assert.equal(hojeISO(noiteDoDia22), "2026-08-22")
  assert.equal(idadeEmDias("2026-08-22", noiteDoDia22), 0)
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
  const hoje = new Date(2026, 7, 11, 9, 0)
  const tarefas = gerarTarefasDoDia(
    [contaA, contaC, contaD],
    catalogo,
    [],
    hoje,
    rngFixo([0]),
  )
  for (const t of tarefas) {
    const acao = catalogo.find((a) => a.id === t.actionId)!
    if (acao.categoria === "conversa") assert.notEqual(t.parAccountId, null)
    else assert.equal(t.parAccountId, null)
  }
})

test("gerarTarefasDoDia respeita a quantidade da faixa de cada conta", () => {
  const hoje = new Date(2026, 7, 11, 9, 0)
  const novinha: ContaParaSorteio = { id: 9, deviceId: "AP9", ativadaEm: "2026-08-10" }
  const tarefas = gerarTarefasDoDia([novinha], catalogo, [], hoje, rngFixo([0]))
  assert.equal(tarefas.length, 2)
})

test("gerarTarefasDoDia sorteia par contra todas as candidatas, não só quem ainda não tem tarefa", () => {
  const hoje = new Date(2026, 7, 11, 9, 0)
  // contaA é a única a sortear hoje; contaC já tem tarefa, mas segue sendo par possível.
  const tarefas = gerarTarefasDoDia([contaA], catalogo, [], hoje, rngFixo([0]), [
    contaA,
    contaC,
  ])
  const conversa = tarefas.find((t) => t.parAccountId !== null)
  assert.equal(conversa?.parAccountId, contaC.id)
})

test("gerarTarefasDoDia não repete o mesmo par em duas conversas do mesmo dia", () => {
  const duasConversas: AcaoCatalogo[] = [
    { id: 10, nome: "conversa 1", categoria: "conversa", idadeMinDias: 0, idadeMaxDias: null, peso: 1 },
    { id: 11, nome: "conversa 2", categoria: "conversa", idadeMinDias: 0, idadeMaxDias: null, peso: 1 },
  ]
  const hoje = new Date(2026, 7, 11, 9, 0)
  const tarefas = gerarTarefasDoDia([contaA], duasConversas, [], hoje, rngFixo([0]), [
    contaA,
    contaC,
    contaD,
  ])
  assert.equal(tarefas.length, 2)
  assert.notEqual(tarefas[0].parAccountId, tarefas[1].parAccountId)
})

test("recuo pós-restrição corta o que a conta pode fazer, não só quantas ações", () => {
  const hoje = new Date(2026, 7, 21, 9, 0)
  const veterana: ContaParaSorteio = {
    id: 7,
    deviceId: "AP7",
    ativadaEm: "2026-08-01", // 20 dias: faixa 15-30 pela idade real
    diasDesdeFimDeRestricao: 1, // recuou para a faixa 8-14
  }
  const tarefas = gerarTarefasDoDia([veterana], catalogo, [], hoje, rngFixo([0]))
  assert.ok(
    !tarefas.some((t) => t.actionId === 5),
    "ação exclusiva da faixa 15-30 não pode sair para quem recuou para a 8-14",
  )
  // Só as três ações liberadas até o dia 14, mesmo com cota de 8.
  assert.deepEqual(tarefas.map((t) => t.actionId).sort(), [2, 3, 4])
})
