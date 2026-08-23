# Pendências conhecidas

Achados reais que sobreviveram às revisões da branch `contingencia` e foram
deliberadamente não corrigidos. Nenhum deles impede o uso do sistema. Estão aqui
para não se perderem, e para que quem mexer no código depois não os redescubra do
zero nem os "conserte" sem entender o motivo de estarem abertos.

## Comportamento

**Fuso horário do início de restrição e ban.** O campo `<input type="datetime-local">`
em `components/incident-form.tsx` manda um texto sem sufixo de fuso, e
`registrarIncidente` em `lib/actions.ts` o converte com `new Date(...)`, que interpreta
no fuso do processo Node. Enquanto o sistema roda na máquina do operador, o fuso do Node
é o do operador e o horário grava certo. Se um dia isso for para um servidor com fuso
diferente, todo `inicio` gravado e toda duração derivada saem deslocados — e a duração é
o dado central do sistema. Corrigir exige mandar o offset do browser junto com o
formulário.

Nota: o cálculo de "hoje" usado pelo aquecimento (`hojeISO` em `lib/warmup.ts`) **já foi
corrigido** para data local; era um bug diferente, que valia em qualquer máquina.

**Faixa 4-7 sem folga de sorteio.** A faixa pede 5 ações por dia e o catálogo tem
exatamente 5 elegíveis nessa idade, então toda conta na segunda semana recebe as mesmas 5
ações todo dia — não há sorteio real ali. Acrescentar mais uma ou duas ações de 4+ dias em
`lib/seed.ts` devolve variedade. É decisão de operação, não defeito.

**Recuo pós-restrição ignora ban recuperado.** `contasParaSorteio` em `lib/queries.ts` só
considera `tipo = 'restricao'` ao calcular o recuo de faixa. Uma conta que voltou de um ban
com resultado `recuperada` não recua — e é justamente o caso mais arriscado da frota.
Segue o spec ao pé da letra; vale reconsiderar a regra.

**`moverChip` não impede mover chip em uso.** O spec diz que os chips que geraram contas
ficam arquivados na pasta, mas nada impede mover para gaveta ou bandeja um chip `em_uso`.
Foi julgado escopo correto — o chip físico é ortogonal à conta — mas está registrado caso
a prática mostre o contrário.

**Busca sensível a maiúsculas.** `app/busca/route.ts` compara o ID exatamente. Código de
fita digitado em minúscula cai em "não encontrado".

**`marcarTarefa` grava `feitoEm` também quando a tarefa é pulada**, o que torna o campo
ambíguo se algum dia for usado para medir execução.

**`app/error.tsx` mostra `error.message`**, que o Next redige em build de produção. É a
rede de segurança; o caminho principal das mensagens de constraint passa por `FormAcao` e
não depende disso.

## Corrida remanescente

**Geração do aquecimento sob concorrência real** está protegida por
`pg_advisory_xact_lock` dentro da transação, verificada com três gerações simultâneas. Não
há pendência aqui — o registro fica porque a proteção é sutil e alguém pode removê-la sem
perceber o que ela guarda: a cota diária por faixa, que é a regra pela qual o sistema
existe.

## Interface

**`moverChip` recusa sem mensagem inline.** Quando o destino é bandeja e nenhum aparelho é
escolhido, `moverChip` lança e a recusa sobe para `app/error.tsx`, virando tela de erro
inteira em vez de um aviso ao lado do formulário. O caminho que levava a isso ficou
inalcançável pelo formulário — o select não nasce mais vazio —, então hoje é backstop, não
o que o operador encontra. Fechar de vez exige migrar `moverChip` para o formato
`EstadoDoForm`, como as ações de cadastro já usam.

**Chip na bandeja de aparelho não ativo.** No formulário de mover da ficha do chip, a lista
de aparelhos só traz os `ativo`. Se um chip estiver na bandeja de um aparelho que depois foi
para quarentena ou aposentadoria, a opção "Bandeja de um aparelho" some do select e o destino
cai para "Pasta" sem avisar. Combinação rara e anterior ao redesign.

**O título da página não fica no header.** O spec do redesign pedia título e subtítulo à
esquerda da faixa branca do topo; eles ficaram no corpo, via `PageHeader`. Movê-los exigiria
cada tela publicar o próprio título por um mecanismo global, o que é pior. O efeito é uma
faixa com espaço ocioso à esquerda.

**O shell não colapsa em tela estreita.** Abaixo de cerca de 700px a sidebar fixa de 224px
deixa a coluna de conteúdo apertada. Não há rolagem horizontal até 768px. É ferramenta de
mesa de trabalho, e não foi projetada para telefone.

**Data do relógio com inicial maiúscula.** O spec ilustrava *sábado, 23 de agosto*; a tela
mostra "Domingo, 23 de agosto". É `first-letter:uppercase` em `components/relogio.tsx` —
remover a classe volta para a minúscula.

**`public/nova-digital-wordmark-preto.png`** está no projeto e não é usado por nada. É a
reserva para fundo claro, prevista no spec.

## Qualidade interna

- A consulta de aparelhos ativos aparece inline em `app/cadastro/page.tsx` e
  `app/chip/[id]/page.tsx` em vez de passar por `lib/queries.ts`.
- `fichaDoAparelho` chama `contasComIncidenteAberto()` (frota inteira) para casar no
  máximo três contas.
- `fichaDoChip` seleciona a conta por `chip_id` sem filtro de status nem ordenação.
- Os componentes `dialog`, `tabs` e `select` do shadcn foram instalados e nunca usados —
  as caixas de seleção são `<select>` nativo, de propósito.
- `haQuantoTempo` mostra "0h" na primeira hora de um incidente.
- Sem validação de data futura em `registrarIncidente`; uma data no futuro produz duração
  negativa na tela.

## Cobertura de teste

`lib/warmup.test.ts` tem 17 testes e cobre as regras que importam. Ficaram sem asserção:
catálogo elegível vazio, sorteio com pesos diferentes de 1 (todo o catálogo de teste usa
peso 1), e o limite superior do índice em `escolherPar`.

## Banco de desenvolvimento

O Postgres local carrega os registros criados nas verificações de duas rodadas de trabalho.
Hoje há sete aparelhos, dos quais só `AP001` foi criado como exemplo coerente — os outros
(`1`, `AP-CURL-VERIFY-5`, `AP-FIXCHECK-3`, `AP-T6-NOVO`, `AP002-FIX-CHECK`, `AP999AP999`) são
lixo de verificação, e há chips de teste, um deles repetindo o número de `C001`. Nada disso
foi apagado de propósito: apagar dado é decisão sua.

Limpe antes de começar a usar de verdade:

```bash
docker compose down -v && docker compose up -d && npm run db:migrate && npm run db:seed
```
