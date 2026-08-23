export function PageHeader({
  titulo,
  subtitulo,
  acoes,
}: {
  titulo: string
  subtitulo: string
  acoes?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="border-primary border-l-2 pl-3">
        <h1 className="text-lg leading-tight font-semibold">{titulo}</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">{subtitulo}</p>
      </div>
      {acoes}
    </div>
  )
}
