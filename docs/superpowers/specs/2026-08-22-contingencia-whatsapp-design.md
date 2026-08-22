# Sistema de contingência de números de WhatsApp — design

Data: 2026-08-22
Status: aprovado para planejamento

## Problema

A gestão de aparelhos, chips e contas de WhatsApp é feita hoje em uma agenda de papel e
com pedaços de fita adesiva colados nos dispositivos e nos chips. Não há histórico de
restrições e bans, não há visão de quais contas estão disponíveis, e o aquecimento de
números novos depende inteiramente da memória do operador.

O sistema substitui a fita e a agenda: um cadastro consultável por ID, um histórico de
incidentes, e um gerador diário de tarefas de aquecimento.

## Escopo

Usuário único, dezenas de aparelhos, execução local. Não há login, multiusuário,
permissões nem log de auditoria — o histórico de incidentes já é o registro que importa.

O aquecimento é executado manualmente no aparelho. O sistema apenas sugere e registra;
não há integração com API de WhatsApp.

## Domínio

Cada aparelho hospeda três contas: dois WhatsApp comuns e um WhatsApp Business. Cada
chip gera exatamente um número, e portanto uma conta.

A localização física do chip é independente das contas do aparelho. Os chips que geraram
contas ficam arquivados em uma pasta organizadora na fazenda de SMS. Um chip separado, de
rede, fica na bandeja do aparelho apenas para dar conexão 4G — não precisa ser o chip de
nenhuma das contas daquele aparelho. Chips de rede sem uso ficam na gaveta.

Quando uma conta sofre restrição, ela espera o prazo passar no mesmo aparelho. Quando
sofre ban, vai para análise; se a análise confirma a perda, o chip é aposentado e um chip
novo ocupa o slot. Aparelhos que acumulam bans entram em quarentena.

## Modelo de dados

Seis tabelas em PostgreSQL.

### device

Aparelho físico. A chave primária é o código já colado nele, digitado à mão.

- `id` texto, PK
- `apelido` texto, opcional
- `status` — `ativo` | `quarentena` | `aposentado`
- `notas` texto, opcional
- `created_at` timestamp

### chip

- `id` texto, PK — código colado no chip
- `operadora` texto
- `numero` texto
- `status` — `novo` | `em_uso` | `aposentado`
- `local` — `pasta` | `gaveta` | `bandeja`
- `posicao` texto, opcional — posição livre na pasta, por exemplo "pasta 2, folha 3"
- `bandeja_device_id` texto, FK para `device`, opcional — preenchido apenas quando
  `local` é `bandeja`
- `created_at` timestamp

### account

Conta de WhatsApp ativa em um slot de um aparelho.

- `id` serial, PK
- `device_id` texto, FK para `device`
- `slot` — `wa1` | `wa2` | `business`
- `chip_id` texto, FK para `chip` — o chip que gerou o número
- `ativada_em` date — origem da idade usada pelo plano de aquecimento
- `status` — `ativa` | `aposentada`
- `created_at` timestamp

Restrições: unique em (`device_id`, `slot`) enquanto `status` for `ativa`; unique em
`chip_id` enquanto `status` for `ativa`.

### incident

Restrição ou ban sofrido por uma conta.

- `id` serial, PK
- `account_id` FK para `account`
- `tipo` — `restricao` | `ban`
- `inicio` timestamp
- `fim` timestamp, opcional — preenchido quando a conta volta; a duração é calculada
  como `fim - inicio`, nunca digitada
- `resultado` — `pendente` | `recuperada` | `perdida`, apenas para bans
- `notas` texto, opcional

### warmup_action

Catálogo de ações de aquecimento, populado por seed.

- `id` serial, PK
- `nome` texto
- `categoria` — `conversa` | `perfil` | `grupo` | `midia`
- `idade_min_dias` inteiro
- `idade_max_dias` inteiro, opcional — nulo significa sem limite superior
- `peso` inteiro — chance relativa no sorteio

### warmup_task

Tarefa sorteada para um dia.

- `id` serial, PK
- `account_id` FK para `account`
- `action_id` FK para `warmup_action`
- `data` date
- `par_account_id` FK para `account`, opcional — a outra conta, nas ações de categoria
  `conversa`
- `status` — `pendente` | `feito` | `pulado`
- `feito_em` timestamp, opcional

### Estado derivado

A conta não guarda campo de restrição ou ban. Uma conta está restrita ou banida se
existe um `incident` seu com `fim` nulo. Há uma única fonte de verdade e nada para
dessincronizar. O campo `status` da conta guarda apenas a decisão manual do operador:
ativa ou aposentada.

Quando um ban recebe resultado `perdida`, a conta passa a `aposentada` e o chip a
`aposentado`, liberando o slot para um chip novo.

## Motor de aquecimento

### Faixas por idade

A idade é a diferença em dias entre hoje e `ativada_em`.

| Idade | Libera | Ações por dia |
|-------|--------|---------------|
| 0-3 | perfil e presença: foto, nome, status, ficar online, ver status | 2 |
| 4-7 | acima, mais conversa individual em texto com a frota | 5 |
| 8-14 | acima, mais áudio, foto, sticker, entrar em um grupo | 8 |
| 15-30 | acima, mais grupo ativo, documento, chamada de voz curta | 12 |
| 30+ | manutenção: sorteio livre do catálogo | 5 |

As faixas são uma constante em `lib/warmup.ts`, editada no arquivo e versionada em git.
Não há tela de administração: usuário único e mudança rara não justificam CRUD.

### Sorteio

Para cada conta ativa sem incidente aberto:

1. Calcula a idade em dias.
2. Filtra o catálogo pelas ações cuja faixa de idade contém a idade da conta.
3. Sorteia N ações com peso, sem repetir a mesma ação no mesmo dia.
4. Para cada ação de categoria `conversa`, sorteia um par: outra conta saudável, em
   aparelho diferente, evitando repetir o mesmo par nos últimos 7 dias.

Contas com incidente aberto não recebem tarefa.

Após o fim de uma restrição, a conta recua uma faixa durante 7 dias antes de voltar à
faixa correspondente à sua idade real.

## Telas

Cinco rotas. Leitura em Server Components, escrita em Server Actions com
`revalidatePath`. Não há API REST nem estado de cliente.

- `/` — painel. Contas saudáveis e contas com incidente aberto, com o tempo decorrido.
  Contadores de aparelhos ativos, contas saudáveis e chips livres na pasta.
- `/aquecimento` — tarefas do dia. Botão para gerar o sorteio de hoje. Lista agrupada por
  aparelho, já que o operador pega um aparelho por vez. Cada linha permite marcar feito ou
  pulado.
- `/aparelho/[id]` — os três slots com suas contas e idades, o chip na bandeja, o
  histórico de incidentes do aparelho e a contagem de bans. O registro de restrição ou ban
  acontece na própria linha da conta.
- `/chip/[id]` — localização, operadora, número, conta gerada, status, e a ação de mover
  de local.
- `/cadastro` — três formulários: aparelho novo, chip novo, ativar conta.

Uma busca no cabeçalho recebe um ID, identifica se é chip ou aparelho e navega para a
página correspondente. É o substituto direto da fita adesiva.

O registro de incidente não tem página própria: é um formulário na linha da conta com
tipo e data de início. O encerramento é um botão que carimba `fim`. Bans ganham um segundo
controle para o resultado da análise.

## Arquitetura

Next.js 16 com App Router, React 19, Tailwind 4 e componentes shadcn sobre Base UI, já
presentes no repositório. Drizzle ORM com node-postgres. PostgreSQL 17 em Docker Compose,
com volume nomeado.

```
docker-compose.yml
drizzle.config.ts
drizzle/                # migrations geradas, versionadas
lib/
  db.ts                 # client
  schema.ts             # as seis tabelas
  queries.ts            # leituras
  actions.ts            # escritas
  warmup.ts             # faixas e sorteio, funções puras
  warmup.test.ts
app/                    # as cinco rotas
components/             # componentes de domínio
```

Componentes shadcn a instalar: table, dialog, input, select, badge, tabs.

### Validação

As regras que importam são constraints no banco, não condicionais em TypeScript: unique
em (`device_id`, `slot`) para contas ativas, unique em `chip_id` para contas ativas,
chaves estrangeiras em todas as relações, e checks nos enums. O banco recusa e a Server
Action exibe a mensagem. Não há Zod: usuário único, formulários curtos, e a constraint já
cobre os casos que causam dano.

### Testes

Apenas `lib/warmup.ts` tem lógica que pode quebrar silenciosamente — a seleção por faixa,
o par em aparelho diferente, a não repetição de ação no dia. Um arquivo `warmup.test.ts`
com `node:test` e asserts cobre isso. O restante é CRUD; testá-lo seria testar o Drizzle.

## Fora de escopo

Autenticação, multiusuário e permissões. Log de auditoria. Integração com API de WhatsApp
ou execução automática de aquecimento. Migração de conta entre aparelhos. Telas de
administração para faixas de aquecimento e catálogo de ações. Exclusão lógica de
registros.
