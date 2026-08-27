export function FiltroLista({
  statusOpcoes,
  statusAtual,
  origemAtual,
}: {
  statusOpcoes: { valor: string; rotulo: string }[]
  statusAtual?: string
  origemAtual?: string
}) {
  return (
    <form className="flex flex-wrap items-center gap-2">
      <select
        name="status"
        defaultValue={statusAtual ?? ""}
        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        aria-label="Filtrar por status"
      >
        <option value="">Todos os status</option>
        {statusOpcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      <select
        name="origem"
        defaultValue={origemAtual ?? ""}
        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        aria-label="Filtrar por origem"
      >
        <option value="">Toda origem</option>
        <option value="propria">Própria</option>
        <option value="externa">Externa</option>
      </select>
      <button
        type="submit"
        className="border-input bg-background hover:bg-accent h-9 rounded-md border px-3 text-sm"
      >
        Filtrar
      </button>
    </form>
  )
}
