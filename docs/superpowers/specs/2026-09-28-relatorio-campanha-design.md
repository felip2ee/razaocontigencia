# Relatório gerencial da campanha — design

## Objetivo

Entregar ao gestor um retrato operacional e patrimonial de todo o histórico
registrado no sistema. O relatório deve responder quantos chips e aparelhos
foram efetivamente usados, quais eram próprios ou externos, quais chips tiveram
problemas e quais foram perdidos definitivamente.

O relatório não representa uma nova entidade de campanha. Para este produto,
"campanha" significa todo o histórico presente no banco até o instante da
consulta ou do download. Não haverá filtro por datas nesta entrega.

## Escopo

Incluído:

- painel gerencial em `/relatorio`;
- resumo na tela com os principais indicadores;
- exportação de quatro arquivos CSV compatíveis com Excel;
- inventário apenas de chips e aparelhos que tiveram ao menos uma conta
  associada;
- distinção independente entre origem própria e externa de chips e aparelhos;
- histórico completo de restrições e bans, inclusive incidentes ainda abertos.

Fora do escopo:

- tarefas ou ações de aquecimento;
- cadastro e comparação de campanhas;
- filtro por período;
- PDF, XLSX, gráficos e envio automático;
- aparelhos ou chips cadastrados que nunca tiveram uma conta associada.

## Definições dos indicadores

Todas as contagens de recursos usam identificadores únicos, e não a quantidade
de contas ou de ocorrências.

- **Chip utilizado:** chip referenciado por ao menos um registro em `account`.
- **Aparelho utilizado:** aparelho referenciado por ao menos um registro em
  `account`.
- **Chip com problema:** chip que, por meio de qualquer uma de suas contas,
  possui ao menos um registro em `incident`, seja restrição ou ban.
- **Chip com restrição:** chip com ao menos um incidente de tipo `restricao`.
- **Chip com ban:** chip com ao menos um incidente de tipo `ban`.
- **Chip perdido definitivamente:** chip com ao menos um ban cujo resultado seja
  `perdida`.
- **Incidente:** cada linha de `incident`. Os totais de incidentes, restrições e
  bans contam ocorrências, enquanto os indicadores de chips contam chips
  distintos.
- **Origem:** lida diretamente do recurso. A origem do chip e a origem do
  aparelho permanecem colunas separadas; combinações mistas não são achatadas
  em uma única classificação.

Um incidente aberto entra nas contagens de problema, restrição ou ban. Somente
um ban com resultado `perdida` entra na contagem de perda definitiva.

## Arquitetura

A solução será dividida em três responsabilidades:

1. Uma camada de consulta carrega contas com seus chips e aparelhos e carrega
   incidentes com o mesmo contexto. Consultas separadas evitam a multiplicação
   acidental de linhas causada por joins de relações com cardinalidades
   diferentes.
2. Uma camada de domínio agrega os registros em `Set` e mapas por identificador,
   calcula os indicadores e monta as relações detalhadas. Essa camada recebe
   dados simples e não depende de React nem de objetos de resposta HTTP.
3. Uma camada de apresentação usa o mesmo resultado agregado tanto no painel
   quanto nas rotas de download. Um serializador CSV isolado cuida da codificação
   e da segurança dos campos.

Arquivos previstos:

- `lib/relatorio.ts`: tipos, definições e agregação pura;
- `lib/relatorio-queries.ts`: leitura do banco e montagem do relatório;
- `lib/csv.ts`: serialização genérica e segura;
- `app/relatorio/page.tsx`: painel e links de download;
- `app/relatorio/exportar/[arquivo]/route.ts`: entrega de um dos quatro CSVs;
- `components/app-sidebar.tsx`: entrada "Relatório" no menu;
- testes unitários das regras e do serializador.

Antes da implementação, a documentação instalada do Next.js 16 sobre Route
Handlers e parâmetros de segmentos dinâmicos deve ser lida, conforme a orientação
do repositório. O diretório `node_modules` não estava instalado durante a redação
deste design.

## Interface e fluxo

A navegação lateral ganhará o item "Relatório". A página terá:

- cabeçalho "Relatório da campanha" e texto informando que os números abrangem
  todo o histórico;
- cartões para chips utilizados, chips com problema, chips perdidos e aparelhos
  utilizados;
- um resumo complementar das divisões próprio/externo e dos totais de
  incidentes;
- quatro ações de download, cada uma acompanhada de uma descrição curta.

Cada clique faz uma requisição GET ao servidor. O servidor consulta o estado
atual do banco, agrega os dados, gera o CSV em memória e responde com
`Content-Disposition: attachment`. Nenhum arquivo temporário é gravado.

Os nomes seguem `<tipo>-campanha-AAAA-MM-DD.csv`, com data calculada no fuso
`America/Sao_Paulo`:

- `resumo-campanha-AAAA-MM-DD.csv`;
- `chips-campanha-AAAA-MM-DD.csv`;
- `incidentes-campanha-AAAA-MM-DD.csv`;
- `aparelhos-campanha-AAAA-MM-DD.csv`.

## Conteúdo dos arquivos

### `resumo.csv`

Duas colunas, `indicador` e `valor`, com:

- data e hora da geração;
- chips utilizados, próprios e externos;
- chips com problema, com restrição, com ban e perdidos definitivamente;
- aparelhos utilizados, próprios e externos;
- total de incidentes, restrições e bans.

### `chips.csv`

Uma linha por chip utilizado, com:

- identificador, número, operadora, origem e situação atual;
- data da primeira ativação entre suas contas;
- lista determinística e sem repetições dos aparelhos pelos quais passou;
- quantidade de contas associadas;
- quantidades de incidentes, restrições e bans;
- `sim` ou `nao` para perda definitiva.

### `incidentes.csv`

Uma linha por incidente, com:

- identificador, tipo, início, término, resultado e observações;
- identificador da conta;
- identificador, número e origem do chip;
- identificador, apelido e origem do aparelho;
- slot usado pela conta.

Término ausente será apresentado como `em aberto`. Resultado ausente será
apresentado como `pendente`. Observações ausentes ficam vazias.

### `aparelhos.csv`

Uma linha por aparelho utilizado, com:

- identificador, apelido, origem e situação atual;
- quantidade de chips distintos e contas associadas;
- quantidades de incidentes, restrições e bans;
- quantidade de chips distintos perdidos definitivamente.

Listas internas aos campos serão ordenadas para produzir arquivos estáveis.
As linhas detalhadas também terão ordenação definida por identificador ou data,
nunca pela ordem acidental devolvida pelo banco.

## Formato e segurança dos CSVs

Os quatro arquivos usarão:

- UTF-8 com BOM;
- `;` como separador;
- `CRLF` entre linhas;
- cabeçalho na primeira linha;
- aspas duplas em campos que contenham separador, aspas ou quebra de linha;
- duplicação de aspas internas conforme o formato CSV;
- datas e horas no padrão brasileiro e no fuso `America/Sao_Paulo`.

Para impedir CSV injection no Excel, valores textuais cujo primeiro caractere
significativo seja `=`, `+`, `-` ou `@` receberão um apóstrofo como prefixo antes
do escape CSV. Essa proteção vale inclusive para apelidos, observações e demais
textos vindos do banco.

O nome dinâmico da rota aceitará somente `resumo`, `chips`, `incidentes` e
`aparelhos`. Qualquer outro valor devolverá 404.

## Erros

Se qualquer consulta ou transformação falhar, a rota devolverá uma resposta de
erro e não enviará um CSV parcial. A interface permanecerá utilizável para nova
tentativa. Erros de carregamento do painel seguirão o tratamento global já
existente em `app/error.tsx`.

Ausência de dados não é erro. O resumo mostrará zeros e os arquivos detalhados
conterão somente seus cabeçalhos.

## Testes e verificação

Testes unitários usarão registros sintéticos para comprovar:

- deduplicação de um chip com várias contas ou vários incidentes;
- distinção entre quantidade de chips afetados e quantidade de ocorrências;
- classificação independente das origens de chip e aparelho;
- exclusão de recursos sem conta associada;
- inclusão de incidente aberto nas métricas de problema;
- perda definitiva apenas para ban com resultado `perdida`;
- agregações por chip e por aparelho;
- resultado vazio;
- BOM, separador, aspas, quebras de linha e neutralização de fórmulas no CSV.

A verificação final executará testes, lint, typecheck e build. Uma inspeção
manual confirmará a navegação, os indicadores e a abertura dos quatro arquivos
no Excel ou em aplicativo compatível.

## Critérios de aceitação

- O gestor acessa o relatório pelo menu lateral.
- Os indicadores da tela representam todo o histórico e obedecem às definições
  deste documento.
- Aparelhos nunca usados e chips nunca usados não aparecem nem entram nas
  contagens.
- Nenhuma tabela de aquecimento é consultada para compor o relatório.
- Cada um dos quatro downloads produz um CSV válido, seguro e legível no Excel.
- O conteúdo exportado e os números mostrados na tela derivam da mesma regra de
  agregação.
- Falhas não geram arquivos parciais.
