# Pendências e metas do ano — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guardar tarefas sem data (pendências), dar um dia pra elas quando decidir,
mostrar o que foi agendado e ficou pra trás, e ter metas do ano com progresso
calculado pelas tarefas ligadas.

**Architecture:** Sem model novo. Pendência é `Task` com `date: null`, e meta do ano é
`Task` com `isGoal: true, goalPeriod: 'year'`. O servidor garante o formato de cada
tipo numa cadeia de normalização (`normalizeTask`, no mesmo padrão do `normalizeTodo`).
Duas rotas de leitura novas (`GET /tasks/backlog` e `GET /goals`) usam regras puras em
`server/src/utils/`, testadas com `node:test`. No client, uma aba nova (`BacklogView`)
busca as próprias pendências. O `App.jsx` é dono das metas do ano, que alimentam a aba
e o select de meta do `TaskModal`.

**Tech Stack:** React 19 + Vite 8 (client), Express 4 + Mongoose 8 (server), `node --test` (Node 24, embutido).

**Spec:** `docs/superpowers/specs/2026-11-23-pendencias-e-metas-anuais-design.md`

## Decisões já confirmadas (2026-11-24)

1. "Ficou pra trás" segue a spec: `scheduledFromBacklog: true`, `completed: false`, `date < hoje`. O ToDo na grade **não muda**.
2. Meta semanal fica como está. O `GoalsPanel` não muda. A meta anual só sai dele porque o `fetchOccurrences` deixa de buscá-la.

## Decisões do plano (aprovadas em 2026-11-24)

- **D1 — Header em 360px: NÃO CABE.** Medi antes do plano, só injetando no DOM, sem mexer em código. Com "Pendencias" como 4ª aba e "Sair" visível, o `.app-header` fica com `scrollWidth` 399 numa tela de 360. O "Sair" some, e o "Hoje" fica colado na borda. Em 480 cabe, com cerca de 17px de folga de cada lado das abas. **Escolha: em telas de até 360px, esconder o `.brand-name` ("T R I L H O") e manter só o logo** (libera ~59px).
- **D2 — Ano das metas na aba:** um segmentado `[2026 | 2027]` (ano atual e o seguinte, com `.density-option`) ao lado de "Metas de {ano}". A aba abre no ano atual. O select de meta do modal lista os dois anos, como pede a spec.
- **D3 — `GET /goals` também devolve `linkedTasks`** (`_id, title, completed, date`), além de `linkedTotal/linkedDone`. É o que o modal da meta usa pra listar as tarefas ligadas, sem precisar de outra rota.
- **D4 — "+ Meta do ano" é um input rápido** (reusa `TodoQuickAdd`): título e Enter. Categoria e descrição se editam no modal da meta.
- **D5 — Normalização além da spec.** `normalizeBacklog` também zera `goalPeriod` (volta pra `'week'`) e `scheduledFromBacklog`. Tarefa recorrente ou meta perde `scheduledFromBacklog` e `goalId`: assim a regra do "Ficou pra trás" fica literal, e uma rotina não fica presa nessa lista pra sempre. Meta anual tem a data forçada pra 1º/jan UTC do ano dela, `allDay`, sem horário e sem recorrência. `goalPeriod` só é aceito no `POST`.
- **D6 — Adicionar rápido com filtro ativo** cria a pendência na categoria filtrada. Sem isso, o item sumiria da lista na hora.
- **D7 — FAB "+" na aba Pendências** abre "Nova pendencia" **sem** o bloco Agendar. Assim o modal continua nunca *criando* ToDo (regra do `client/CLAUDE.md`): ele só *converte* uma pendência que já existe, que é o que a spec pede.
- **D8 — Textos da UI sem acento**, igual ao resto do app ("Mes", "Descricao"): "Pendencias", "Ficou pra tras", "Amanha", "Voltar pras pendencias".
- **D9 — Ordem b→c.** Mantive a ordem pedida. Por isso, na fase b, `splitBacklog` e `withProgress` nascem como funções locais dos controllers. A fase c move as duas pra `utils/` e escreve os testes. Os testes falham antes da mudança, porque o import ainda não existe. Se preferir TDD de verdade, dá pra trocar b e c.
- **D10 — O server não tem lint nem build.** Ao fim de cada fase rodo `node --check` nos arquivos de server alterados, e no client `npm run lint && npm run build && npm test`. Da fase c em diante, também `npm test` no server.
- **D11 — Na fase d, só os itens de "Ficou pra trás" abrem o modal** (eles têm data, e o modal atual funciona com eles). Clicar em pendência ou em meta do ano só passa a abrir o modal na fase e. Assim nenhum commit intermediário abre o modal antigo com uma pendência, que mostraria a data 1970-01-01.
- **D12 — A tabela de endpoints do `README.md`** ganha as duas rotas novas na fase f.

## Global Constraints

- Branch `feat/pendencias-metas-anuais`, criado a partir de `main` antes da Task 1. Um commit por fase, mais um commit `docs:` inicial com a spec e este plano (mesmo padrão do drag-and-drop).
- **Nenhuma dependência nova** (nem dev). Testes com `node:test` + `node:assert/strict`.
- Toda query nova filtra por `req.userId`. Todo acesso por id é `findOne({ _id, userId: req.userId })`. Isso inclui `goalId`, o `updateMany` de desvincular e a lista de `linkedTasks`.
- Datas sempre UTC (`parseDateOnly`, getters UTC). O "hoje" do `/tasks/backlog` é sempre `dateKey(today())` vindo do client, e o servidor nunca usa `new Date()` pra isso.
- Dev local só com `DB_NAME=trilho_dev`. Antes de subir o server, `grep '^DB_NAME=' server/.env` precisa imprimir `DB_NAME=trilho_dev`. Se a porta 4000 já estiver ocupada, parar e perguntar.
- Smoke tests da API: script Node descartável, fora do repo e não commitado. Ele cria usuários `Smoke Pendencias <timestamp>` no `trilho_dev`.
- Reusar antes de criar: `TodoQuickAdd`, `.density-option`/`.edit-scope-option`, família `.goal-item`/`.goal-check`/`.goal-category`/`.add-goal-btn`/`.goals-panel`, padrão do `normalizeTodo`, padrão de fetch do `useTasksForRange`.
- Fora do escopo: meta mensal, subtarefas, arrastar pendência pra grade, notificações, qualquer mudança no ToDo da grade ou na meta semanal.
- Se a spec conflitar com o código ou com um `CLAUDE.md` durante a execução: parar e perguntar.

## Review Focus

- **Adicionar rápido com filtro de categoria ativo:** o item novo entra naquela categoria e continua visível. → verificação manual na Task 4.
- **Tarefa ligada a meta de um ano fora do select** (ex.: meta de 2025 aberta em 2026): salvar o modal **não** apaga o `goalId`. → verificação manual na Task 5.
- **Pendência agendada que depois vira recorrente ou meta semanal:** sai do "Ficou pra trás" e perde o `goalId`. → smoke da Task 1.
- **Item agendado pra hoje à noite (UTC-3, já 01:00 UTC do dia seguinte):** nunca aparece como "ficou pra trás". → teste "hoje e futuro não são overdue" na Task 3, mais conferir na Task 4 que a request leva a data local.
- **Entrada malformada nunca dá 500 nem cria vínculo.** Vale pra `goalId: 'abc'`, `goalId` de meta semanal, `goalId` de outro usuário, `today` ausente ou inválido e `year` inválido: tudo isso dá 400. → smoke da Task 2.

---

### Task 1 (fase a): Server — modelo, normalização e `date: null`

**Files:**
- Modify: `server/src/models/Task.js`
- Modify: `server/src/controllers/taskController.js` (`fetchOccurrences`, normalizadores, `createTask`, `updateTask`, `detachOccurrence`)
- Modify: `docs/superpowers/specs/2026-11-23-pendencias-e-metas-anuais-design.md` (seção "Em aberto" → decisões confirmadas)

**Interfaces:**
- Produces (schema `Task`):
  - `date: { type: Date, default: null }` (sai o `required`). `null` = pendência.
  - `scheduledFromBacklog: { type: Boolean, default: false }`: só o servidor escreve.
  - `goalPeriod: { type: String, enum: ['week', 'year'], default: 'week' }`
  - `goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null }`
- Produces (`taskController.js`, não exportados):
  - `normalizeBacklog(task)`: se `!task.date`: `date = null`, `allDay = true`, `startTime/endTime = null`, `isGoal = false`, `isTodo = false`, `goalPeriod = 'week'`, `scheduledFromBacklog = false`, recorrência desligada preservando `excludedDates` (mesmo bloco do `normalizeTodo`).
  - `normalizeGoal(task)`: se `!task.isGoal` → `goalPeriod = 'week'`. Se `goalPeriod === 'year'`: `date = new Date(Date.UTC(new Date(task.date).getUTCFullYear(), 0, 1))`, `allDay = true`, horários `null`, `isTodo = false`, recorrência desligada (preservando `excludedDates`).
  - `normalizeTask(task)`: roda `normalizeBacklog` → `normalizeTodo` → `normalizeGoal`, e depois, se `task.isGoal || task.recurrence?.enabled`, faz `scheduledFromBacklog = false` e `goalId = null`. Substitui as 3 chamadas de `normalizeTodo` (`createTask`, `updateTask`, `detachOccurrence`).
  - `createTask`: sai o 400 de `date`. Passa a usar `date: body.date ? new Date(body.date) : null` e `goalPeriod: body.goalPeriod === 'year' ? 'year' : 'week'`. Nunca lê `scheduledFromBacklog` do body.
  - `updateTask`: troca a linha do `date` por:
    ```js
    if (body.date !== undefined) {
      const wasBacklog = !task.date;
      task.date = body.date ? new Date(body.date) : null; // null/'' = volta pras pendências (nunca new Date(null) = 1970)
      if (wasBacklog && task.date) task.scheduledFromBacklog = true;
    }
    ```
    `goalPeriod` e `scheduledFromBacklog` **não** entram em `assignable`.
  - `fetchOccurrences`: acrescenta `goalPeriod: { $ne: 'year' }` no nível de cima do `find`.

- [ ] **Step 1: Branch e commit de docs**

Run: `git checkout -b feat/pendencias-metas-anuais`
Atualizar a seção "Em aberto" da spec com as decisões confirmadas e as D1–D12 aprovadas, e então:
```bash
git add docs/superpowers/specs/2026-11-23-pendencias-e-metas-anuais-design.md docs/superpowers/plans/2026-11-24-pendencias-e-metas-anuais.md
git commit -m "docs: backlog and year goals design and implementation plan"
```

- [ ] **Step 2: Schema e normalizadores** conforme Interfaces.

- [ ] **Step 3: Checagens estáticas**

Run: `node --check server/src/models/Task.js && node --check server/src/controllers/taskController.js` → sem saída.
Run (em `client/`): `npm run lint && npm run build && npm test` → tudo passa (client não mudou; é a linha de base).

- [ ] **Step 4: Smoke da API contra `trilho_dev`.** Confirmar `DB_NAME=trilho_dev`, subir com `npm start` em `server/` (background) e rodar o script descartável, que registra um usuário e verifica:
  - `POST /tasks {title}` sem `date` → 201, `date: null`, `allDay: true`, `isTodo: false`.
  - `POST /tasks {title, date: null, isTodo: true, isGoal: true, startTime: '10:00'}` → `isTodo/isGoal: false`, `startTime: null`.
  - `PUT {date: '2026-11-20', isTodo: true}` numa pendência → `date` `2026-11-20T00:00:00.000Z`, `scheduledFromBacklog: true`.
  - `PUT {date: null}` → `date: null` (não 1970), `isTodo: false`, `scheduledFromBacklog: false`.
  - Pendência agendada com horário (`isTodo: false, startTime, endTime`), depois `PUT {recurrence: {enabled: true, daysOfWeek: [1]}}` → `scheduledFromBacklog: false`.
  - `POST {title, isGoal: true, goalPeriod: 'year', date: '2027-03-10'}` → `date` `2027-01-01T00:00:00.000Z`, `allDay: true`.
  - `GET /tasks?start=2026-12-27&end=2027-01-02` → **não** contém a meta anual. Uma meta semanal criada em `2026-12-28` **aparece** (regressão do `GoalsPanel`).
  - `GET /tasks?start=1970-01-01&end=1970-01-07` → `[]` (nenhuma pendência vazou como 1970).

Expected: todas as checagens `ok`. Parar o server.

- [ ] **Step 5: Commit**

```bash
git add server/src/models/Task.js server/src/controllers/taskController.js
git commit -m "feat: tasks without a date (backlog) and year goal fields on the server"
```

---

### Task 2 (fase b): Server — `GET /tasks/backlog`, `GET /goals` e `goalId`

**Files:**
- Modify: `server/src/controllers/taskController.js` (`getBacklog`, `findYearGoal`, `createTask`, `updateTask`, `deleteTask`)
- Modify: `server/src/routes/taskRoutes.js`
- Create: `server/src/controllers/goalController.js`
- Create: `server/src/routes/goalRoutes.js`
- Modify: `server/src/index.js`

**Interfaces:**
- Consumes: schema e `normalizeTask` da Task 1.
- Produces:
  - `GET /tasks/backlog?today=YYYY-MM-DD` → `200 { pending: Task[], overdue: Task[] }`. Retorna `400 { error: 'today query param is required (YYYY-MM-DD)' }` se `today` não casar com `/^\d{4}-\d{2}-\d{2}$/`. Rota registrada **antes** de qualquer `/:id`, ao lado de `/stats`.
    - Query de candidatos: `{ userId: req.userId, completed: false, $or: [{ date: null }, { scheduledFromBacklog: true }] }`.
    - Função local `splitBacklog(tasks, today: Date) -> { pending, overdue }` (a Task 3 move pra `utils/`). `pending` = `!date && !completed`, por `createdAt` crescente. `overdue` = `scheduledFromBacklog && !completed && date && date < today`, por `date` crescente (empate: `createdAt`). Não muta a entrada.
  - `GET /goals?year=YYYY` (`goalController.listGoals`) → `200 Goal[]`, onde `Goal = Task & { linkedTotal, linkedDone, linkedTasks: Array<{ _id, title, completed, date }> }`, por `createdAt` crescente. Retorna `400 { error: 'year query param is required (YYYY)' }` se `year` não for um inteiro entre 1970 e 9999.
    - Metas: `{ userId, isGoal: true, goalPeriod: 'year', date: { $gte: Date.UTC(year, 0, 1), $lt: Date.UTC(year + 1, 0, 1) } }`.
    - Ligadas: `Task.find({ userId, goalId: { $in: goalIds } }).select('goalId title completed date').sort({ createdAt: 1 })`.
    - Função local `withProgress(goals, linkedTasks) -> Goal[]` (a Task 3 move pra `utils/`). Usa `toObject()` quando existe, igual ao `toOccurrence`, e compara ids com `String()`.
  - `goalRoutes.js`: `router.get('/', asyncHandler(listGoals))`. `index.js`: `app.use('/goals', requireAuth, goalRoutes)`.
  - `findYearGoal(userId, goalId) -> Promise<Task | null>`: devolve `null` se `!mongoose.isValidObjectId(goalId)`. Senão, `Task.findOne({ _id: goalId, userId, isGoal: true, goalPeriod: 'year' })`.
  - `createTask` e `updateTask`: se `body.goalId` vier preenchido e `findYearGoal` devolver `null` → `400 { error: 'goalId invalido' }`. Essa checagem vem **antes** de qualquer escrita (antes do `resolveCategory`, que pode criar categoria). No `createTask`, `goalId: body.goalId || null`. No `updateTask`, `if (body.goalId !== undefined) task.goalId = body.goalId || null`. O `detachOccurrence` ignora `goalId`, porque série não tem meta.
  - `deleteTask` (caminho que não é ocorrência avulsa): `findOne({ _id, userId })` → 404 se não achar. Se `isGoal && goalPeriod === 'year'`, roda `Task.updateMany({ userId: req.userId, goalId: task._id }, { $set: { goalId: null } })` **antes** de `Task.deleteOne({ _id: task._id, userId: req.userId })` → 204.

- [ ] **Step 1: Implementar** conforme Interfaces.

- [ ] **Step 2: Checagens estáticas**

Run: `node --check` em cada um dos 5 arquivos → sem saída. Em `client/`: `npm run lint && npm run build && npm test` → passa.

- [ ] **Step 3: Smoke contra `trilho_dev`** (mesmo procedimento da Task 1), com dois usuários, A e B:
  - A: meta G (2026), pendência T1 `{goalId: G}`, ToDo T2 em `2026-11-20` `{goalId: G}`, depois `PATCH /tasks/T2/complete`.
  - A: `GET /goals?year=2026` → G com `linkedTotal: 2`, `linkedDone: 1` e `linkedTasks` com 2 itens só com `_id, title, completed, date`. `?year=2027` → `[]`. Sem `year` → 400. `year=abc` → 400.
  - A: `goalId: 'abc'` → 400. `goalId` de meta semanal → 400. Recorrente com `goalId: G` → 201 com `goalId: null`.
  - B: `POST {title, goalId: G}` → 400. `PUT` numa tarefa de B com `{goalId: G}` → 400. `GET /goals?year=2026` → `[]`. `GET /tasks/backlog?today=2026-11-24` não contém nada de A.
  - A: `GET /tasks/backlog` sem `today` → 400. `today=24-11-2026` → 400.
  - A, com `today=2026-11-24`: T1 em `pending`. Pendência P agendada pra `2026-11-20` → em `overdue`. Reagendada pra `2026-11-24` → fora. ToDo criado direto em `2026-11-20` → nunca em `overdue`. P concluída → fora das duas listas.
  - A: `DELETE /tasks/G` → 204. T1 e T2 continuam existindo com `goalId: null`. `DELETE` de novo → 404.

Expected: todas `ok`.

- [ ] **Step 4: Commit**

```bash
git add server/src/controllers/taskController.js server/src/controllers/goalController.js server/src/routes/taskRoutes.js server/src/routes/goalRoutes.js server/src/index.js
git commit -m "feat: backlog and year goals endpoints with per-user goal validation"
```

---

### Task 3 (fase c): Regras puras + `node:test` no server

**Files:**
- Create: `server/src/utils/backlog.js` (`splitBacklog`)
- Create: `server/src/utils/goals.js` (`withProgress`)
- Test: `server/src/utils/backlog.test.js`, `server/src/utils/goals.test.js`
- Modify: `server/src/controllers/taskController.js`, `server/src/controllers/goalController.js` (importar em vez de função local)
- Modify: `server/package.json` (`"test": "node --test src/**/*.test.js"`)

**Interfaces:**
- Produces: `splitBacklog(tasks, today: Date) -> { pending, overdue }` e `withProgress(goals, linkedTasks) -> Goal[]`, exatamente como definidos na Task 2. Os dois módulos não importam Mongoose.

- [ ] **Step 1: Escrever os testes** em `server/src/utils/backlog.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitBacklog } from './backlog.js';

const TODAY = new Date(Date.UTC(2026, 10, 24));
const nov = (d) => new Date(Date.UTC(2026, 10, d));
const task = (id, over = {}) => ({ _id: id, date: null, completed: false, scheduledFromBacklog: false, createdAt: nov(1), ...over });
const ids = (list) => list.map((t) => t._id);

test('sem data e nao concluida vai pra pending, em ordem de criacao', () => {
  const { pending, overdue } = splitBacklog([task('b', { createdAt: nov(3) }), task('a', { createdAt: nov(2) })], TODAY);
  assert.deepEqual(ids(pending), ['a', 'b']);
  assert.deepEqual(overdue, []);
});

test('veio das pendencias, antes de hoje e nao concluida vai pra overdue, mais antiga primeiro', () => {
  const { pending, overdue } = splitBacklog([
    task('ontem', { date: nov(23), scheduledFromBacklog: true }),
    task('semana-passada', { date: nov(17), scheduledFromBacklog: true }),
  ], TODAY);
  assert.deepEqual(ids(overdue), ['semana-passada', 'ontem']);
  assert.deepEqual(pending, []);
});

test('hoje e futuro nao sao overdue', () => {
  const { overdue } = splitBacklog([
    task('hoje', { date: TODAY, scheduledFromBacklog: true }),
    task('amanha', { date: nov(25), scheduledFromBacklog: true }),
  ], TODAY);
  assert.deepEqual(overdue, []);
});

test('concluida nao entra em nenhuma lista', () => {
  const { pending, overdue } = splitBacklog([
    task('p', { completed: true }),
    task('o', { date: nov(20), scheduledFromBacklog: true, completed: true }),
  ], TODAY);
  assert.deepEqual([pending, overdue], [[], []]);
});

test('ToDo criado direto no dia nunca e overdue', () => {
  assert.deepEqual(splitBacklog([task('todo', { date: nov(20), isTodo: true })], TODAY).overdue, []);
});

test('nao muta a lista recebida', () => {
  const input = [task('b', { createdAt: nov(3) }), task('a', { createdAt: nov(2) })];
  splitBacklog(input, TODAY);
  assert.deepEqual(ids(input), ['b', 'a']);
});
```

e `server/src/utils/goals.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withProgress } from './goals.js';

const g1 = { _id: 'g1', title: 'Correr 10k' };
const g2 = { _id: 'g2', title: 'Ler 12 livros' };
const link = (id, goalId, completed, extra = {}) => ({ _id: id, goalId, completed, title: id, date: null, ...extra });

test('conta total e concluidas por meta', () => {
  const [a, b] = withProgress([g1, g2], [link('t1', 'g1', true), link('t2', 'g1', false), link('t3', 'g2', true)]);
  assert.deepEqual([a.linkedTotal, a.linkedDone, b.linkedTotal, b.linkedDone], [2, 1, 1, 1]);
});

test('meta sem tarefa ligada fica 0/0 com lista vazia', () => {
  const [a] = withProgress([g1], []);
  assert.deepEqual([a.linkedTotal, a.linkedDone, a.linkedTasks], [0, 0, []]);
});

test('compara ids como string (ObjectId x string) e ignora meta fora da lista', () => {
  const oid = { toString: () => 'g1' };
  const [a] = withProgress([{ _id: oid, title: 'x' }], [link('t1', 'g1', false), link('t9', 'outra', true)]);
  assert.equal(a.linkedTotal, 1);
});

test('linkedTasks leva so _id, title, completed e date, na ordem recebida', () => {
  const [a] = withProgress([g1], [link('t2', 'g1', true), link('t1', 'g1', false, { description: 'x', userId: 'u' })]);
  assert.deepEqual(a.linkedTasks, [
    { _id: 't2', title: 't2', completed: true, date: null },
    { _id: 't1', title: 't1', completed: false, date: null },
  ]);
});

test('usa toObject() quando a meta e documento Mongoose', () => {
  const [a] = withProgress([{ toObject: () => ({ _id: 'g1', title: 'Doc' }) }], [link('t1', 'g1', false)]);
  assert.deepEqual([a.title, a.linkedTotal], ['Doc', 1]);
});
```

- [ ] **Step 2: Adicionar o script `test` e rodar**

Run (em `server/`): `npm test`
Expected: FAIL com `Cannot find module '.../utils/backlog.js'` (e `goals.js`).

- [ ] **Step 3: Mover** `splitBacklog` e `withProgress` dos controllers pros dois módulos, e importar nos controllers.

- [ ] **Step 4: Rodar tudo**

Run (em `server/`): `npm test` → 11 testes `ok`. Rodar `node --check` nos 2 controllers → sem saída.
Run (em `client/`): `npm run lint && npm run build && npm test` → passa.
Rodar de novo o smoke da Task 2 → todas `ok` (a mudança não alterou o comportamento).

- [ ] **Step 5: Commit**

```bash
git add server/package.json server/src/utils/backlog.js server/src/utils/backlog.test.js server/src/utils/goals.js server/src/utils/goals.test.js server/src/controllers/taskController.js server/src/controllers/goalController.js
git commit -m "test: extract backlog and goal progress rules with node:test suite"
```

---

### Task 4 (fase d): Client — `api.js` e aba Pendências

**Files:**
- Modify: `client/src/App.jsx`, `client/src/App.css`
- Modify: `client/src/api/api.js`
- Create: `client/src/hooks/useBacklog.js`
- Create: `client/src/components/BacklogView.jsx`
- Modify: `client/src/components/TodoQuickAdd.jsx`
- Modify: `client/src/utils/date.js` (+ `formatShortDate`, movida do `TaskModal`) e `client/src/components/TaskModal.jsx` (passa a importá-la)

**Interfaces:**
- Consumes: `GET /tasks/backlog`, `GET /goals` (Task 2).
- Produces:
  - `api.getBacklog(today: string) -> Promise<{ pending, overdue }>` e `api.getGoals(year: number) -> Promise<Goal[]>`. Sem token, devolvem `{ pending: [], overdue: [] }` e `[]` (mesmo padrão do `getTasks`).
  - `utils/date.formatShortDate(date) -> 'DD/MM'` (o corpo atual do `TaskModal`).
  - `useBacklog(refreshKey) -> { pending, overdue, loading }`: chama `getBacklog(dateKey(today()))` com o mesmo padrão de cancelamento do `useTasksForRange`.
  - `TodoQuickAdd` ganha `label = '+ todo'`, `placeholder = 'anotar algo...'`, `buttonClassName = 'todo-add'`, `inputClassName = 'todo-add-input'`. Os defaults são os valores de hoje, então o `WeekView` não muda.
  - `App`:
    - `tab` aceita `'backlog'`. O botão "Pendencias" entra depois de "Metas".
    - `yearGoals: Goal[]` guarda o ano atual e o seguinte. É carregado por `Promise.all([getGoals(y), getGoals(y + 1)])`, com `y = today().getUTCFullYear()`, num efeito em `[refreshKey, authUser]`. Fica vazio sem login.
    - `handleAddPending(title, category | null)` → `createTask({ title, date: null, category: category?.name || '', categoryId: category?._id || null, categoryColor: category?.color })`.
    - `handleAddYearGoal(year, title)` → `createTask({ title, isGoal: true, goalPeriod: 'year', date: \`${year}-01-01\` })`.
    - `handleMoveToBacklog(task)` → `updateTask(task._id, { date: null })`.
    - Todos fazem `bump()` no sucesso e `console.error` + `alert` no erro (igual ao `handleAddTodo`).
  - `BacklogView({ refreshKey, goals, categories, onEditTask, onToggleComplete, onAddPending, onAddYearGoal, onMoveToBacklog })`: um `<section className="goals-panel backlog-view">` com três blocos, de cima pra baixo:
    1. **Metas de {ano}**: `.goals-panel-header` + `.period-label` + segmentado de ano (D2). Lista `.goals-list` > `.goal-item`, só das metas daquele ano (`getUTCFullYear` de `goal.date`). Cada item mostra título, `NotesIcon` se tiver descrição, `.goal-category`, barra `.goal-progress` (largura `linkedDone/linkedTotal`, 0% quando o total é 0) e `.goal-progress-label` `"{done}/{total}"`. Vazio: `.empty-hint` "Nenhuma meta para {ano}.". Depois vem `TodoQuickAdd` com `label="+ Meta do ano"`, `buttonClassName="add-goal-btn"` e `inputClassName="backlog-add-input"`.
    2. **Ficou pra tras**: só aparece se `overdue.length > 0`. Cada linha tem `.goal-check` (concluir), título (botão → `onEditTask`), `.backlog-date` `"{Seg} {DD/MM}"`, e `.link-btn` "Reagendar" (`onEditTask`) e "Voltar pras pendencias" (`onMoveToBacklog`).
    3. **Pendencias**: chips `.backlog-filter` > `.density-option`. Os chips são "Todas", depois cada categoria de `categories`, depois "Sem categoria" se houver pendência sem `categoryId`. A comparação usa `String(categoryId)`. Cada linha tem `.goal-check`, título, `.goal-category` da categoria e etiqueta da meta (`.goal-category` com `--chip-color: var(--text-dim)` e o título achado em `goals` pelo `goalId`; omitida se não achar). Vazio: "Nada pendente.". Depois vem `TodoQuickAdd` com `label="+ Pendencia"`, que chama `onAddPending(title, categoriaDoFiltro)` (D6).
  - Na Task 4, título de pendência e linha de meta **não** são clicáveis (D11).
  - CSS novo (só isto): `.backlog-year-picker` e `.backlog-filter` (flex, gap 4px; o filtro com `overflow-x: auto`; filhos `.density-option` com `flex: 0 0 auto` e `white-space: nowrap`), `.goal-progress` (trilho de 4px em `var(--border)`, preenchimento em `var(--chip-color, var(--text))`), `.goal-progress-label` e `.backlog-date` (11px, `--text-dim`), `.backlog-add-input` (mesma caixa do `.add-goal-btn`, borda sólida `var(--text)`). Mais a regra do header escolhida na D1.

- [ ] **Step 1: Header primeiro.** Adicionar só o botão "Pendencias" no `.tabs` e aplicar a solução da D1. Subir o client logado numa conta do `trilho_dev`. No Playwright, medir em 480, 360 e 1280: `.app-header` com `scrollWidth <= clientWidth`, "Hoje" e "Sair" inteiros na tela, e cada aba numa linha só. Tirar screenshots.
Expected: cabe nas três larguras. **Se não couber, parar e perguntar.**

- [ ] **Step 2: Implementar** `api.js`, `formatShortDate`, `useBacklog`, as props do `TodoQuickAdd`, o estado e os handlers do `App` e o `BacklogView` + CSS, conforme Interfaces.

- [ ] **Step 3: Rodar lint, build e testes**

Run (em `client/`): `npm run lint && npm run build && npm test` → passa. Run (em `server/`): `npm test` → passa.

- [ ] **Step 4: Verificação manual** (server com `trilho_dev`, Playwright em 360 e 1280):
  - [ ] "+ Pendencia" com Enter cria e continua aberto. Esc fecha. O item aparece em ordem de criação.
  - [ ] Com filtro "Compras" ativo, o item criado entra em Compras e continua visível. "Todas" mostra tudo.
  - [ ] A bolinha conclui, e o item sai da lista.
  - [ ] "+ Meta do ano" cria em 2026, e a meta aparece com 0/0. Trocar pra 2027 cria lá.
  - [ ] Ligar uma pendência à meta (via API nesta fase) → 0/1. Concluir → 1/1. A etiqueta da meta aparece na pendência.
  - [ ] Agendar uma pendência pra ontem (via API) → aparece em "Ficou pra tras". "Voltar pras pendencias" leva de volta. "Reagendar" abre o modal de ToDo, e mudar pra hoje tira o item da seção. Concluir também tira.
  - [ ] Na aba Network, `/tasks/backlog?today=` leva a data **local**.
  - [ ] Semana, Mês e Metas continuam iguais. A meta anual não aparece no `GoalsPanel` da semana de 1º/jan.

- [ ] **Step 5: Commit**

```bash
git add client/src/App.jsx client/src/App.css client/src/api/api.js client/src/hooks/useBacklog.js client/src/components/BacklogView.jsx client/src/components/TodoQuickAdd.jsx client/src/utils/date.js client/src/components/TaskModal.jsx
git commit -m "feat: Pendencias tab with year goals, left-behind list and quick add"
```

---

### Task 5 (fase e): `TaskModal` — modo pendência, Agendar, meta e "Voltar pras pendencias"

**Files:**
- Modify: `client/src/components/TaskModal.jsx`
- Modify: `client/src/App.jsx`
- Modify: `client/src/components/BacklogView.jsx` (pendências e metas passam a abrir o modal)
- Modify: `client/src/App.css` (só `.linked-tasks`, se a lista não couber com classes existentes)

**Interfaces:**
- Consumes: `yearGoals`, `handleSave`, `BacklogView` (Task 4) e `goalId`/`scheduledFromBacklog`/`linkedTasks` da API.
- Produces:
  - `TaskModal` ganha as props `goalOptions: Goal[]` (`App.yearGoals`) e `defaultBacklog: boolean`.
  - Modos: `backlogMode = task ? task.date == null : !!defaultBacklog` e `yearGoalMode = !!task?.isGoal && task.goalPeriod === 'year'`.
  - Estado novo: `goalId` (`task?.goalId ? String(task.goalId) : ''`) e `withTime` (`!!task?.startTime`). `date` começa `''` em `backlogMode` (o `buildInitialState` não chama mais `dateKey(null)`).
  - `buildPayload() -> object`. `handleSubmit` chama `onSave(buildPayload(), task)`.
    - `backlogMode`: `{ title, description, category, categoryColor, goalId: form.goalId || null, date: form.date || null, isTodo: !!form.date && !form.withTime, isGoal: false, allDay: false, startTime/endTime: (form.date && form.withTime) ? valor : null, recurrence: { enabled: false, daysOfWeek: [], endDate: null } }`.
    - `yearGoalMode`: só `{ title, description, category, categoryColor }`.
    - Demais modos: o payload de hoje + `goalId: showGoalSelect ? (form.goalId || null) : null`.
  - `showGoalSelect = !yearGoalMode && !form.isGoal && !form.recurrenceEnabled`.
    - O select tem "Sem meta", um `<optgroup label="{ano}">` por ano de `goalOptions` e, se `form.goalId` não estiver nas opções, `<option value={form.goalId}>Meta de outro ano</option>` (Review Focus).
  - **Bloco Agendar** (`backlogMode` editando, nunca em "Nova pendencia" — D7): `.edit-scope-options` com `[Sem data | Hoje | Amanha]`. O ativo é o que bate com `form.date`: `''`, `dateKey(today())` ou `dateKey(addDays(today(), 1))`. Abaixo, `<input type="date">`. Com data escolhida, aparece o toggle "Com horario", e ligado ele mostra a `field-row` Início/Fim que já existe.
  - Em `backlogMode` e `yearGoalMode` somem: o toggle de meta semanal, o campo Data, "Dia inteiro", horários e recorrência.
  - `yearGoalMode` mostra "Tarefas ligadas ({done}/{total})": lista só de leitura de `task.linkedTasks` (✓/○, título, `formatShortDate` ou "sem data"). Vazia: "Nenhuma tarefa ligada ainda.".
  - Títulos do modal: "Nova pendencia", "Editar pendencia" e "Editar meta do ano". Os outros ficam como estão.
  - Botão `.link-btn` **"Voltar pras pendencias"** quando `task?.scheduledFromBacklog && !isRecurringInstance && !backlogMode` → `onSave({ ...buildPayload(), date: null }, task)`.
  - `App`: na aba `'backlog'`, `handleAddTask` → `setModalState({ backlog: true })`. Passa `defaultBacklog={modalState.backlog}` e `goalOptions={yearGoals}`. No `handleDelete` de meta anual, o confirm vira `Excluir a meta "X"? As tarefas ligadas continuam, so perdem o vinculo.`
  - `BacklogView`: o título da pendência e a linha da meta viram botões → `onEditTask(item)`.

- [ ] **Step 1: Implementar** conforme Interfaces.

- [ ] **Step 2: Rodar lint, build e testes**

Run (em `client/`): `npm run lint && npm run build && npm test` → passa. Run (em `server/`): `npm test` → passa.

- [ ] **Step 3: Verificação manual** (Playwright em 360 e 1280, `trilho_dev`):
  - [ ] FAB na aba Pendências → "Nova pendencia" sem Agendar, e salvar cria sem data.
  - [ ] Abrir uma pendência → Agendar "Hoje" sem horário → vira ToDo de hoje na Semana, e "Voltar pras pendencias" aparece no modal dele.
  - [ ] Agendar "Amanha" com 14:00–15:00 → vira bloco com horário na grade.
  - [ ] "Voltar pras pendencias" (no ToDo e no bloco) → sai da grade e volta pra lista sem data.
  - [ ] Ligar uma tarefa normal e um ToDo a uma meta pelo select → progresso sobe. Ligar recorrência no modal → o select some, e a tarefa salva sem meta.
  - [ ] Meta de 2025 criada e ligada via API: abrir a tarefa mostra "Meta de outro ano", e salvar uma mudança de título mantém o `goalId`.
  - [ ] Modal da meta do ano lista as ligadas com ✓. Excluir → confirm novo → as tarefas continuam, sem etiqueta.
  - [ ] Editar ocorrência de recorrente ("somente este dia"), meta semanal e ToDo comum: tudo igual a antes, só com o select de meta onde ele cabe.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/TaskModal.jsx client/src/App.jsx client/src/components/BacklogView.jsx client/src/App.css
git commit -m "feat: backlog mode, scheduling and goal link in the task modal"
```

---

### Task 6 (fase f): Documentação

**Files:**
- Modify: `CLAUDE.md`, `server/CLAUDE.md`, `client/CLAUDE.md`, `README.md`

- [ ] **Step 1: `CLAUDE.md` (raiz)**. Seções novas:
  - "Pendências são `date: null`": `PUT date: null` volta pras pendências. `scheduledFromBacklog` é só do servidor. Regra do "Ficou pra trás" e a decisão de não mexer no ToDo da grade (confirmada em 2026-11-24). O `today` vem do client.
  - "Metas do ano": `goalPeriod: 'year'`, data em 1º/jan UTC, fora do `fetchOccurrences` e do `GoalsPanel`. `goalId` só em tarefa não recorrente e que não é meta, validado por usuário, e desvinculado quando a meta é excluída. Progresso calculado no servidor. Meta semanal mantida como está (decisão de 2026-11-24).
  - Contratos de `GET /tasks/backlog` e `GET /goals` (parâmetros, 400s, formato da resposta, com `linkedTasks`).
- [ ] **Step 2: `server/CLAUDE.md`**:
  - Estrutura (`goalController`, `goalRoutes`, `utils/backlog.js`, `utils/goals.js`).
  - Cadeia `normalizeTask` (backlog → todo → goal → vínculos), com "todo caminho novo que salva `Task` passa por ela" no lugar da frase de hoje sobre `normalizeTodo`.
  - `findYearGoal`, o `updateMany` antes do delete, `npm test` no server, e `requireAuth` também em `/goals`.
- [ ] **Step 3: `client/CLAUDE.md`**:
  - `BacklogView`, `useBacklog` e as props novas do `TodoQuickAdd`.
  - `App` dono de `yearGoals` (ano atual e seguinte).
  - Modos do `TaskModal` (pendência, meta do ano, select de meta, "Voltar pras pendencias"), com a ressalva de que o modal **converte** pendência em ToDo mas nunca cria ToDo.
  - A 4ª aba e a regra de 360px da D1.
- [ ] **Step 4: `README.md`**: duas linhas novas na tabela de endpoints (D12).
- [ ] **Step 5: Rodar** `npm test` (server) e `npm run lint && npm run build && npm test` (client) → passa.
- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md server/CLAUDE.md client/CLAUDE.md README.md
git commit -m "docs: record backlog and year goals decisions and API contracts"
```
