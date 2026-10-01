import { responderDownloadRelatorio } from "../../../../lib/relatorio-download.ts"
import { carregarRelatorio } from "../../../../lib/relatorio-queries.ts"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ arquivo: string }> },
): Promise<Response> {
  const { arquivo } = await params
  return responderDownloadRelatorio(arquivo, () => carregarRelatorio())
}
