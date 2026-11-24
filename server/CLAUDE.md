# Trilho — server/

Ver `../CLAUDE.md` primeiro (modelo de datas, contrato de auth, contrato da
API de recorrência, infra) — este arquivo é só o que é específico da
implementação do backend.

## Estrutura de pastas

Sempre seguir para qualquer feature nova:

```
src/
  models/       Schemas Mongoose (User, Task, Category)
  controllers/  Lógica de negócio, uma função por endpoint (task, category, auth, goal)
  routes/       Só wiring de Router + asyncHandler, zero lógica (taskRoutes, goalRoutes, ...)
  middleware/   requireAuth (JWT)
  utils/        Funções puras reaproveitáveis (date, slug, recurrence, exampleData,
                backlog, goals) — testadas com node:test (*.test.js)
```

Testes: `npm test` (`node --test`, sem dependência) roda `src/**/*.test.js`.
Regra pura nova (filtro, cálculo) vai pra `utils/` com teste, sem importar
Mongoose — o controller só busca e chama.

## Convenções

- Toda rota async passa por `utils/asyncHandler.js` (Express 4 não captura
  rejeição de Promise sozinho — sem isso, um erro assíncrono trava a
  request).
- **Multi-tenant desde a raiz**: `Task` e `Category` têm `userId`
  obrigatório. `requireAuth` middleware protege `/tasks`, `/categories` e
  `/goals` inteiros e injeta `req.userId`. **Toda query nova precisa filtrar por
  `req.userId`**, e todo `findById`/update/delete precisa ser
  `findOne({ _id, userId: req.userId })` — nunca `findById(id)` sozinho,
  senão um usuário edita/vê dado de outro. Isso é o requisito de segurança
  mais importante do projeto — não afrouxar em nome de "simplificar" código.
- `utils/date.js` só tem helpers UTC (`toDateOnlyString`, `parseDateOnly`,
  `addDays`, `startOfWeek`, `eachDayInRange`) — ver `../CLAUDE.md` pro porquê.

## Recorrência (implementação)

**Não gera documentos**: uma `Task` com `recurrence.enabled` é expandida em
memória por `utils/recurrence.js` (`expandTasks`) toda vez que
`GET /tasks?start=&end=` é chamado, dentro do range pedido.

- O "corte de início" da série usa `startOfWeek(task.date)`, não o dia
  exato — criar uma tarefa "repete seg/qua/sex" numa quinta não deve
  esconder o segunda/quarta daquela mesma semana.
- `recurrence.excludedDates` (ver `../CLAUDE.md` pro contrato de
  scope/occurrenceDate da API) é checado em `expandTasks` pra pular datas
  "destacadas" em ocorrência avulsa. Ao editar a série inteira, sempre
  preservar esse array — nunca sobrescrever `task.recurrence` inteiro sem
  copiar `excludedDates` primeiro.

## Formato de cada tipo de Task: `normalizeTask`

`normalizeTask` em `taskController.js` roda em `createTask`, `updateTask` e
`detachOccurrence`. **Todo caminho novo que cria/salva `Task` precisa passar
por ele.** Funciona em objeto puro (antes do create) e em documento Mongoose
(antes do save). A cadeia, nesta ordem:

1. `normalizeBacklog`: se `date` é vazio → `date: null`, `allDay`, horários
   `null`, nunca meta/ToDo, `goalPeriod: 'week'`, `scheduledFromBacklog:
   false`, recorrência desligada.
2. `normalizeTodo`: se `isTodo` → `allDay`, horários `null`, `isGoal: false`,
   recorrência desligada.
3. `normalizeGoal`: não-meta → `goalPeriod: 'week'`. Meta anual → data em
   1º/jan UTC do ano dela, `allDay`, sem horário, sem recorrência.
4. Vínculos: meta ou recorrente → `scheduledFromBacklog: false`, `goalId:
   null`.

Recorrência desligada sempre por `disableRecurrence`, que preserva
`excludedDates`.

- `updateTask` trata `date: null` explicitamente (volta pras pendências) e liga
  `scheduledFromBacklog` quando a tarefa não tinha data e recebe uma.
  `goalPeriod` e `scheduledFromBacklog` não estão em `assignable`.
- `findYearGoal(userId, goalId)`: `isObjectIdOrHexString` primeiro (id
  malformado nunca chega na query), depois `findOne({ _id, userId, isGoal:
  true, goalPeriod: 'year' })`. `null` → 400 `goalId invalido`, checado antes
  do `resolveCategory` (que pode criar categoria).
- `deleteTask` de meta anual: `updateMany({ userId, goalId }, { goalId: null })`
  antes do `deleteOne`.
- `GET /tasks/backlog` fica registrada antes de qualquer `GET /:id` futuro em
  `taskRoutes`. Regras puras em `utils/backlog.js` (`splitBacklog`) e
  `utils/goals.js` (`withProgress`).

## Autenticação

JWT sem expiração, bcrypt pra senha — detalhes do contrato (payload, fluxo de
slug) estão em `../CLAUDE.md`.
