# Correção: conta inexistente em `definirInstancia`

## Alteração

- Rejeita `accountId` ausente, zero, negativo, fracionário ou não numérico como `Conta inválida.`.
- Usa `UPDATE ... RETURNING id` e devolve o mesmo erro conhecido quando nenhuma conta é atualizada.
- Mantém a sincronização posterior como best effort quando a escrita foi confirmada.

## Regressão

Teste público da Server Action em `lib/evolution-actions.test.ts`, com banco e `next/cache` simulados. O teste falhou antes da correção porque o ID ausente retornava `{ ok: true }`; depois passou para ID ausente e ID positivo inexistente. Não acessa banco real.

Comando (offline):

```text
node --experimental-test-module-mocks --import tsx --test lib/evolution-actions.test.ts
```

`tsx` já está instalado transitivamente no lockfile por `drizzle-kit`; nenhuma dependência foi adicionada.

## Verificação

```text
node --experimental-test-module-mocks --import tsx --test lib/evolution-actions.test.ts
tests 1, pass 1, fail 0

npm test
tests 38, pass 38, fail 0

npm run typecheck
exit 0

npm run lint -- --quiet lib/evolution-actions.ts lib/evolution-actions.test.ts
exit 0
```

## Commit

`fix: rejeitar conta inexistente ao definir instância`
