import { db } from "./db.ts"
import { warmupAction } from "./schema.ts"

const CATALOGO = [
  // perfil e presença — liberado desde o dia zero
  { nome: "Definir foto de perfil", categoria: "perfil", idadeMinDias: 0, idadeMaxDias: 3, peso: 2 },
  { nome: "Definir nome e recado", categoria: "perfil", idadeMinDias: 0, idadeMaxDias: 3, peso: 2 },
  { nome: "Ficar 10 minutos online", categoria: "perfil", idadeMinDias: 0, idadeMaxDias: null, peso: 2 },
  { nome: "Ver o status dos outros números", categoria: "perfil", idadeMinDias: 0, idadeMaxDias: null, peso: 1 },
  { nome: "Postar um status", categoria: "perfil", idadeMinDias: 4, idadeMaxDias: null, peso: 1 },
  // conversa entre os próprios números — a partir do dia 4
  { nome: "Trocar 5 mensagens de texto com outro número", categoria: "conversa", idadeMinDias: 4, idadeMaxDias: null, peso: 3 },
  // Sem esta a faixa 4-7 tem só 4 ações elegíveis para uma cota de 5, e toda
  // conta na segunda semana fica abaixo da cota para sempre.
  { nome: "Responder as mensagens recebidas do dia", categoria: "conversa", idadeMinDias: 4, idadeMaxDias: null, peso: 2 },
  { nome: "Conversa de 15 mensagens, ida e volta", categoria: "conversa", idadeMinDias: 8, idadeMaxDias: null, peso: 2 },
  { nome: "Responder uma mensagem antiga", categoria: "conversa", idadeMinDias: 15, idadeMaxDias: null, peso: 1 },
  // mídia — a partir do dia 8
  { nome: "Mandar um áudio curto", categoria: "midia", idadeMinDias: 8, idadeMaxDias: null, peso: 2 },
  { nome: "Mandar uma foto", categoria: "midia", idadeMinDias: 8, idadeMaxDias: null, peso: 2 },
  { nome: "Mandar um sticker", categoria: "midia", idadeMinDias: 8, idadeMaxDias: null, peso: 1 },
  { nome: "Mandar um documento PDF", categoria: "midia", idadeMinDias: 15, idadeMaxDias: null, peso: 1 },
  { nome: "Chamada de voz de 1 minuto", categoria: "midia", idadeMinDias: 15, idadeMaxDias: null, peso: 1 },
  // grupos — a partir do dia 8
  { nome: "Entrar em um grupo", categoria: "grupo", idadeMinDias: 8, idadeMaxDias: 14, peso: 1 },
  { nome: "Mandar mensagem em um grupo", categoria: "grupo", idadeMinDias: 15, idadeMaxDias: null, peso: 2 },
  { nome: "Participar de conversa em grupo por 10 minutos", categoria: "grupo", idadeMinDias: 15, idadeMaxDias: null, peso: 1 },
] as const

await db
  .insert(warmupAction)
  .values(CATALOGO.map((a) => ({ ...a })))
  .onConflictDoNothing({ target: warmupAction.nome })

console.log(`catálogo: ${CATALOGO.length} ações garantidas`)
process.exit(0)
