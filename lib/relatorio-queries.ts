import { asc, eq } from "drizzle-orm"

import { db } from "./db.ts"
import { gerarRelatorio, type DadosRelatorio, type RelatorioCampanha } from "./relatorio.ts"
import { account, chip, device, incident } from "./schema.ts"

export async function buscarDadosRelatorio(): Promise<DadosRelatorio> {
  const [contas, incidentes] = await Promise.all([
    db
      .select({
        id: account.id,
        ativadaEm: account.ativadaEm,
        slot: account.slot,
        chipId: chip.id,
        chipNumero: chip.numero,
        chipOperadora: chip.operadora,
        chipOrigem: chip.origem,
        chipStatus: chip.status,
        deviceId: device.id,
        deviceApelido: device.apelido,
        deviceOrigem: device.origem,
        deviceStatus: device.status,
      })
      .from(account)
      .innerJoin(chip, eq(chip.id, account.chipId))
      .innerJoin(device, eq(device.id, account.deviceId))
      .orderBy(asc(account.id)),
    db
      .select({
        id: incident.id,
        accountId: incident.accountId,
        tipo: incident.tipo,
        inicio: incident.inicio,
        fim: incident.fim,
        resultado: incident.resultado,
        notas: incident.notas,
      })
      .from(incident)
      .orderBy(asc(incident.inicio), asc(incident.id)),
  ])

  return { contas, incidentes }
}

export async function carregarRelatorio(
  geradoEm: Date = new Date(),
): Promise<RelatorioCampanha> {
  return gerarRelatorio(await buscarDadosRelatorio(), geradoEm)
}
