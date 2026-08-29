# Múltiplas Evolutions — Design

## Problema

O sistema fala com **uma** Evolution API, fixa em `EVOLUTION_API_URL` /
`EVOLUTION_API_KEY` no `.env.local`. Na prática há mais de um servidor
Evolution (`evo.eliborges.com.br`, `evolideres.eliborges.com.br`, ...), e
cada instância de WhatsApp vive em exatamente um deles. Hoje é impossível
sincronizar contas espalhadas em servidores diferentes.

## Objetivo

Cadastrar N servidores Evolution numa tela, associar cada conta a
`(servidor, instância)`, e fazer toda chamada à Evolution usar o servidor
da conta. "Verificar todas" e os dropdowns de instância consultam todos os
servidores ativos e juntam o resultado.

## Decisões (do brainstorming)

- Servidores num **tabela no banco + tela CRUD**, não env vars.
- Uma conta vive em **exatamente um** servidor.
- `listarInstancias` **junta** todos os servidores ativos; cada instância
  carrega o `serverId` de origem.
- `.env` `EVOLUTION_API_URL`/`KEY` **deixam de ser lidos**. Tabela nasce
  vazia; o operador cadastra os servidores.
- API key **mascarada** na tela (últimos 4 dígitos); edição aceita nova key,
  campo vazio mantém a atual.
- Tela em **item novo na sidebar** (`/servidores`, grupo "Operação").

## Não-objetivos

- Backfill das contas existentes — ficam sem servidor até o operador
  associar pela ficha (mesmo estado de hoje: nenhuma conta em produção tem
  `instance_name`).
- Migrar automaticamente o valor do `.env` pra tabela.
- Criar/deletar instâncias na Evolution (o sistema só lê).
- Balanceamento / failover entre servidores.

---

## 1. Modelo de dados

### Tabela `evolution_server`

| coluna     | tipo         | notas                                    |
|------------|--------------|------------------------------------------|
| id         | serial PK    |                                          |
| nome       | text notNull | rótulo livre: "Evo Principal"            |
| url        | text notNull | normalizada sem `/` final                |
| apiKey     | text notNull | em claro no banco; mascarada só na UI    |
| ativo      | boolean notNull default true | desligar sem apagar      |
| createdAt  | timestamptz notNull defaultNow |                        |

`uniqueIndex` em `url` — não faz sentido cadastrar o mesmo servidor duas
vezes.

### `account` — coluna nova

```
evolutionServerId  integer  references evolution_server(id)   -- nullable
```

Fica ao lado do `instance_name` (já existe, migração `0003`). A conta só
sincroniza quando tem **os dois** preenchidos e o servidor está `ativo`.

`ON DELETE` fica no default (`NO ACTION`): o banco recusa apagar um
servidor com conta apontando pra ele. A action de remover checa antes e dá
mensagem melhor.

### Migração `0004`

```sql
CREATE TABLE "evolution_server" (
  "id" serial PRIMARY KEY NOT NULL,
  "nome" text NOT NULL,
  "url" text NOT NULL,
  "api_key" text NOT NULL,
  "ativo" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "evolution_server_url" ON "evolution_server" ("url");
ALTER TABLE "account" ADD COLUMN "evolution_server_id" integer
  REFERENCES "evolution_server"("id");
```

Gerada por `drizzle-kit generate`; aplicada por `drizzle-kit migrate`.
Sem downtime, sem backfill.

---

## 2. Cliente Evolution (`lib/evolution.ts`)

Hoje as funções leem `process.env` via `baseUrl()`. Passam a receber a
config do servidor por parâmetro. `baseUrl()` é removida.

```ts
export type ServidorEvolution = { url: string; apiKey: string }
export type ServidorComId = ServidorEvolution & { id: number; nome: string }

// era: chamarEvolution(caminho, init?)
async function chamarEvolution<T>(
  servidor: ServidorEvolution,
  caminho: string,
  init?: RequestInit,
): Promise<T | null>

export async function buscarStatusConexao(
  servidor: ServidorEvolution,
  instanceName: string,
): Promise<"aberta" | "conectando" | "fechada" | "desconhecido">

export async function buscarProxy(
  servidor: ServidorEvolution,
  instanceName: string,
): Promise<"sem_conexao" | "ativa" | "inativa">

export async function pedirQrCode(
  servidor: ServidorEvolution,
  instanceName: string,
): Promise<string>

// consulta todos em paralelo, junta, marca origem
export async function listarInstancias(
  servidores: ServidorComId[],
): Promise<InstanciaEvolution[]>

export function acharInstancia(
  numeroChip: string,
  instancias: InstanciaEvolution[],
): { serverId: number; name: string } | null
```

`InstanciaEvolution` ganha `serverId: number`:

```ts
export type InstanciaEvolution = {
  serverId: number
  serverNome: string
  name: string
  numero: string | null
  status: "aberta" | "conectando" | "fechada" | "desconhecido"
  digitos: string[]
}
```

`listarInstancias`:
- `Promise.allSettled` sobre os servidores.
- Servidor que dá erro / não responde → ignorado (log via `console.warn`),
  os outros entram normalmente.
- Cada instância recebe `serverId` e `serverNome` do servidor de origem.
- Ordena por `serverNome`, depois `name`.

`acharInstancia`:
- Match por sufixo de dígitos (mín. 10), contra `number` **e** `ownerJid`,
  igual hoje — mas agora o pool inclui instâncias de vários servidores.
- Devolve `{serverId, name}` **só quando exatamente uma** instância casa em
  todo o pool. 2+ (mesmo em servidores diferentes) → `null`.

`chamarEvolution` monta `` `${servidor.url}${caminho}` `` e manda
`apikey: servidor.apiKey` no header. Continua engolindo erro → `null`.

---

## 3. Associação conta → servidor + instância (`lib/evolution-actions.ts`)

```ts
// era: instanceNameDaConta(id): Promise<string | null>
async function contextoDaConta(accountId: number): Promise<{
  servidor: ServidorEvolution
  instanceName: string
} | null>
```

Join `account → evolution_server`. Devolve `null` se faltar
`evolutionServerId` **ou** `instance_name`, ou se o servidor tiver
`ativo = false`.

`verificarSemRefresh(accountId)`:
- `contextoDaConta` → `null` ⇒ grava `evolutionStatus: "desconhecido"`,
  `proxyStatus: "sem_conexao"`, `statusVerificadoEm: now()`. Retorna.
- Senão: `Promise.all([buscarStatusConexao(servidor, nome),
  buscarProxy(servidor, nome)])`, grava.

`definirInstancia(formData)`:
- Lê `accountId` e `instancia` (valor único `"<serverId>::<name>"`).
- Vazio ⇒ `evolutionServerId: null, instanceName: null`.
- Senão split no **primeiro** `::` → `serverId` (número) + `name` (resto).
  Valida que `serverId` existe. Grava os dois.
- `verificarSemRefresh(accountId)` na sequência, depois `refresh()`.

`verificarConexoes(accountIds)` — auto-associar:
- Carrega servidores `ativo` (`ServidorComId[]`).
- `contasSemInstancia` = do lote, com `instance_name` nulo, + `chip.numero`.
- Se houver: `listarInstancias(servidoresAtivos)` uma vez.
- Pra cada conta: `acharInstancia(numero, instancias)` → match único ⇒
  `UPDATE account SET evolution_server_id = ?, instance_name = ?`.
- Segue o loop de `verificarSemRefresh` em lotes de 8 (inalterado).

`gerarQrCode(accountId)`:
- `contextoDaConta` → `null` ⇒ `throw` "Associe esta conta a um servidor e
  uma instância primeiro."
- Senão `pedirQrCode(servidor, instanceName)`.

---

## 4. Tela de servidores (`/servidores`)

### Sidebar

Novo item no grupo "Operação" de `components/app-sidebar.tsx`:
`{ href: "/servidores", nome: "Servidores", Icone: Server }` (lucide `Server`).

### Página `app/servidores/page.tsx` (server component, `force-dynamic`)

- Lista `listarServidoresEvolution()` — cada linha: nome, url, key
  mascarada (`••••` + últimos 4), badge ativo/inativo, nº de contas
  vinculadas.
- Ações por linha: editar (form inline), ligar/desligar, remover.
- Form "Adicionar servidor" no topo/rodapé.

### Query `lib/queries.ts`

```ts
export type ServidorNaLista = {
  id: number
  nome: string
  url: string
  apiKeyMascara: string   // "••••1a2b"
  ativo: boolean
  contasVinculadas: number
}
export async function listarServidoresEvolution(): Promise<ServidorNaLista[]>

// sem máscara — uso interno das actions/sync
export async function servidoresEvolutionAtivos(): Promise<ServidorComId[]>
```

`apiKeyMascara`: `"••••" + apiKey.slice(-4)` (ou só `"••••"` se < 4).
`contasVinculadas`: `count(account)` group by `evolutionServerId`.

### Actions `lib/actions.ts` (padrão `EstadoDoForm` + `comMensagem`)

```ts
criarServidorEvolution(estado, formData)   // nome, url, apiKey  (todos obrigatórios)
editarServidorEvolution(estado, formData)  // serverId, nome, url, apiKey?
alternarServidorEvolution(formData)        // serverId  -> NOT ativo
removerServidorEvolution(estado, formData) // serverId
```

- `url` normalizada: `.trim().replace(/\/$/, "")`. Valida que começa com
  `http://` ou `https://` (senão `ErroDeValidacao`).
- `editarServidorEvolution`: `apiKey` só entra no `.set()` se
  `textoOpcional` devolver não-nulo. Nome/url sempre.
- `removerServidorEvolution`: `SELECT count(*) FROM account WHERE
  evolution_server_id = ?`. `> 0` ⇒ `ErroDeValidacao("N conta(s) usam este
  servidor. Desative em vez de remover.")`. Senão `DELETE`.
- Nova mensagem em `MENSAGEM_DA_CONSTRAINT`:
  `evolution_server_url: "Já existe um servidor com essa URL."`

### Componente `components/servidor-form.tsx` (client, `FormAcao`)

`CriarServidor` e `EditarServidor({ servidor })`. Campos: nome, url, apiKey
(`type="password"`, placeholder "deixe vazio para manter" no editar).
`AlternarServidor` e `RemoverServidor` são `<form action={...}>` simples com
`<input hidden name="serverId">`.

---

## 5. Telas afetadas

### `/cadastro` — "Ativar conta"

- `const servidores = await servidoresEvolutionAtivos()`
- `const instancias = await listarInstancias(servidores)`
- Dropdown `name="instancia"`, agrupado por servidor com `<optgroup label={serverNome}>`.
  Cada `<option value={`${i.serverId}::${i.name}`}>{i.name} — {i.numero} ({i.status})</option>`.
- Opção vazia `"— associar depois —"`.
- Se `servidores.length === 0` ⇒ aviso "Cadastre um servidor Evolution em
  /servidores primeiro."
- `criarChip`/`criarAparelho` inalterados. `ativarConta` passa a gravar
  `evolutionServerId` + `instanceName` a partir do valor `"id::name"`.

### `/aparelho/[id]` — `DefinirInstancia`

- `const servidores = await servidoresEvolutionAtivos()`
- `const instancias = await listarInstancias(servidores)`
- `DefinirInstancia` recebe `instanciaAtual: { serverId: number; name: string } | null`
  e `instancias`. `defaultValue` = `"<serverId>::<name>"` ou `""`.
- Mesma lógica de "instância não está mais no servidor" — se o par
  `(serverId, name)` salvo não está na lista, mantém a option visível
  marcada `(não encontrada no servidor)`.
- `<optgroup>` por servidor.

### `fichaDoAparelho` / `fichaDoChip` (`lib/queries.ts`)

- Join opcional `account → evolution_server` pra trazer
  `evolutionServerId`, `evolutionServerNome`, `instanceName`.
- `FichaAparelho.contas[]` ganha `evolutionServerId: number | null` e
  `evolutionServerNome: string | null` (além de `instanceName` que já tem).
- Exibição na ficha: `"Evolideres · 39fernanda"` ou `"sem instância"`.

### Sem mudança

`components/conexao-badge.tsx`, `verificar-conexao.tsx`,
`verificar-todas.tsx` — recebem status/ids prontos, não sabem de servidor.

---

## 6. Testes

Arquivo `lib/evolution.test.ts` (mock de `fetch` global por pathname, já
existe a infra):

- `acharInstancia`: match único cross-servidor devolve `{serverId, name}`
  do servidor certo.
- `acharInstancia`: mesmo `name` (ou números que casam) em dois servidores
  ⇒ `null`.
- `acharInstancia`: número curto demais ⇒ `null` (mantido).
- `listarInstancias`: dois servidores mockados, junta as instâncias, cada
  uma com `serverId`/`serverNome` certo.
- `listarInstancias`: um servidor responde erro (500 / throw) ⇒ ignorado,
  o outro entra.
- Parser `"<serverId>::<name>"`: split no primeiro `::`; `name` pode conter
  `::`; valor sem `::` ⇒ tratado como vazio/ inválido.

`lib/actions` (sem framework de teste pra DB — cobertura por build +
inspeção): `removerServidorEvolution` recusa com conta vinculada;
`editarServidorEvolution` mantém key quando campo vazio.

Verificação final: `npm test`, `npx tsc --noEmit`, `npm run lint`,
`npx next build`, e smoke test ao vivo de `listarInstancias` contra os dois
servidores reais.

---

## Arquivos

| Arquivo | Mudança |
|---|---|
| `lib/schema.ts` | + tabela `evolutionServer`, + `account.evolutionServerId` |
| `drizzle/0004_*.sql` + snapshot | migração (gerada) |
| `lib/evolution.ts` | funções recebem `servidor`; `listarInstancias(servidores[])`; `acharInstancia` → `{serverId,name}`; remove `baseUrl` |
| `lib/evolution.test.ts` | casos multi-servidor |
| `lib/evolution-actions.ts` | `contextoDaConta`; `verificarSemRefresh`/`definirInstancia`/`verificarConexoes`/`gerarQrCode` por servidor |
| `lib/queries.ts` | `listarServidoresEvolution`, `servidoresEvolutionAtivos`; fichas com servidor |
| `lib/actions.ts` | 4 actions de servidor; `ativarConta` grava servidor+instância; mensagem de constraint |
| `app/servidores/page.tsx` | nova tela |
| `components/servidor-form.tsx` | forms de servidor |
| `components/app-sidebar.tsx` | item "Servidores" |
| `app/cadastro/page.tsx` | dropdown multi-servidor |
| `app/aparelho/[id]/page.tsx` + `components/aparelho-form.tsx` | `DefinirInstancia` multi-servidor |
