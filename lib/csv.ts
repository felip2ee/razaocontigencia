export type ValorCsv = string | number | null

function serializarCampo(valor: ValorCsv): string {
  let texto = valor === null ? "" : String(valor)

  if (typeof valor === "string" && /^\s*[=+\-@]/u.test(valor)) {
    texto = `'${valor}`
  }

  if (/[;"\r\n]/u.test(texto)) {
    return `"${texto.replaceAll('"', '""')}"`
  }

  return texto
}

export function serializarCsv(
  cabecalho: readonly string[],
  linhas: readonly (readonly ValorCsv[])[]
): string {
  const registros = [cabecalho.map(serializarCampo).join(";")]

  for (const linha of linhas) {
    if (linha.length !== cabecalho.length) {
      throw new Error(
        "Linha CSV com quantidade de campos diferente do cabecalho"
      )
    }

    registros.push(linha.map(serializarCampo).join(";"))
  }

  return `\uFEFF${registros.join("\r\n")}\r\n`
}
