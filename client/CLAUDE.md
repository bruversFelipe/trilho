# Trilho — client/

Ver `../CLAUDE.md` primeiro (modelo de datas, contrato de auth, contrato da
API de recorrência, infra) — este arquivo é só o que é específico da
implementação do frontend.

## Estrutura de pastas

```
components/   Um componente por arquivo, CSS em App.css (sem CSS modules/styled-components)
hooks/        useTasksForRange (fetch + cache simples por range)
api/          api.js: único client HTTP, gerencia token no localStorage
utils/        date.js, greeting.js, layout.js — funções puras, sem estado
```

## Componentes principais e seus papéis

**Antes de criar um componente novo, confira essa lista — é bem provável que
a lógica que você precisa já exista em algum desses.** Não duplicar lógica
entre eles.

- `App.jsx` — dono de todo estado global (auth, tab ativa, focusDate,
  visibleWeekStart, dayCount, modal aberto). Componentes filhos são "burros",
  recebem callbacks.
- `CalendarScroller.jsx` — scroll infinito genérico (funciona pra Semana e
  Mês), decide quando prependar/appendar período via `IntersectionObserver`,
  e reporta qual período está no topo da tela via `onVisiblePeriodChange`
  (usado pra sidebar de Metas acompanhar o scroll). Passo e âncora do scroll
  dependem de `dayCount` em modo semana — ver seção de densidade abaixo.
- `WeekView.jsx` / `MonthView.jsx` — só renderização de um período; cada um
  chama `useTasksForRange` internamente (não recebem tasks via prop).
  `WeekView` aceita `dayCount` (1/3/7 dias, default 7).
- `GoalsPanel.jsx` — recebe `weekStart` já pronto (não `focusDate`); quem
  decide qual semana mostrar é sempre o chamador. Sempre semana cheia,
  independente do `dayCount` do calendário (metas não têm "modo dia").
- `DensityPicker.jsx` — segmentado Dia/3 dias/Semana, só visível no mobile
  (aba Semana, escondido em telas ≥900px). Controla `dayCount`, estado dono é
  o `App.jsx`, persistido em `localStorage` (`trilho:calendarDensity`).
- `TaskModal.jsx` — form de criar/editar tarefa ou meta; quando edita uma
  ocorrência de série recorrente, mostra o seletor "somente este dia / toda a
  série" (`editScope`) que decide se o payload leva `scope`/`occurrenceDate`.
- `layout.js` (`layoutDayEvents`) — algoritmo de divisão de colunas pra
  tarefas com horário sobreposto (mesmo princípio do Google Calendar:
  clusters de sobreposição, cada tarefa vira `{ col, totalCols }`).
- `date.js` — `getDays(start, count)` e `getWeekDays` (caso particular,
  `count=7`); `formatDaysRangeLabel`/`formatWeekRangeLabel` no mesmo padrão.

## Fluxo de auth no front

Sem rotas — `isAuthenticated()` (token no localStorage) decide se mostra
`<AuthModal>` sobre o app com blur (`.is-locked`), ou o app normal. 401 em
qualquer request dispara o evento `trilho:unauthorized` (ver `api.js`), que o
`App.jsx` escuta pra deslogar.

## Marca e paleta (design system)

- Fonte: **Inter** (`@fontsource/inter`, self-hosted, pesos 400/500/600/700)
  + `font-variant-numeric: tabular-nums` global (números alinham na grade).
- Paleta neutra (tokens em `index.css`): `--bg #fafafa`, `--surface #ffffff`,
  `--border #e7e5e4`, `--text #1c1917`, `--text-dim #78716c`. Cor forte só
  vem das categorias (`categoryColor`, hex livre por categoria) — a UI em si
  é propositalmente "sem graça".
- Cor de categoria é aplicada via CSS var `--chip-color` inline +
  `color-mix()` (fundo claro = 18-20% da cor, texto/borda = 70%) — funciona
  pra qualquer hex sem precisar gerar variantes manualmente.
- Logo: `client/public/logo.svg` (colorida, 3 barras) e `logo-mono.svg`
  (mesma forma, cor sólida `--text`) — mono é usada no header do app,
  colorida no modal de auth/favicon.
- Header/marca sempre grafada **"T R I L H O"** (espaçada, letra por letra) —
  pedido explícito do usuário, não "corrigir" pra "Trilho" junto.
- Mobile-first: breakpoints do header em `App.css` (`480px`, `360px`) —
  qualquer elemento novo no header precisa ser testado nesses tamanhos.
  Breakpoint mobile-vs-desktop geral do app é `900px` (painel de Metas vira
  sidebar fixa, `DensityPicker` some).
- Segmentados (grupo de botões tipo toggle) seguem sempre o mesmo padrão
  visual: `.weekday-chip`, `.edit-scope-option`, `.density-option` — mesma
  estrutura de CSS (`is-active` = fundo `--text`, texto `--surface`). Reusar
  essa classe-base em vez de inventar um estilo novo pra outro seletor.

## Densidade mobile da semana (Dia/3 dias/Semana)

`WeekView` recebe `dayCount` (1, 3 ou 7) e usa `getDays`/`formatDaysRangeLabel`
genéricos. `CalendarScroller` também depende de `dayCount`: com 7 dias o
passo do scroll infinito continua ancorado no domingo (`startOfWeek`); com 1
ou 3 dias o passo **não alinha com a semana** — pula exatamente `dayCount`
dias a partir do dia focado (decisão explícita do usuário, não "consertar"
achando que devia fatiar a semana em blocos fixos). O grid CSS usa a var
`--day-count` (setada inline em `.week-block`) em vez de `repeat(7, 1fr)`
fixo.
