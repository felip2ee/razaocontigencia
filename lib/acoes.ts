/**
 * O nome e a explicação de cada operação, num lugar só.
 *
 * Duas telas mostrando a mesma operação com nomes diferentes é o defeito que
 * este arquivo existe para impedir: "Voltou", "Análise devolveu", "Perdido" e
 * "Corrigir aparelho" eram rótulos que não diziam ao operador o que faziam, e
 * mudavam de tela para tela.
 */
export type ChaveDeAcao =
  | "registrar-queda"
  | "restricao"
  | "ban"
  | "voltou-ao-ar"
  | "ban-recuperado"
  | "ban-perdido"
  | "verificar-conexao"
  | "reconectar"
  | "associar-instancia"
  | "corrigir-cadastro"
  | "encerrar-conta"
  | "ativar-conta"
  | "editar-aparelho"
  | "mudar-situacao"
  | "trocar-chip-bandeja"
  | "editar-chip"
  | "mover-chip"
  | "aposentar-chip"
  | "reativar-chip"

export type Acao = {
  /** Texto do botão. Curto, verbo primeiro. */
  rotulo: string
  /** Uma frase dizendo o que a operação faz. Aparece dentro da janela. */
  frase: string
}

export const ACOES: Record<ChaveDeAcao, Acao> = {
  "registrar-queda": {
    rotulo: "Registrar queda",
    frase: "O número caiu. Escolha se foi restrição ou ban.",
  },
  restricao: {
    rotulo: "Restrição",
    frase:
      "Parou de mandar mensagem mas não foi banido. Sai do aquecimento até você marcar que voltou.",
  },
  ban: {
    rotulo: "Ban",
    frase:
      "O número foi banido. Vai para análise, e você marca depois se recuperou ou perdeu.",
  },
  "voltou-ao-ar": {
    rotulo: "Voltou ao ar",
    frase: "A restrição acabou e o número está mandando mensagem de novo.",
  },
  "ban-recuperado": {
    rotulo: "Número recuperado",
    frase: "A análise devolveu o número. A conta volta ao aquecimento.",
  },
  "ban-perdido": {
    rotulo: "Número perdido",
    frase:
      "A análise não devolveu. A conta e o chip são aposentados e o slot fica livre.",
  },
  "verificar-conexao": {
    rotulo: "Verificar conexão",
    frase: "Pergunta à Evolution se o WhatsApp desta conta está aberto.",
  },
  reconectar: {
    rotulo: "Reconectar",
    frase: "Gera o QR code para reconectar o WhatsApp desta conta.",
  },
  "associar-instancia": {
    rotulo: "Associar instância",
    frase:
      "Diz qual instância da Evolution corresponde a esta conta. Sem isso a verificação não sabe onde olhar.",
  },
  "corrigir-cadastro": {
    rotulo: "Corrigir cadastro",
    frase:
      "A conta foi cadastrada no aparelho ou no slot errado. Move o registro, não o chip.",
  },
  "encerrar-conta": {
    rotulo: "Encerrar conta",
    frase:
      "O WhatsApp deste slot não existe mais. Libera o slot e devolve o chip para a pasta.",
  },
  "ativar-conta": {
    rotulo: "Ativar conta",
    frase: "Um chip livre vira WhatsApp neste slot.",
  },
  "editar-aparelho": {
    rotulo: "Editar aparelho",
    frase: "Apelido, origem e notas do aparelho.",
  },
  "mudar-situacao": {
    rotulo: "Mudar situação",
    frase:
      "Ativo, em quarentena ou aposentado. Aparelho fora de ativo não recebe conta nova.",
  },
  "trocar-chip-bandeja": {
    rotulo: "Trocar chip da bandeja",
    frase:
      "O chip de internet 4G que fica na bandeja deste aparelho. Não é WhatsApp.",
  },
  "editar-chip": {
    rotulo: "Editar chip",
    frase: "Número, operadora e origem do chip.",
  },
  "mover-chip": {
    rotulo: "Mover chip",
    frase: "Onde o chip está guardado: pasta, gaveta ou bandeja de um aparelho.",
  },
  "aposentar-chip": {
    rotulo: "Aposentar chip",
    frase: "O chip não serve mais. Sai da lista de chips livres.",
  },
  "reativar-chip": {
    rotulo: "Reativar chip",
    frase: "Volta um chip aposentado para a pasta, disponível de novo.",
  },
}
