# Trilho

Organizador semanal pessoal (agenda por horário, tipo Google Calendar
simplificado), multiusuário. Node/Express/Mongoose no backend, React/Vite no
front. Ver `README.md` para como rodar e endpoints — este arquivo é sobre
**convenções e decisões de projeto** que não dá pra inferir só lendo o código
por cima.

## Arquitetura do backend (`server/`)

Padrão de pastas, sempre seguir para qualquer feature nova:

```
src/
  models/       Schemas Mongoose (User, Task, Category)
  controllers/  Lógica de negócio, uma função por endpoint
  routes/       Só wiring de Router + asyncHandler, zero lógica
  middleware/   requireAuth (JWT)
  utils/        Funções puras reaproveitáveis (date, slug, recurrence, exampleData)
```

- Toda rota async passa por `utils/asyncHandler.js` (Express 4 não captura
  rejeição de Promise sozinho — sem isso, um erro assíncrono trava a request).
- **Multi-tenant desde a raiz**: `Task` e `Category` têm `userId` obrigatório.
  `requireAuth` middleware protege `/tasks` e `/categories` inteiros e injeta
  `req.userId`. **Toda query nova precisa filtrar por `req.userId`**, e todo
  `findById`/update/delete precisa ser `findOne({ _id, userId: req.userId })`
  — nunca `findById(id)` sozinho, senão um usuário edita/vê dado de outro.
- **Datas são sempre UTC**, nunca hora local do servidor. `utils/date.js` só
  tem helpers UTC (`toDateOnlyString`, `parseDateOnly`, `addDays`,
  `startOfWeek`, `eachDayInRange`). Um "dia de calendário" é sempre meia-noite
  UTC daquele dia — isso é proposital, ver seção de gotchas abaixo.
- **Recorrência não gera documentos**: uma `Task` com `recurrence.enabled`
  é expandida em memória por `utils/recurrence.js` (`expandTasks`) toda vez
  que `GET /tasks?start=&end=` é chamado, dentro do range pedido. O "corte de
  início" da série usa `startOfWeek(task.date)`, não o dia exato — ver gotcha.
- Autenticação: JWT **sem expiração** (proposital, é app pessoal), payload
  `{ sub: userId, username }`, sem refresh token nem 2FA. Senha com bcrypt.

## Arquitetura do frontend (`client/src/`)

```
components/   Um componente por arquivo, CSS em App.css (sem CSS modules/styled-components)
hooks/        useTasksForRange (fetch + cache simples por range)
api/          api.js: único client HTTP, gerencia token no localStorage
utils/        date.js, greeting.js, layout.js — funções puras, sem estado
```

Componentes principais e seus papéis (não duplicar lógica entre eles):
- `App.jsx` — dono de todo estado global (auth, tab ativa, focusDate,
  visibleWeekStart, modal aberto). Componentes filhos são "burros", recebem
  callbacks.
- `CalendarScroller.jsx` — scroll infinito genérico (funciona pra Semana e
  Mês), decide quando prependar/appendar período via `IntersectionObserver`,
  e reporta qual período está no topo da tela via `onVisiblePeriodChange`
  (usado pra sidebar de Metas acompanhar o scroll).
- `WeekView.jsx` / `MonthView.jsx` — só renderização de um período; cada um
  chama `useTasksForRange` internamente (não recebem tasks via prop).
- `GoalsPanel.jsx` — recebe `weekStart` já pronto (não `focusDate`); quem
  decide qual semana mostrar é sempre o chamador.
- `DensityPicker.jsx` — segmentado Dia/3 dias/Semana, só visível no mobile
  (aba Semana). Controla `dayCount` (1/3/7), estado dono é o `App.jsx`.
- `layout.js` (`layoutDayEvents`) — algoritmo de divisão de colunas pra
  tarefas com horário sobreposto (mesmo princípio do Google Calendar:
  clusters de sobreposição, cada tarefa vira `{ col, totalCols }`).

Fluxo de auth no front: sem rotas — `isAuthenticated()` (token no
localStorage) decide se mostra `<AuthModal>` sobre o app com blur
(`.is-locked`), ou o app normal. 401 em qualquer request dispara o evento
`trilho:unauthorized` (ver `api.js`), que o `App.jsx` escuta pra deslogar.

## Marca e paleta

- Fonte: **Inter** (`@fontsource/inter`, self-hosted, pesos 400/500/600/700)
  + `font-variant-numeric: tabular-nums` global (números alinham na grade).
- Paleta neutra (tokens em `index.css`): `--bg #fafafa`, `--surface #ffffff`,
  `--border #e7e5e4`, `--text #1c1917`, `--text-dim #78716c`. Cor forte só
  vem das categorias (`categoryColor`, hex livre por categoria) — a UI em si
  é propositalmente "sem graça".
- Cor de categoria é aplicada via CSS var `--chip-color` inline + `color-mix()`
  (fundo claro = 18-20% da cor, texto/borda = 70%) — funciona pra qualquer
  hex sem precisar gerar variantes manualmente.
- Logo: `client/public/logo.svg` (colorida, 3 barras) e `logo-mono.svg`
  (mesma forma, cor sólida `--text`) — mono é usada no header do app, colorida
  no modal de auth/favicon.
- Header/marca sempre grafada **"T R I L H O"** (espaçada, letra por letra) —
  pedido explícito do usuário, não "corrigir" pra "Trilho" junto.
- Mobile-first: breakpoints do header em `App.css` (`480px`, `360px`) —
  qualquer elemento novo no header precisa ser testado nesses tamanhos.

## Gotchas e decisões não óbvias

- **Por que UTC e não hora local**: já existiu um bug real de fuso onde
  `dateKey()` no front usava getters locais (`getDate()`) sobre timestamps
  UTC-meia-noite vindos da API — pra usuário em UTC-negativo (Brasil, -3),
  isso deslocava tarefas um dia pra trás/frente dependendo da hora. Corrigido
  trocando todo `date.js` do front pra getters UTC. `today()` é a ÚNICA
  função que deliberadamente lê hora local (pra saber "que dia é hoje" pro
  usuário de verdade) — todo o resto trata datas como tokens UTC opacos.
- **Semana começa no domingo**, não segunda (`startOfWeek` em ambos os
  `date.js`). Isso também corrigiu um bug de desalinhamento no cabeçalho da
  visão Mês (que já era fixo "Dom Seg Ter...").
- **`recurrence` seriesStart usa início de semana, não o dia exato** — criar
  uma tarefa "repete seg/qua/sex" numa quinta não deve esconder o
  segunda/quarta daquela mesma semana. Ver `server/src/utils/recurrence.js`.
- **Editar/excluir "somente esta ocorrência" de uma série usa o padrão de
  exceção do Google Calendar**: a data vai pra `recurrence.excludedDates` da
  série (some da expansão) e, se foi uma edição (não exclusão), nasce uma
  Task avulsa nova (`recurrence.enabled: false`) só com aquela data — ela não
  tem mais nenhum vínculo com a série original. `PUT /tasks/:id` aceita
  `{ scope: 'single', occurrenceDate }` pra isso; `DELETE` aceita os mesmos
  dois campos como query string. Editar a série inteira (`scope` omitido ou
  `'series'`) **precisa preservar** `excludedDates` ao sobrescrever
  `recurrence` — nunca substituir o objeto sem copiar esse array.
- **Densidade mobile da semana (Dia/3 dias/Semana)**: `WeekView` recebe
  `dayCount` (1, 3 ou 7) e usa `getDays`/`formatDaysRangeLabel` genéricos em
  vez dos antigos `getWeekDays`/`formatWeekRangeLabel` (que continuam existindo,
  só que agora são casos particulares com `count=7` — `GoalsPanel` ainda usa a
  versão de semana cheia, sem `dayCount`, porque metas continuam sempre por
  semana). `CalendarScroller` também depende de `dayCount`: com 7 dias o passo
  do scroll infinito continua ancorado no domingo (`startOfWeek`); com 1 ou 3
  dias o passo **não alinha com a semana** — pula exatamente `dayCount` dias a
  partir do dia focado (decisão explícita do usuário, não "consertar" achando
  que devia fatiar a semana em blocos fixos). O grid CSS usa a var
  `--day-count` (setada inline em `.week-block`) em vez de `repeat(7, 1fr)`
  fixo. A escolha do usuário fica em `localStorage` (`trilho:calendarDensity`)
  e o seletor (`DensityPicker`) some no desktop via o mesmo breakpoint de
  900px que já escondia a aba Metas mobile.
- **`username` nunca é digitado**, é sempre `slugify(name)` calculado no
  backend (nunca confiar em slug vindo do client). Front só faz preview via
  `GET /auth/slug-availability`.
- **Goals (`isGoal: true`) ficam presas na semana em que a `date` cai** —
  decisão explícita do usuário: se não concluída, não rola pra semana
  seguinte automaticamente. Não "consertar" isso sem confirmar.
- **`.env` tem segredos reais** (Mongo Atlas + JWT secret) — nunca commitar,
  já está no `.gitignore` em `server/`, `client/` e na raiz.
- **App está em produção de verdade**: cliente na Vercel (`trilho.me`), API no
  Railway, mesmo cluster MongoDB Atlas. `DB_NAME` local é **`trilho_dev`**,
  produção usa **`trilho`** — nunca rodar dev local com `DB_NAME=trilho`. Isso
  já aconteceu uma vez (contas de teste criadas via automação local apareceram
  no banco de produção) — mantenha esses dois sempre diferentes.
