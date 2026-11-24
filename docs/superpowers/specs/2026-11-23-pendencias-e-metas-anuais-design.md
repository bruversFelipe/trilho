# Pendências (tarefas sem data) e metas do ano

## Problema

O Trilho só guarda o que tem dia: tarefa com horário, "dia todo", ToDo e meta
da semana. Coisas que precisam ser resolvidas mas não têm prazo (procurar
advogado, marcar exame, comprar tênis) não têm onde morar, e acabam em lista
fora do app, que não é aberta. E não existe nível acima da semana pra
planejar o ano.

## Objetivo da v1

1. **Pendências**: guardar tarefa sem data e, quando decidir, dar um dia pra
   ela (é isso que faz pendência andar).
2. **Metas do ano**: meta com período anual, com tarefas ligadas a ela e
   progresso **calculado** (nunca atualizado na mão — é por falta disso que a
   meta semanal quase não é usada hoje).

Fora da v1: meta mensal, subtarefas, arrastar da lista de pendências pra
grade da semana, lembrete/notificação.

## Decisões

### Pendência é uma `Task` com `date: null`

Mesmo padrão do ToDo e da meta: **sem model novo**. "Agendar" é só dar uma
data; "voltar pras pendências" é `date: null`.

- `Task.date` deixa de ser `required`. `null` = pendência.
- Novo `normalizeBacklog(task)` no `taskController.js`, rodando nos mesmos
  pontos do `normalizeTodo` (`createTask`, `updateTask`, `detachOccurrence`):
  se `date` é `null`, força `allDay: true`, horários `null`, `isGoal: false`,
  `isTodo: false`, recorrência desligada (preservando `excludedDates`).
- `fetchOccurrences` já filtra por `date` no range, então pendência nunca
  aparece na Semana/Mês nem entra em `expandTasks`. Nada muda lá.
- Novo campo `scheduledFromBacklog: Boolean` (default `false`). O servidor
  liga ele no `updateTask` quando a tarefa tinha `date: null` e recebe uma
  data. Não vem do client.
- **Compras são só uma categoria** ("Compras"), sem tipo novo. A tela filtra
  por categoria.

**Agendar** (no modal): data obrigatória, horário opcional.
- Sem horário → vira ToDo naquele dia (`isTodo: true`).
- Com horário → vira tarefa normal com `startTime/endTime`.

### Pendência agendada que passou do dia — ⚠ decisão a confirmar

O ToDo hoje **não tem atrasado e não rola** (decisão explícita, ver
`CLAUDE.md`). Se uma pendência agendada virar ToDo e passar do dia sem ser
feita, ela some no passado — exatamente o problema que esta feature resolve.

Proposta: **não mexer no comportamento do ToDo na grade**. Em vez disso, a
tela de Pendências mostra uma seção **"Ficou pra trás"** com tarefas
`scheduledFromBacklog: true`, `completed: false` e `date < hoje`. Ações:
agendar de novo, voltar pras pendências, concluir. ToDos criados direto no dia
continuam exatamente como hoje.

### Meta do ano

- Novo campo `goalPeriod: 'week' | 'year'` (default `'week'`). Meta anual =
  `isGoal: true`, `goalPeriod: 'year'`, `date` = 1º de janeiro (UTC) do ano.
- Meta semanal **não muda** (continua presa na semana — decisão existente).
- `fetchOccurrences` passa a excluir `goalPeriod: 'year'` na query. Sem isso,
  a meta anual apareceria no `GoalsPanel` da semana que contém 1º de janeiro.
- Novo campo `goalId` (ObjectId → Task, default `null`) em qualquer tarefa
  **não recorrente** e que não seja meta. Recorrente fica de fora na v1:
  rotina não é progresso de projeto, e contar ocorrências complica o número.
- Validação do `goalId`: `findOne({ _id: goalId, userId: req.userId,
  isGoal: true, goalPeriod: 'year' })`. Se não achar, 400. (Regra do
  `server/CLAUDE.md`: nunca `findById` solto.)
- **Progresso** = tarefas ligadas concluídas / total de tarefas ligadas.
  Calculado no servidor.
- Excluir uma meta anual: `updateMany({ userId, goalId }, { goalId: null })`
  antes de apagar. As tarefas ficam, só perdem o vínculo.

## API

| Método | Rota | O quê |
|---|---|---|
| `POST` | `/tasks` | Sem `date` (ou `date: null`) cria pendência. Hoje dá 400 — trocar a validação. |
| `PUT` | `/tasks/:id` | `date: null` volta pras pendências. **Bug a evitar**: hoje `body.date !== undefined` faz `new Date(body.date)`, e `new Date(null)` vira 1970-01-01. Tratar `null` explicitamente. |
| `GET` | `/tasks/backlog?today=YYYY-MM-DD` | `{ pending: [...], overdue: [...] }`. `today` vem do client porque "que dia é hoje" é a data local do usuário (ver modelo de datas no `CLAUDE.md`). `pending` = `date: null`, `completed: false`, ordem de `createdAt`. `overdue` = regra do "Ficou pra trás". |
| `GET` | `/goals?year=2027` | Metas anuais do ano com `{ linkedTotal, linkedDone }`. Rota e controller novos (`goalRoutes`/`goalController`), protegidos por `requireAuth`. |

`/tasks/backlog` precisa ser registrada antes de qualquer `GET /:id` que
venha a existir.

## UI

**Nova aba "Pendências"** no segmentado do topo (Semana / Mês / Metas /
Pendências). O header tem breakpoints de 480px e 360px — testar a quarta
opção nos dois antes de qualquer outra coisa. Se não couber em 360px, trocar
os rótulos por ícones só nesse breakpoint.

De cima pra baixo:

1. **Metas de 2027**: lista com título, categoria e barra de progresso
   (`3/7`). "+ Meta do ano". Clique abre o modal da meta, que lista as tarefas
   ligadas.
2. **Ficou pra trás** (só aparece se tiver item).
3. **Pendências**: chips de filtro por categoria (padrão visual dos
   segmentados: `.weekday-chip`/`.density-option`), lista com checkbox,
   título, chip de categoria e tag da meta, se tiver. Embaixo, input de
   adicionar rápido reaproveitando o comportamento do `TodoQuickAdd` (Enter
   salva e continua aberto, Esc fecha).

**Modal** (`TaskModal`, novo modo pendência): título, descrição, categoria,
meta (select com as metas do ano corrente e do seguinte) e o bloco
**Agendar**: atalhos "Hoje" e "Amanhã", ou escolher data, mais horário
opcional. Em tarefa/ToDo agendado que veio das pendências, botão "Voltar pras
pendências".

**Select de meta** também aparece no modal de tarefa normal e de ToDo
(escondido quando recorrência está ligada).

Grade da Semana e Mês: sem mudança na v1.

## Testes

- `node:test` pra funções puras novas: regra de "ficou pra trás" e cálculo de
  progresso (colocar em `utils/`, mesmo padrão do `drag.test.js`).
- Manual contra `trilho_dev` (**nunca** `DB_NAME=trilho`): criar pendência,
  agendar sem horário (vira ToDo), agendar com horário, voltar pras
  pendências, deixar passar do dia e ver em "Ficou pra trás", ligar a uma meta
  e ver o progresso mudar ao concluir, excluir a meta e conferir que as
  tarefas ficaram. Conferir que meta anual não aparece no `GoalsPanel` da
  semana de 1º de janeiro.
- Segurança: tentar `goalId` de outro usuário → 400.

## Decisões confirmadas (2026-11-24)

1. **"Ficou pra trás" entra como está acima**: só tarefas com
   `scheduledFromBacklog: true`, `completed: false` e `date < hoje`. O
   comportamento do ToDo na grade **não muda**.
2. **Meta semanal fica exatamente como está.** O `GoalsPanel` não muda; a meta
   anual só deixa de aparecer nele porque o `fetchOccurrences` não a busca.
3. Detalhes de implementação aprovados junto com o plano
   (`docs/superpowers/plans/2026-11-24-pendencias-e-metas-anuais.md`, D1–D12):
   - Header em 360px: a 4ª aba não cabia. Em telas de até 360px o texto
     "T R I L H O" some e fica só o logo.
   - A aba mostra "Metas de {ano}" com um seletor do ano atual e do seguinte.
   - `GET /goals` devolve também `linkedTasks` (`_id, title, completed, date`).
   - Tarefa recorrente ou meta perde `scheduledFromBacklog` e `goalId`. A data
     da meta anual é sempre forçada para 1º de janeiro UTC.
   - O "+" na aba Pendências cria pendência sem data: o modal só *converte*
     uma pendência existente em ToDo, nunca *cria* ToDo.
   - Textos da UI sem acento, como o resto do app ("Pendencias",
     "Ficou pra tras", "Amanha").
