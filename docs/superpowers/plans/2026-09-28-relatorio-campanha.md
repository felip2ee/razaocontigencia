# Relatório gerencial da campanha — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um painel gerencial que resume todo o histórico operacional e exporta relações de resumo, chips, incidentes e aparelhos em CSV compatível com Excel.

**Architecture:** Duas consultas simples carregam contas contextualizadas e incidentes; uma função pura agrega esses registros em um modelo único usado pela tela e pelos downloads. Serialização, apresentação dos quatro CSVs e resposta HTTP ficam em módulos separados, deixando a rota e a página finas.

**Tech Stack:** Next.js 16.2 App Router, React 19 Server Components, TypeScript estrito, Drizzle ORM/PostgreSQL, Tailwind CSS 4, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-28-relatorio-campanha-design.md`

## Global Constraints

- "Campanha" significa todo o histórico existente no banco no instante da consulta; não criar entidade nem filtro de campanha.
- Não consultar nem exportar tarefas ou ações de aquecimento.
- Contar chips e aparelhos utilizados por identificador único e somente quando houver ao menos uma `account` associada.
- Um chip com problema tem ao menos um `incident`; perda definitiva exige incidente `ban` com resultado `perdida`.
- Manter as origens de chip e aparelho independentes, inclusive em combinações mistas.
- Gerar quatro CSVs sem nova dependência: UTF-8 com BOM, `;`, CRLF, datas no padrão brasileiro e fuso `America/Sao_Paulo`.
- Neutralizar CSV injection quando o primeiro caractere significativo de um texto for `=`, `+`, `-` ou `@`.
- Arquivos detalhados vazios contêm cabeçalho; falhas não podem devolver arquivos parciais.
- Antes de escrever código Next.js, ler em `node_modules/next/dist/docs/` os guias instalados de Route Handlers, segmentos dinâmicos e `page`.

## Review Focus

- Um chip reaproveitado em contas/aparelhos diferentes continua sendo um chip no resumo, mas preserva todas as associações em `chips.csv` (Task 1).
- Incidente aberto e ban sem resultado entram nos totais corretos, mas somente `ban` + `perdida` produz perda definitiva (Task 1).
- Texto com espaços antes de um prefixo de fórmula continua neutralizado sem alterar valores numéricos negativos (Task 2).
- Horário UTC perto da virada do dia produz nome e datas conforme `America/Sao_Paulo` (Task 3).
- Tipo de arquivo inválido não consulta o banco, e falha do banco devolve 500 sem corpo CSV nem detalhes internos (Task 4).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `lib/relatorio.ts` | Tipos de entrada/saída e agregação pura das métricas e relações. |
| `lib/relatorio.test.ts` | Regras gerenciais, deduplicação, origem, incidentes e vazio. |
| `lib/csv.ts` | Serializador CSV genérico, seguro e sem conhecimento do relatório. |
| `lib/csv.test.ts` | BOM, delimitador, CRLF, escaping e CSV injection. |
| `lib/relatorio-csv.ts` | Colunas, rótulos, datas e nomes dos quatro arquivos. |
| `lib/relatorio-csv.test.ts` | Contrato de cada arquivo e fuso dos nomes. |
| `lib/relatorio-download.ts` | Valida tipo, carrega dados e monta respostas HTTP 200/404/500. |
| `lib/relatorio-download.test.ts` | Respostas, headers, curto-circuito e falha do carregamento. |
| `lib/relatorio-queries.ts` | Consultas Drizzle e orquestração do relatório atual. |
| `app/relatorio/exportar/[arquivo]/route.ts` | Route Handler fino para o download. |
| `app/relatorio/page.tsx` | Painel gerencial e quatro ações de download. |
| `components/app-sidebar.tsx` | Entrada de navegação para o relatório. |
| `package.json` | Inclui os novos testes na suíte padrão. |

### Task 1: Modelo e agregação do relatório

**Files:**
- Create: `lib/relatorio.ts`
- Create: `lib/relatorio.test.ts`

**Interfaces:**
- Consumes: nenhum módulo de produto; somente objetos simples preparados pela futura camada de consulta.
- Produces:

```ts
export type Origem = "propria" | "externa"
export type ContaHistorica = {
  id: number
  ativadaEm: string
  slot: string
  chipId: string
  chipNumero: string
  chipOperadora: string
  chipOrigem: Origem
  chipStatus: "novo" | "em_uso" | "aposentado"
  deviceId: string
  deviceApelido: string | null
  deviceOrigem: Origem
  deviceStatus: "ativo" | "quarentena" | "aposentado"
}
export type IncidenteHistorico = {
  id: number
  accountId: number
  tipo: "restricao" | "ban"
  inicio: Date
  fim: Date | null
  resultado: "pendente" | "recuperada" | "perdida" | null
  notas: string | null
}
export type DadosRelatorio = {
  contas: readonly ContaHistorica[]
  incidentes: readonly IncidenteHistorico[]
}
export type RelatorioCampanha = {
  geradoEm: Date
  resumo: ResumoRelatorio
  chips: readonly ChipRelatorio[]
  incidentes: readonly IncidenteRelatorio[]
  aparelhos: readonly AparelhoRelatorio[]
}
export function gerarRelatorio(
  dados: DadosRelatorio,
  geradoEm?: Date,
): RelatorioCampanha

export type ResumoRelatorio = {
  chipsUtilizados: number
  chipsProprios: number
  chipsExternos: number
  chipsComProblema: number
  chipsComRestricao: number
  chipsComBan: number
  chipsPerdidos: number
  aparelhosUtilizados: number
  aparelhosProprios: number
  aparelhosExternos: number
  incidentes: number
  restricoes: number
  bans: number
}
export type ChipRelatorio = {
  id: string
  numero: string
  operadora: string
  origem: Origem
  status: "novo" | "em_uso" | "aposentado"
  primeiraAtivacao: string
  aparelhos: readonly string[]
  contas: number
  incidentes: number
  restricoes: number
  bans: number
  perdido: boolean
}
export type IncidenteRelatorio = IncidenteHistorico & {
  chipId: string
  chipNumero: string
  chipOrigem: Origem
  deviceId: string
  deviceApelido: string | null
  deviceOrigem: Origem
  slot: string
}
export type AparelhoRelatorio = {
  id: string
  apelido: string | null
  origem: Origem
  status: "ativo" | "quarentena" | "aposentado"
  chips: number
  contas: number
  incidentes: number
  restricoes: number
  bans: number
  chipsPerdidos: number
}
```

- [ ] **Step 1: Instalar as dependências travadas do projeto**

Run: `npm ci`

Expected: `node_modules/next/dist/docs/` existe e nenhuma alteração em `package-lock.json`.

- [ ] **Step 2: Ler a documentação Next.js instalada exigida pelo repositório**

Run: `rg --files node_modules/next/dist/docs | rg 'route|dynamic|page'`

Leia integralmente os guias correspondentes a Route Handlers, segmentos dinâmicos e `page`. Registre no progresso do plano os caminhos encontrados; as assinaturas das Tasks 4 e 5 devem seguir essa versão, não conhecimento prévio.

- [ ] **Step 3: Escrever os testes inicialmente falhos da agregação**

Em `lib/relatorio.test.ts`, crie uma fixture com duas contas para o chip próprio `c1` em aparelhos diferentes, uma conta para o chip externo `c2`, uma restrição recuperada em `c1`, um ban perdido em `c1` e um ban aberto/sem resultado em `c2`. Fixe `geradoEm`.

```ts
test("deduplica recursos e distingue chips afetados de ocorrencias", () => {
  assert.deepEqual(relatorio.resumo, {
    chipsUtilizados: 2,
    chipsProprios: 1,
    chipsExternos: 1,
    chipsComProblema: 2,
    chipsComRestricao: 1,
    chipsComBan: 2,
    chipsPerdidos: 1,
    aparelhosUtilizados: 2,
    aparelhosProprios: 1,
    aparelhosExternos: 1,
    incidentes: 3,
    restricoes: 1,
    bans: 2,
  })
})

test("agrega associacoes e incidentes por chip e aparelho", () => {
  assert.deepEqual(chipC1.aparelhos, ["d1", "d2"])
  assert.equal(chipC1.contas, 2)
  assert.equal(chipC1.incidentes, 2)
  assert.equal(chipC1.perdido, true)
  assert.equal(aparelhoD1.chips, 2)
  assert.equal(aparelhoD1.chipsPerdidos, 1)
})

test("mantem contexto e estado de incidente aberto", () => {
  assert.equal(banAberto.fim, null)
  assert.equal(banAberto.resultado, null)
  assert.equal(banAberto.chipId, "c2")
  assert.equal(banAberto.deviceId, "d1")
})

test("gera relatorio vazio com zeros e listas vazias", () => {
  assert.equal(relatorio.resumo.chipsUtilizados, 0)
  assert.equal(relatorio.resumo.aparelhosUtilizados, 0)
  assert.deepEqual(relatorio.chips, [])
  assert.deepEqual(relatorio.incidentes, [])
  assert.deepEqual(relatorio.aparelhos, [])
})
```

Inclua asserções de ordenação: chips e aparelhos por ID; incidentes por `inicio` e depois `id`; primeira ativação pelo menor `ativadaEm`; listas de aparelhos sem repetição e ordenadas.

- [ ] **Step 4: Rodar o teste para confirmar a falha**

Run: `node --test lib/relatorio.test.ts`

Expected: FAIL porque `./relatorio.ts` ou `gerarRelatorio` ainda não existe.

- [ ] **Step 5: Implementar a agregação mínima em `lib/relatorio.ts`**

Use mapas por `accountId`, `chipId` e `deviceId` e `Set` para associações/contagens distintas. Resolva cada incidente por sua conta; se a conta estiver ausente, lance erro em vez de produzir um relatório silenciosamente incompleto. Preserve `geradoEm` por cópia (`new Date(geradoEm)`).

- [ ] **Step 6: Rodar o teste até passar**

Run: `node --test lib/relatorio.test.ts`

Expected: PASS em todos os casos.

- [ ] **Step 7: Commit**

```bash
git add lib/relatorio.ts lib/relatorio.test.ts
git commit -m "feat: agregar dados do relatorio da campanha"
```

### Task 2: Serializador CSV seguro

**Files:**
- Create: `lib/csv.ts`
- Create: `lib/csv.test.ts`

**Interfaces:**
- Consumes: matrizes sem conhecimento das entidades do relatório.
- Produces:

```ts
export type ValorCsv = string | number | null
export function serializarCsv(
  cabecalho: readonly string[],
  linhas: readonly (readonly ValorCsv[])[],
): string
```

- [ ] **Step 1: Escrever os testes inicialmente falhos do formato e da proteção**

```ts
test("gera UTF-8 com BOM, ponto e virgula e CRLF", () => {
  const csv = serializarCsv(["nome", "valor"], [["item", 2]])
  assert.equal(csv, "\uFEFFnome;valor\r\nitem;2\r\n")
})

test("escapa separador, aspas e quebras de linha", () => {
  const csv = serializarCsv(["texto"], [['a; "b"\nlinha']])
  assert.ok(csv.includes('"a; ""b""\nlinha"'))
})

test("neutraliza prefixos de formula inclusive apos espacos", () => {
  const csv = serializarCsv(["valor"], [["=1+1"], ["  @cmd"], ["-12"], [-12]])
  assert.ok(csv.includes("'=1+1"))
  assert.ok(csv.includes("'  @cmd"))
  assert.ok(csv.includes("'-12"))
  assert.ok(csv.includes("\r\n-12\r\n"))
})

test("representa null como campo vazio e rejeita linha de tamanho incorreto", () => {
  assert.equal(serializarCsv(["a"], [[null]]), "\uFEFFa\r\n\r\n")
  assert.throws(() => serializarCsv(["a"], [["x", "y"]]))
})
```

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `node --test lib/csv.test.ts`

Expected: FAIL porque `./csv.ts` ainda não existe.

- [ ] **Step 3: Implementar `serializarCsv`**

Neutralize apenas valores do tipo `string`, antes do escaping estrutural. Considere o primeiro caractere após whitespace para detectar fórmulas, mas prefixe o apóstrofo ao valor original. Sempre acrescente CRLF após a última linha e valide a largura de todas as linhas.

- [ ] **Step 4: Rodar o teste até passar**

Run: `node --test lib/csv.test.ts`

Expected: PASS em todos os casos.

- [ ] **Step 5: Commit**

```bash
git add lib/csv.ts lib/csv.test.ts
git commit -m "feat: adicionar serializador csv seguro"
```

### Task 3: Composição dos quatro arquivos

**Files:**
- Create: `lib/relatorio-csv.ts`
- Create: `lib/relatorio-csv.test.ts`

**Interfaces:**
- Consumes: `RelatorioCampanha` da Task 1 e `serializarCsv` da Task 2.
- Produces:

```ts
export const TIPOS_ARQUIVO_RELATORIO = [
  "resumo",
  "chips",
  "incidentes",
  "aparelhos",
] as const
export type TipoArquivoRelatorio = (typeof TIPOS_ARQUIVO_RELATORIO)[number]
export function identificarTipoArquivo(valor: string): TipoArquivoRelatorio | null
export function nomeArquivoRelatorio(
  tipo: TipoArquivoRelatorio,
  geradoEm: Date,
): string
export function csvDoRelatorio(
  tipo: TipoArquivoRelatorio,
  relatorio: RelatorioCampanha,
): string
```

- [ ] **Step 1: Escrever testes inicialmente falhos para os contratos dos arquivos**

Reutilize uma fixture gerada por `gerarRelatorio` e fixe `geradoEm`.

```ts
test("aceita apenas os quatro tipos de arquivo", () => {
  assert.equal(identificarTipoArquivo("chips"), "chips")
  assert.equal(identificarTipoArquivo("segredos"), null)
})

test("nome usa o dia em America Sao_Paulo", () => {
  const instante = new Date("2026-09-29T02:30:00.000Z")
  assert.equal(nomeArquivoRelatorio("resumo", instante), "resumo-campanha-2026-09-28.csv")
})

test("resumo expoe todos os indicadores e horario de geracao", () => {
  assert.ok(csv.includes("indicador;valor"))
  assert.ok(csv.includes("Chips utilizados;2"))
  assert.ok(csv.includes("Chips perdidos definitivamente;1"))
})

test("detalhes usam colunas estaveis e rotulos para ausencias", () => {
  assert.ok(chips.startsWith("\uFEFFidentificador;numero;operadora;origem;"))
  assert.ok(incidentes.includes("em aberto"))
  assert.ok(incidentes.includes("pendente"))
  assert.ok(aparelhos.startsWith("\uFEFFidentificador;apelido;origem;"))
})

test("relatorio vazio mantem cabecalhos dos detalhes", () => {
  assert.equal(csvDoRelatorio("chips", vazio).split("\r\n").length, 2)
})
```

No último teste, as duas partes são o cabeçalho e o segmento vazio posterior ao CRLF final; não aceite linha de dados.

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `node --test lib/relatorio-csv.test.ts`

Expected: FAIL porque `./relatorio-csv.ts` ainda não existe.

- [ ] **Step 3: Implementar tipos, nomes, formatação e mapeamento de colunas**

Use `Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ... })` para data/hora e `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(...)` para montar `AAAA-MM-DD` sem depender da ordem textual do locale. Use `Sim`/`Não`, `Própria`/`Externa`, `em aberto` e `pendente` nas células destinadas ao gestor.

- [ ] **Step 4: Rodar todos os testes puros até passar**

Run: `node --test lib/relatorio.test.ts lib/csv.test.ts lib/relatorio-csv.test.ts`

Expected: PASS em todos os casos.

- [ ] **Step 5: Commit**

```bash
git add lib/relatorio-csv.ts lib/relatorio-csv.test.ts
git commit -m "feat: montar arquivos do relatorio da campanha"
```

### Task 4: Consultas e download HTTP

**Files:**
- Create: `lib/relatorio-download.ts`
- Create: `lib/relatorio-download.test.ts`
- Create: `lib/relatorio-queries.ts`
- Create: `app/relatorio/exportar/[arquivo]/route.ts`

**Interfaces:**
- Consumes: `DadosRelatorio`, `RelatorioCampanha` e `gerarRelatorio` da Task 1; `identificarTipoArquivo`, `nomeArquivoRelatorio` e `csvDoRelatorio` da Task 3; tabelas `account`, `chip`, `device` e `incident` de `lib/schema.ts`.
- Produces:

```ts
// lib/relatorio-queries.ts
export async function buscarDadosRelatorio(): Promise<DadosRelatorio>
export async function carregarRelatorio(geradoEm?: Date): Promise<RelatorioCampanha>

// lib/relatorio-download.ts
export type CarregarRelatorio = () => Promise<RelatorioCampanha>
export async function responderDownloadRelatorio(
  arquivo: string,
  carregar: CarregarRelatorio,
): Promise<Response>
```

- [ ] **Step 1: Escrever testes inicialmente falhos da resposta de download**

```ts
test("tipo invalido devolve 404 sem chamar o carregador", async () => {
  let chamadas = 0
  const resposta = await responderDownloadRelatorio("invalido", async () => {
    chamadas++
    return relatorio
  })
  assert.equal(resposta.status, 404)
  assert.equal(chamadas, 0)
})

test("sucesso devolve csv completo e headers de download", async () => {
  const resposta = await responderDownloadRelatorio("resumo", async () => relatorio)
  assert.equal(resposta.status, 200)
  assert.equal(resposta.headers.get("content-type"), "text/csv; charset=utf-8")
  assert.match(resposta.headers.get("content-disposition")!, /attachment; filename="resumo-campanha-2026-09-28.csv"/)
  assert.ok((await resposta.text()).startsWith("\uFEFF"))
})

test("falha do carregador devolve 500 sem csv nem detalhe interno", async () => {
  const resposta = await responderDownloadRelatorio("chips", async () => {
    throw new Error("senha-interna")
  })
  assert.equal(resposta.status, 500)
  assert.equal(resposta.headers.get("content-type"), "text/plain; charset=utf-8")
  assert.doesNotMatch(await resposta.text(), /senha-interna|identificador;/)
})
```

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `node --test lib/relatorio-download.test.ts`

Expected: FAIL porque `./relatorio-download.ts` ainda não existe.

- [ ] **Step 3: Implementar `responderDownloadRelatorio`**

Valide `arquivo` antes de chamar `carregar`. Em sucesso, gere todo o corpo antes de construir `Response`, use os headers testados e `Cache-Control: no-store`. Em erro, registre a exceção no servidor com `console.error` e devolva apenas `Não foi possível gerar o relatório.`.

- [ ] **Step 4: Rodar o teste de download até passar**

Run: `node --test lib/relatorio-download.test.ts`

Expected: PASS nos casos 200, 404 e 500.

- [ ] **Step 5: Implementar `buscarDadosRelatorio` e `carregarRelatorio`**

Em `buscarDadosRelatorio`, faça duas consultas em `Promise.all`:

1. todas as `account`, com `innerJoin` em `chip` e `device`, selecionando os campos exatos de `ContaHistorica`, ordenadas por `account.id`;
2. todos os `incident`, selecionando os campos exatos de `IncidenteHistorico`, ordenados por `incident.inicio` e `incident.id`.

Não importe `warmupAction` nem `warmupTask`. `carregarRelatorio(geradoEm = new Date())` chama `gerarRelatorio(await buscarDadosRelatorio(), geradoEm)`.

- [ ] **Step 6: Implementar o Route Handler conforme os guias instalados do Next.js 16**

Exporte apenas `dynamic = "force-dynamic"` e `GET`. Resolva `params.arquivo` usando a assinatura documentada nesta versão e delegue para `responderDownloadRelatorio(arquivo, () => carregarRelatorio())`; não replique validação nem tratamento de erro na rota.

- [ ] **Step 7: Verificar testes e tipos**

Run: `node --test lib/relatorio.test.ts lib/csv.test.ts lib/relatorio-csv.test.ts lib/relatorio-download.test.ts && npm run typecheck`

Expected: testes PASS e TypeScript sem erros.

- [ ] **Step 8: Commit**

```bash
git add lib/relatorio-download.ts lib/relatorio-download.test.ts lib/relatorio-queries.ts app/relatorio/exportar/'[arquivo]'/route.ts
git commit -m "feat: disponibilizar downloads do relatorio"
```

### Task 5: Painel gerencial, navegação e verificação final

**Files:**
- Create: `app/relatorio/page.tsx`
- Modify: `components/app-sidebar.tsx:3-25`
- Modify: `package.json:16`

**Interfaces:**
- Consumes: `carregarRelatorio()` da Task 4; `PageHeader`, `StatCard` e `Button` existentes; downloads em `/relatorio/exportar/{resumo|chips|incidentes|aparelhos}`.
- Produces: página server-rendered `/relatorio`, item ativo no menu e suíte `npm test` completa.

- [ ] **Step 1: Criar a página de relatório**

Defina `dynamic = "force-dynamic"`, carregue um único `RelatorioCampanha` e monte:

- `PageHeader` com título `Relatório da campanha` e subtítulo que declare `Todo o histórico registrado até agora.`;
- quatro `StatCard`: chips utilizados, chips com problema, chips perdidos e aparelhos utilizados;
- bloco de resumo com próprios/externos para chips e aparelhos e totais de incidentes/restrições/bans;
- quatro cards de exportação com descrição e link nativo para cada endpoint, usando o estilo de `Button` e o atributo `download` apenas como dica (o header HTTP continua autoritativo);
- mensagem clara com data/hora de `geradoEm`, formatada no fuso `America/Sao_Paulo`.

Não criar Client Component: downloads são links GET e o tratamento global de `app/error.tsx` cobre falha no carregamento.

- [ ] **Step 2: Adicionar "Relatório" ao menu lateral**

Importe um ícone de planilha/relatório já presente em `lucide-react` e adicione `{ href: "/relatorio", nome: "Relatório", Icone }` ao grupo `Principal`, depois de `Painel`. Preserve a regra existente de `aria-current`.

- [ ] **Step 3: Incluir os quatro novos arquivos de teste em `npm test`**

Mantenha os testes existentes e acrescente `lib/relatorio.test.ts`, `lib/csv.test.ts`, `lib/relatorio-csv.test.ts` e `lib/relatorio-download.test.ts` ao script `test`.

- [ ] **Step 4: Rodar a verificação automatizada completa**

Run: `npm test && npm run lint && npm run typecheck && npm run build`

Expected: todos os comandos encerram com código 0; o build lista `/relatorio` e `/relatorio/exportar/[arquivo]` sem erro.

- [ ] **Step 5: Fazer a verificação manual com banco disponível**

Run: `npm run dev`

Confirme no navegador:

1. menu abre `/relatorio` e marca o item atual;
2. cartões e resumo batem com uma amostra conhecida do banco;
3. os quatro botões baixam arquivos com os nomes esperados;
4. cada CSV abre no Excel/LibreOffice com colunas separadas, acentos preservados e sem linhas de aparelhos/chips nunca usados;
5. um download com `/relatorio/exportar/invalido` responde 404.

- [ ] **Step 6: Commit**

```bash
git add app/relatorio/page.tsx components/app-sidebar.tsx package.json
git commit -m "feat: adicionar painel gerencial da campanha"
```

- [ ] **Step 7: Registrar evidências finais**

Run: `git status --short && git log -8 --oneline`

Expected: worktree limpo; cinco commits da implementação visíveis, além dos commits de design/plano.
