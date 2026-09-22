# Trilho — server/

Ver `../CLAUDE.md` primeiro (modelo de datas, contrato de auth, contrato da
API de recorrência, infra) — este arquivo é só o que é específico da
implementação do backend.

## Estrutura de pastas

Sempre seguir para qualquer feature nova:

```
src/
  models/       Schemas Mongoose (User, Task, Category)
  controllers/  Lógica de negócio, uma função por endpoint
  routes/       Só wiring de Router + asyncHandler, zero lógica
  middleware/   requireAuth (JWT)
  utils/        Funções puras reaproveitáveis (date, slug, recurrence, exampleData)
```

## Convenções

- Toda rota async passa por `utils/asyncHandler.js` (Express 4 não captura
  rejeição de Promise sozinho — sem isso, um erro assíncrono trava a
  request).
- **Multi-tenant desde a raiz**: `Task` e `Category` têm `userId`
  obrigatório. `requireAuth` middleware protege `/tasks` e `/categories`
  inteiros e injeta `req.userId`. **Toda query nova precisa filtrar por
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

## Autenticação

JWT sem expiração, bcrypt pra senha — detalhes do contrato (payload, fluxo de
slug) estão em `../CLAUDE.md`.
