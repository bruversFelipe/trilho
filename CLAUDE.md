# Trilho

Organizador semanal pessoal (agenda por horário, tipo Google Calendar
simplificado), multiusuário. Monorepo: `server/` (Node/Express/Mongoose) e
`client/` (React/Vite). Ver `README.md` para como rodar e endpoints.

Este arquivo cobre só o que é **comum aos dois lados** — contrato entre API e
front, decisões de produto, infra. Convenções específicas de implementação
ficam em `server/CLAUDE.md` e `client/CLAUDE.md` — leia o deste arquivo
primeiro (o Claude Code carrega os dois juntos automaticamente quando você
mexe em arquivos de dentro de `server/` ou `client/`), depois o do lado que
for alterar. **Antes de criar um componente, endpoint ou util novo, confira
se já não existe algo parecido nesses arquivos** — não duplicar lógica é mais
importante que "ser rápido".

## Modelo de datas: sempre UTC, nunca hora local

Já existiu um bug real de fuso onde `dateKey()` no front usava getters locais
(`getDate()`) sobre timestamps UTC-meia-noite vindos da API — pra usuário em
UTC-negativo (Brasil, -3), isso deslocava tarefas um dia pra trás/frente
dependendo da hora. Corrigido trocando todo `date.js` (front e back) pra
getters UTC. Um "dia de calendário" é sempre meia-noite UTC daquele dia — isso
é proposital, não um bug a "corrigir". A única exceção deliberada é `today()`
no front, que lê a hora local de verdade (pra saber "que dia é hoje" pro
usuário) e devolve isso já como um token UTC-meia-noite; todo o resto do app
trata datas como tokens UTC opacos.

**Semana começa no domingo**, não segunda (`startOfWeek` em ambos os
`date.js`, idêntico nos dois lados). Isso também corrigiu um bug de
desalinhamento no cabeçalho da visão Mês do front (que já era fixo
"Dom Seg Ter...").

## Autenticação e username

JWT **sem expiração** (proposital, é app pessoal), payload
`{ sub: userId, username }`, sem refresh token nem 2FA. Senha com bcrypt.

**`username` nunca é digitado pelo usuário**, é sempre `slugify(name)`
calculado no backend (nunca confiar em slug vindo do client). Front só faz
preview via `GET /auth/slug-availability` antes de enviar o cadastro.

## Editar/excluir uma ocorrência de tarefa recorrente

Contrato de API que os dois lados precisam respeitar. Usa o padrão de exceção
do Google Calendar: a data vai pra `recurrence.excludedDates` da série (some
da expansão) e, se foi uma edição (não exclusão), nasce uma Task avulsa nova
(`recurrence.enabled: false`) só com aquela data — sem vínculo com a série
original. `PUT /tasks/:id` aceita `{ scope: 'single', occurrenceDate }` pra
isso; `DELETE` aceita os mesmos dois campos como query string. Editar a série
inteira (`scope` omitido ou `'series'`) **precisa preservar**
`excludedDates` ao sobrescrever `recurrence` no backend — nunca substituir o
objeto sem copiar esse array (detalhe de implementação em
`server/CLAUDE.md`, mas o contrato do campo `scope` é o que importa pro
front). A avulsa criada por `scope: 'single'` respeita `completed` do body (o
arrastar e soltar manda, pra ocorrência concluída continuar concluída).

## Metas ficam presas na semana em que foram criadas

`isGoal: true` — decisão explícita do usuário: se não concluída, não rola pra
semana seguinte automaticamente. Não "consertar" isso sem confirmar antes.

## ToDos são anotações presas num dia, sem "atrasado"

`isTodo: true` — anotação rápida criada pelo "+ todo" da faixa do topo da
semana (estilo Asana). Sempre `allDay`, sem horário, sem recorrência, nunca
meta (o servidor força isso em `normalizeTodo`, independente do payload).
Decisão explícita do usuário: **não rola pro dia seguinte e não tem destaque
de atrasado** — se ficou pra trás, a pessoa troca a data no modal. Não
adicionar rollover/aviso de atrasado sem confirmar antes.

## Pendências são `Task` com `date: null`

Sem model novo: pendência (tarefa ainda sem dia) é uma `Task` com
`date: null`. O servidor força o formato em `normalizeBacklog` (sem horário,
sem recorrência, nunca ToDo nem meta). "Agendar" é dar uma data;
`PUT /tasks/:id { date: null }` volta pras pendências (o servidor trata `null`
explicitamente, nunca `new Date(null)` = 1970). Pendência nunca aparece em
Semana/Mês, porque `fetchOccurrences` filtra por data.

- `scheduledFromBacklog` é escrito **só pelo servidor**: vira `true` quando
  uma tarefa sem data recebe uma data no `updateTask`. Nunca vem do client.
  Tarefa recorrente ou meta perde esse flag (e o `goalId`).
- **"Ficou pra trás"** (decisão confirmada em 2026-11-24): só tarefas com
  `scheduledFromBacklog: true`, `completed: false` e `date < hoje`. O ToDo da
  grade **continua sem atrasado** (seção acima). ToDo criado direto no dia
  nunca entra nessa lista.
- O "hoje" dessa regra **vem do client** (`dateKey(today())`, data local do
  usuário). O servidor nunca usa o próprio relógio pra isso.
- Compras etc. são só uma categoria, sem tipo novo.

## Metas do ano

Meta anual = `isGoal: true, goalPeriod: 'year'`, com `date` sempre em 1º de
janeiro UTC do ano dela (o servidor força em `normalizeGoal`, junto com
`allDay`, sem horário e sem recorrência). `goalPeriod` só é aceito no
`POST`. Meta semanal (`goalPeriod: 'week'`, o default) **fica exatamente como
está** (decisão de 2026-11-24): presa na semana, no `GoalsPanel`.

- `fetchOccurrences` exclui `goalPeriod: 'year'`, então meta anual nunca
  aparece em Semana/Mês nem no `GoalsPanel` da semana de 1º de janeiro.
- `goalId` (→ Task) liga uma tarefa a uma meta anual. Só em tarefa **não
  recorrente** e que **não é meta** (o servidor zera nos outros casos).
  Validado por usuário: `goalId` que não é uma meta anual do próprio usuário
  (malformado, meta semanal, de outra conta) → 400, antes de qualquer escrita.
- Progresso = ligadas concluídas / total de ligadas, **calculado no
  servidor**, nunca guardado nem editado à mão.
- Excluir meta anual desvincula as tarefas (`goalId: null`) antes de apagar.
  As tarefas continuam.

## Contratos: `/tasks/backlog` e `/goals`

- `GET /tasks/backlog?today=YYYY-MM-DD` → `{ pending, overdue }`. `pending` =
  sem data e não concluídas, por `createdAt`. `overdue` = regra do "Ficou pra
  trás", da data mais antiga pra mais nova. `today` ausente, fora do formato
  ou data inexistente → 400.
- `GET /goals?year=YYYY` → metas anuais daquele ano, por `createdAt`, cada uma
  com `linkedTotal`, `linkedDone` e `linkedTasks: [{ _id, title, completed,
  date }]`. `year` fora de 1970–9999 → 400.
- `POST /tasks` sem `date` (ou `date: null`) cria pendência. `goalId` opcional
  em `POST`/`PUT`.

## Infra e produção

- **App está em produção de verdade**: cliente na Vercel (`trilho.me`), API
  no Railway, mesmo cluster MongoDB Atlas. `DB_NAME` local é **`trilho_dev`**,
  produção usa **`trilho`** — nunca rodar dev local com `DB_NAME=trilho`. Isso
  já aconteceu uma vez (contas de teste criadas via automação local
  apareceram no banco de produção) — mantenha esses dois sempre diferentes.
- `.env` tem segredos reais (Mongo Atlas + JWT secret) — nunca commitar, já
  está no `.gitignore` em `server/`, `client/` e na raiz.
