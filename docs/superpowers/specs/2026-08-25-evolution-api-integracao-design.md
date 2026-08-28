# Integração Evolution API — status de conexão e visão geral

Data: 2026-08-25

## Contexto

O sistema hoje não sabe se uma conta WhatsApp (aparelho + chip + slot) está
de fato conectada. Cada conta corresponde a uma instância na Evolution API
self-hosted do usuário, **nomeada com o número do WhatsApp** (`chip.numero`,
não `account.id` — instâncias já existem hoje na Evolution, criadas por
fora do sistema, e o sistema só lê). O objetivo é saber, pra cada conta, se
está conectada, se tem proxy ativo, e permitir reconectar via QR code sem
sair do sistema — além de dar uma visão geral por aparelho e por chip que
hoje não existe (só existe `/aparelho/[id]` e `/chip/[id]` como fichas
individuais, sem lista).

Isto é o sub-projeto 1 de dois. O sub-projeto 2 (redesign visual com
Higgsfield MCP) constrói em cima desta estrutura de dados e páginas, depois.

## Schema

Três colunas novas em `account` (não histórico — estado atual, sobrescrito a
cada verificação manual):

```ts
export const evolutionStatus = pgEnum("evolution_status", [
  "desconhecido",
  "aberta",
  "conectando",
  "fechada",
])
export const proxyStatus = pgEnum("proxy_status", [
  "sem_conexao", // nenhum proxy configurado na instância
  "ativa", // proxy configurado e teste de conectividade real passou
  "inativa", // proxy configurado mas teste de conectividade falhou/deu timeout
])

// em account:
evolutionStatus: evolutionStatus("evolution_status").notNull().default("desconhecido"),
proxyStatus: proxyStatus("proxy_status").notNull().default("sem_conexao"),
statusVerificadoEm: timestamp("status_verificado_em", { withTimezone: true }),
```

Sem tabela nova, sem join extra. `statusVerificadoEm` nulo = nunca verificado.

## Mapeamento conta → instância

> **Corrigido em 2026-08-28.** A premissa abaixo (`nome da instância =
> número normalizado`) estava errada para o servidor real
> (`evo.eliborges.com.br`): as instâncias têm rótulo livre (`39fernanda`,
> `05 - 63998163824`) e o campo `number` da API às vezes diverge do
> `ownerJid`. Não há como derivar o nome do número. Agora a associação é
> explícita: coluna `account.instance_name` (nullable), preenchida pelo
> operador na ficha do aparelho a partir de `GET /instance/fetchInstances`
> (`listarInstancias()`). `instance_name` nulo → sincronização fica em
> "desconhecido". `normalizarNumero` continua existindo só para exibição.

`normalizarNumero(numero: string): string` — remove tudo que não é dígito
(`numero.replace(/\D/g, "")`).

## Cliente Evolution (`lib/evolution.ts`)

Funções puras contra a API, usando `EVOLUTION_API_URL` e `EVOLUTION_API_KEY`
de `.env.local`:

- `buscarStatusConexao(instanceName): Promise<"aberta"|"conectando"|"fechada"|"desconhecido">`
  — GET `/instance/connectionState/{instance}`, mapeia `open`→aberta,
  `connecting`→conectando, `close`→fechada. Erro de rede/instância
  inexistente → `desconhecido`, não lança.
- `buscarProxy(instanceName): Promise<"sem_conexao"|"ativa"|"inativa">` —
  GET `/proxy/find/{instance}`. Sem host → `sem_conexao`; host +
  `enabled:false` → `inativa`; host + ligado → `ativa`.
  **Corrigido em 2026-08-28:** a versão original testava conectividade real
  através do proxy contra a própria `EVOLUTION_API_URL`. O host da Evolution
  recusa IP de datacenter de proxy, então todo proxy funcionando dava
  "inativa". O teste ao vivo (e a dependência `undici`/`ProxyAgent`) foi
  removido — `buscarProxy` só reporta o que a Evolution já sabe.
- `pedirQrCode(instanceName): Promise<string>` — POST `/instance/connect/{instance}`,
  retorna o base64 do QR code.

## Server actions (`lib/evolution-actions.ts`)

- `verificarConexao(accountId: number)` — resolve `chip.numero` da conta
  (join `account`→`chip`), normaliza, chama `buscarStatusConexao` e
  `buscarProxy` em paralelo pro nome de instância resultante, grava as 3
  colunas em `account`, `refresh()`.
- `verificarConexoes(accountIds: number[])` — roda `verificarConexao` para
  cada ID em paralelo (`Promise.all`), um único `refresh()` no final. Base
  do botão "Verificar todas".
- `gerarQrCode(accountId: number)` — resolve `chip.numero` da conta,
  normaliza, chama `pedirQrCode`. Não grava nada no banco (é só exibição
  pro usuário escanear).

## Queries (`lib/queries.ts`)

- `listarAparelhosComResumo()` — todos os devices (qualquer status), com:
  contas ativas nele (slot, número, chipId, evolutionStatus, proxyStatus),
  incidente aberto por conta, total de bans do histórico (reusa a mesma
  lógica de `fichaDoAparelho.totalBans`).
- `listarChipsComResumo()` — todos os chips, com: número, operadora, status,
  local, conta vinculada (se houver, com evolutionStatus/proxyStatus).
- `contadores()` ganha `conectadosNaEvolution` (count de contas ativas com
  `evolutionStatus = 'aberta'`).

## Páginas

**Painel (`/`)** — StatCard novo "Conectados na Evolution". A tabela
"Saudáveis" não muda (fica enxuta; conexão detalhada mora nas páginas
novas).

**`/aparelhos` (lista, nova)** — botão "Verificar todas" no cabeçalho
(chama `verificarConexoes` com os IDs de todas as contas ativas listadas).
Um card ou linha por aparelho: apelido/ID, `StatusBadge` de ciclo de vida
(ativo/quarentena/aposentado), chips/números ativos nele, badge de
restrição/ban se houver incidente aberto, contador de bans totais, e por
conta: badge de conexão Evolution (status + proxy + "verificado há Xmin",
via `tempoDecorrido()` já existente em `lib/tempo.ts`) com botão
"Verificar".

**`/chips` (lista, nova)** — mesmo botão "Verificar todas" no cabeçalho. Um
card ou linha por chip: ID, número, operadora, `StatusBadge` de ciclo
(novo/em_uso/aposentado), local (pasta/gaveta/bandeja), conta vinculada se
houver, badge de conexão Evolution (com "verificado há Xmin") com botão
"Verificar" quando vinculado a uma conta ativa.

**`/aparelho/[id]` e `/chip/[id]` (fichas existentes)** — painel de conexão
por conta: status Evolution, status proxy, "verificado há Xmin". Quando
`evolutionStatus = 'fechada'`, botão **Reconectar** abre um dialog com o QR
code (`gerarQrCode`) e um botão "Já escaneei, verificar" que roda
`verificarConexao` de novo.

Botão "Verificar" (individual ou "todas") fica desabilitado enquanto a
chamada está em andamento — evita clique duplo disparando chamadas
concorrentes pra mesma conta.

## Navegação

`AppSidebar` ganha duas entradas novas: "Aparelhos" e "Chips", apontando pra
`/aparelhos` e `/chips`.

## Erros e limites

- Evolution API offline ou instância não existente: `evolutionStatus` vira
  `desconhecido`, nunca lança exceção que quebre a página.
- Verificação é manual (botão), sem polling automático nem webhook — sem
  cron, sem endpoint público novo.
- Teste de proxy é uma chamada de rede real por verificação (não é grátis);
  aceito porque a verificação é sob demanda, não em loop.

## Fora de escopo (sub-projeto 2)

Estilo visual, paleta, imagens geradas via Higgsfield MCP, mockups — tudo
isso é redesign por cima desta estrutura de dados e páginas, tratado depois
como projeto separado.
