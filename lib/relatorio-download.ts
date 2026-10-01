import {
  csvDoRelatorio,
  identificarTipoArquivo,
  nomeArquivoRelatorio,
} from "./relatorio-csv.ts"
import type { RelatorioCampanha } from "./relatorio.ts"

export type CarregarRelatorio = () => Promise<RelatorioCampanha>

export async function responderDownloadRelatorio(
  arquivo: string,
  carregar: CarregarRelatorio,
): Promise<Response> {
  const tipo = identificarTipoArquivo(arquivo)
  if (!tipo) {
    return new Response("Arquivo não encontrado.", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  }

  try {
    const relatorio = await carregar()
    const csv = csvDoRelatorio(tipo, relatorio)
    const nome = nomeArquivoRelatorio(tipo, relatorio.geradoEm)

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nome}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (erro) {
    console.error("Falha ao gerar relatório para download:", erro)
    return new Response("Não foi possível gerar o relatório.", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  }
}
