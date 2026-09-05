"use client"

import { DialogAcao } from "@/components/dialog-acao"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ACOES } from "@/lib/acoes"
import {
  ativarConta,
  cancelarConta,
  corrigirAparelho,
  encerrarIncidente,
  registrarIncidente,
  resolverBan,
} from "@/lib/actions"
import type { InstanciaEvolution } from "@/lib/evolution"
import { definirInstancia } from "@/lib/evolution-actions"
import type { SlotLivre } from "@/lib/queries"
import { NOME_DO_SLOT, SLOTS } from "@/lib/slots"

export type ContaParaAcoes = {
  id: number
  deviceId: string
  slot: string
  instanceName: string | null
  evolutionServerId: number | null
}

export type ChipLivre = { id: string; numero: string; operadora: string }

const CAMPO = "border-input bg-background h-9 rounded-md border px-3 text-sm"

/**
 * `datetime-local` quer "2026-09-04T14:30" no fuso local, não ISO em UTC.
 * Fica dentro de um componente próprio porque só é chamado quando a janela
 * abre: calculado durante o render da página, o valor divergiria entre
 * servidor e cliente e o React acusaria hidratação errada.
 */
function CampoQuando() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  const agora = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="rq-inicio">Quando caiu</Label>
      <Input
        id="rq-inicio"
        name="inicio"
        type="datetime-local"
        defaultValue={agora}
        required
      />
    </div>
  )
}

function EscolhaDeTipo() {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-sm font-medium">O que aconteceu</legend>
      {(["restricao", "ban"] as const).map((chave, i) => (
        <label
          key={chave}
          className="flex cursor-pointer gap-2.5 rounded-lg border border-border p-2.5 hover:bg-muted/50"
        >
          <input
            type="radio"
            name="tipo"
            value={chave}
            defaultChecked={i === 0}
            className="mt-1 shrink-0"
          />
          <span>
            <span className="block font-medium">{ACOES[chave].rotulo}</span>
            <span className="text-xs text-muted-foreground">
              {ACOES[chave].frase}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

export function RegistrarQueda({ accountId }: { accountId: number }) {
  return (
    <DialogAcao
      rotulo={ACOES["registrar-queda"].rotulo}
      titulo={ACOES["registrar-queda"].rotulo}
      descricao={ACOES["registrar-queda"].frase}
      confirmar="Registrar"
      acao={registrarIncidente}
    >
      <input type="hidden" name="accountId" value={accountId} />
      <EscolhaDeTipo />
      <CampoQuando />
    </DialogAcao>
  )
}

export function VoltouAoAr({ incidentId }: { incidentId: number }) {
  return (
    <DialogAcao
      rotulo={ACOES["voltou-ao-ar"].rotulo}
      titulo={ACOES["voltou-ao-ar"].rotulo}
      descricao={ACOES["voltou-ao-ar"].frase}
      confirmar="Marcar que voltou"
      acao={encerrarIncidente}
      variant="default"
    >
      <input type="hidden" name="incidentId" value={incidentId} />
    </DialogAcao>
  )
}

export function ResolverBan({ incidentId }: { incidentId: number }) {
  return (
    <>
      <DialogAcao
        rotulo={ACOES["ban-recuperado"].rotulo}
        titulo={ACOES["ban-recuperado"].rotulo}
        descricao={ACOES["ban-recuperado"].frase}
        confirmar="Marcar como recuperado"
        acao={resolverBan}
        variant="default"
      >
        <input type="hidden" name="incidentId" value={incidentId} />
        <input type="hidden" name="resultado" value="recuperada" />
      </DialogAcao>
      <DialogAcao
        rotulo={ACOES["ban-perdido"].rotulo}
        titulo={ACOES["ban-perdido"].rotulo}
        descricao={ACOES["ban-perdido"].frase}
        confirmar="Marcar como perdido"
        acao={resolverBan}
        variant="destructive"
      >
        <input type="hidden" name="incidentId" value={incidentId} />
        <input type="hidden" name="resultado" value="perdida" />
      </DialogAcao>
    </>
  )
}

function SelectDeInstancia({
  instancias,
  servidores,
  valorAtual,
  falharam,
}: {
  instancias: InstanciaEvolution[]
  servidores: { id: number; nome: string }[]
  valorAtual: string
  falharam: string[]
}) {
  const naLista = instancias.some(
    (i) => `${i.serverId}::${i.name}` === valorAtual
  )

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="ai-instancia">Instância na Evolution</Label>
      <select
        id="ai-instancia"
        name="instancia"
        defaultValue={valorAtual}
        className={CAMPO}
      >
        <option value="">— sem instância —</option>
        {valorAtual !== "" && !naLista && (
          <option value={valorAtual}>
            {valorAtual.slice(valorAtual.indexOf("::") + 2)} (não encontrada no
            servidor)
          </option>
        )}
        {servidores.map((s) => (
          <optgroup key={s.id} label={s.nome}>
            {instancias
              .filter((i) => i.serverId === s.id)
              .map((i) => (
                <option
                  key={`${i.serverId}::${i.name}`}
                  value={`${i.serverId}::${i.name}`}
                >
                  {i.name}
                  {i.numero ? ` — ${i.numero}` : ""} ({i.status})
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {servidores.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum servidor Evolution cadastrado. Cadastre um em /servidores.
        </p>
      )}
      {falharam.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {falharam.join(", ")} não respondeu(ram).
        </p>
      )}
    </div>
  )
}

export function AtivarConta({
  rotulo,
  destino,
  chip,
  instancias,
  servidores,
  falharam,
}: {
  rotulo: string
  destino: { deviceId: string; slot: string } | { opcoes: SlotLivre[] }
  chip:
    { id: string; numero: string; operadora: string } | { opcoes: ChipLivre[] }
  instancias: InstanciaEvolution[]
  servidores: { id: number; nome: string }[]
  falharam: string[]
}) {
  const semVaga = "opcoes" in destino && destino.opcoes.length === 0
  const semChip = "opcoes" in chip && chip.opcoes.length === 0

  return (
    <DialogAcao
      rotulo={rotulo}
      titulo={ACOES["ativar-conta"].rotulo}
      descricao={ACOES["ativar-conta"].frase}
      confirmar="Ativar"
      acao={ativarConta}
      variant="default"
    >
      {"opcoes" in destino ? (
        <div className="grid gap-1.5">
          <Label htmlFor="ac-destino">Aparelho e slot</Label>
          {semVaga ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma vaga livre em nenhum aparelho ativo.
            </p>
          ) : (
            <select id="ac-destino" name="destino" required className={CAMPO}>
              {destino.opcoes.map((s) => (
                <option
                  key={`${s.deviceId}|${s.slot}`}
                  value={`${s.deviceId}|${s.slot}`}
                >
                  {s.deviceId}
                  {s.apelido ? ` — ${s.apelido}` : ""} — {NOME_DO_SLOT[s.slot]}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <>
          <input
            type="hidden"
            name="destino"
            value={`${destino.deviceId}|${destino.slot}`}
          />
          <p className="text-sm text-muted-foreground">
            Aparelho {destino.deviceId}, {NOME_DO_SLOT[destino.slot]}.
          </p>
        </>
      )}

      {"opcoes" in chip ? (
        <div className="grid gap-1.5">
          <Label htmlFor="ac-chip">Chip</Label>
          {semChip ? (
            <p className="text-sm text-muted-foreground">
              Nenhum chip livre. Cadastre um chip novo primeiro.
            </p>
          ) : (
            <select id="ac-chip" name="chipId" required className={CAMPO}>
              {chip.opcoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.numero} ({c.operadora})
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <>
          <input type="hidden" name="chipId" value={chip.id} />
          <p className="text-sm text-muted-foreground">
            Chip {chip.id} — {chip.numero} ({chip.operadora}).
          </p>
        </>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="ac-data">Ativada em</Label>
        <Input id="ac-data" name="ativadaEm" type="date" required />
      </div>

      <SelectDeInstancia
        instancias={instancias}
        servidores={servidores}
        valorAtual=""
        falharam={falharam}
      />
    </DialogAcao>
  )
}

/**
 * As três operações que o operador quase nunca usa, fechadas atrás de um
 * `<details>` nativo. Abertas, cada uma vem com a frase que diz o que faz —
 * o cartão fica com três botões e mesmo assim nada some da tela.
 */
export function MaisAcoesDaConta({
  conta,
  aparelhos,
  instancias,
  servidores,
  falharam,
}: {
  conta: ContaParaAcoes
  aparelhos: { id: string; apelido: string | null }[]
  instancias: InstanciaEvolution[]
  servidores: { id: number; nome: string }[]
  falharam: string[]
}) {
  const valorAtual =
    conta.evolutionServerId && conta.instanceName
      ? `${conta.evolutionServerId}::${conta.instanceName}`
      : ""

  // O aparelho atual da conta pode não estar na lista (ex.: aparelho em
  // quarentena, que não é "ativo" mas continua com contas ativas). Sem ele
  // como opção, o `<select defaultValue={conta.deviceId}>` cai calado na
  // primeira opção e "Corrigir cadastro" move a conta para um aparelho que
  // ninguém escolheu. Root fix aqui cobre as duas páginas que chamam isto.
  const aparelhosComAtual = aparelhos.some((a) => a.id === conta.deviceId)
    ? aparelhos
    : [{ id: conta.deviceId, apelido: null }, ...aparelhos]

  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground select-none hover:text-foreground">
        Mais ações <span className="group-open:hidden">▾</span>
        <span className="hidden group-open:inline">▴</span>
      </summary>

      <div className="mt-2 flex flex-col gap-3">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">
            {ACOES["associar-instancia"].frase}
          </p>
          <DialogAcao
            rotulo={ACOES["associar-instancia"].rotulo}
            titulo={ACOES["associar-instancia"].rotulo}
            descricao={ACOES["associar-instancia"].frase}
            confirmar="Associar"
            acao={definirInstancia}
          >
            <input type="hidden" name="accountId" value={conta.id} />
            <SelectDeInstancia
              instancias={instancias}
              servidores={servidores}
              valorAtual={valorAtual}
              falharam={falharam}
            />
          </DialogAcao>
        </div>

        <div>
          <p className="mb-1 text-xs text-muted-foreground">
            {ACOES["corrigir-cadastro"].frase}
          </p>
          <DialogAcao
            rotulo={ACOES["corrigir-cadastro"].rotulo}
            titulo={ACOES["corrigir-cadastro"].rotulo}
            descricao={ACOES["corrigir-cadastro"].frase}
            confirmar="Corrigir"
            acao={corrigirAparelho}
          >
            <input type="hidden" name="accountId" value={conta.id} />
            <div className="grid gap-1.5">
              <Label htmlFor="cc-device">Aparelho certo</Label>
              <select
                id="cc-device"
                name="deviceId"
                defaultValue={conta.deviceId}
                className={CAMPO}
              >
                {aparelhosComAtual.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id}
                    {a.apelido ? ` — ${a.apelido}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cc-slot">Slot certo</Label>
              <select
                id="cc-slot"
                name="slot"
                defaultValue={conta.slot}
                className={CAMPO}
              >
                {SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {NOME_DO_SLOT[s]}
                  </option>
                ))}
              </select>
            </div>
          </DialogAcao>
        </div>

        <div>
          <p className="mb-1 text-xs text-muted-foreground">
            {ACOES["encerrar-conta"].frase}
          </p>
          <DialogAcao
            rotulo={ACOES["encerrar-conta"].rotulo}
            titulo={ACOES["encerrar-conta"].rotulo}
            descricao={ACOES["encerrar-conta"].frase}
            confirmar="Encerrar conta"
            acao={cancelarConta}
            variant="destructive"
          >
            <input type="hidden" name="accountId" value={conta.id} />
          </DialogAcao>
        </div>
      </div>
    </details>
  )
}
