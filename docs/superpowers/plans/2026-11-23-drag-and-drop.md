# Arrastar e soltar tarefas — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reagendar tarefas na visão Semana arrastando com mouse, toque longo ou
teclado, dentro dos dias visíveis, com encaixe de 15 min, movimento suave e
anúncios pra leitor de tela.

**Architecture:** Arraste próprio com Pointer Events, sem biblioteca. A matemática
pura (snap, limites, ponteiro → dia, patch, textos) fica em `utils/drag.js`,
testada com `node:test`. A máquina de estados (ponteiro, toque, teclado,
otimista, foco) fica no hook `hooks/useTaskDrag.js`, e o `WeekView` só liga
os handlers e desenha a prévia. O `App.jsx` salva via `PUT /tasks/:id`, usando o
contrato `scope: 'single'` pra ocorrência de recorrente.

**Tech Stack:** React 19 + Vite 8 (client), Express + Mongoose (server), `node --test` (Node 24, embutido).

**Spec:** `docs/superpowers/specs/2026-11-23-drag-and-drop-design.md`

## Global Constraints

- Trabalhar no branch `feat/drag-and-drop` (criado a partir de `main` antes da Task 1). Um commit por task.
- **Nenhuma dependência nova** (nem dev): testes usam `node:test` + `node:assert/strict`.
- Arraste limitado aos dias do próprio `WeekView` (`days`); **não salta semanas**.
- Snap de **15 min**; duração preservada; início ≥ 00:00 e fim ≤ 23:59.
- Toque longo **450ms**; tolerância **4px** (mouse, antes de começar) e **8px** (toque, antes do toque longo disparar).
- Recorrente: move **só aquela ocorrência** — `scope: 'single'` + `occurrenceDate: dateKey(task.date)`, com payload completo (o servidor cria a avulsa a partir do body).
- Datas sempre como tokens UTC (`dateKey`, getters UTC) — ver `CLAUDE.md` raiz. Nunca getters locais.
- Dev local só com `DB_NAME=trilho_dev` (já é o valor de `server/.env` — confirmar antes de subir o server).
- CSS em `client/src/App.css`; um componente por arquivo; reusar tokens de `index.css`.
- Textos falados (aria-live) em pt-BR **com acento** ("terça", "sábado") — é pra pronúncia; o resto da UI segue como está.

## Review Focus

- **Bolinha/checkbox de concluir** (`.task-check`, `.chip-check`, `.todo-check`): clicar ou tocar deve continuar só concluindo, nunca iniciar arraste nem abrir modal. → verificação manual nas Tasks 2, 3 e 4.
- **Clique com tremida < 4px**: deve abrir o modal normalmente, não ser engolido como "fim de arraste". → Task 2.
- **Dois arrastes seguidos antes do refetch** (ou refetch de outro `bump()` chegando no meio): nenhum bloco volta pro lugar antigo; só entradas otimistas já confirmadas são limpas. → teste de `applyPendingMoves` na Task 1 + verificação manual na Task 2.
- **Ocorrência recorrente concluída arrastada**: continua concluída no dia novo, e a série não ganha "concluída" em outro dia. → Task 2.
- **Densidade "Dia" (1 coluna) e soltar além da última coluna**: horizontal não faz nada / prende na última coluna visível. → testes de `pickDayIndex` na Task 1 + verificação manual na Task 4.

---

### Task 1: Matemática pura do arraste + runner de testes

**Files:**
- Modify: `client/src/utils/date.js` (adicionar `minutesToTime`)
- Modify: `client/src/components/WeekView.jsx:24-28` (remover a cópia local de `minutesToTime` e importar de `date.js`)
- Create: `client/src/utils/drag.js`
- Test: `client/src/utils/drag.test.js`
- Modify: `client/package.json` (script `test`)

**Interfaces:**
- Produces (`utils/date.js`):
  - `minutesToTime(totalMinutes: number) -> string` — `'HH:MM'`, mesmo corpo da função que hoje está no `WeekView`.
- Produces (`utils/drag.js`):
  - `DRAG_SNAP_MINUTES = 15`, `LAST_MINUTE = 1439`, `MOVE_CANCELLED = 'Movimento cancelado'`
  - `dragKind(task) -> 'timed' | 'strip'` — `'timed'` sse `task.startTime && !task.allDay && !task.isTodo` (mesma regra de `byDay` no `WeekView`).
  - `taskSpan(task) -> { start: number, duration: number, hasEnd: boolean }` — `start = timeToMinutes(startTime) ?? 0`; `duration = hasEnd ? max(0, end - start) : 0`.
  - `snapAndClampStart(rawStart: number, duration: number) -> number` — arredonda pro múltiplo de 15 mais próximo, depois prende em `[0, LAST_MINUTE - duration]`.
  - `pickDayIndex(clientX: number, columns: Array<{left: number, right: number}>) -> number` — coluna que contém `x`; antes da primeira → `0`; depois da última → `columns.length - 1`.
  - `stepKeyboardTarget(target: {dayIndex, startMin}, key: string, opts: {kind, duration, dayCount}) -> {dayIndex, startMin} | null` — `ArrowUp/Down` = ∓/±15 via `snapAndClampStart` (só `kind === 'timed'`); `ArrowLeft/Right` = ±1 dia preso em `[0, dayCount-1]`; qualquer outra tecla (ou ↑↓ em `'strip'`) → `null`. No limite, devolve o mesmo valor (tecla tratada, sem mudança).
  - `buildMovePatch(task, target: {date: Date, startMin: number | null}) -> { date: string, startTime?: string, endTime?: string | null } | null` — `'timed'`: `{ date, startTime, endTime }` (`endTime: null` se a tarefa não tem fim); `'strip'`: `{ date }`. `null` quando não muda nada.
  - `applyPendingMoves(tasks: Task[], pending: Map<string, patch>) -> Task[]` — devolve cópias com `date` (como `new Date(patch.date)`), `startTime`, `endTime` sobrescritos para os `occurrenceId` presentes no Map; tarefas fora do Map passam pela mesma referência.
  - `describeTarget(task, date: Date, startMin: number | null) -> string` — `"Academia, quarta, 10:15"` / `"Academia, quarta"`.
  - `describeDrop(task, date: Date, startMin: number | null) -> string` — `"Movida para quarta, 10:15"`; ToDo usa `"Movido"`.
  - `autoScrollDelta(pointerY: number, topEdge: number, bottomEdge: number, zone = 48, maxSpeed = 16) -> number` — px por frame: negativo perto/acima do topo, positivo perto/abaixo do fundo, linear dentro da zona, `0` no meio.
  - Dias da semana falados: `['domingo','segunda','terça','quarta','quinta','sexta','sábado']`.

- [ ] **Step 1: Criar o branch**

Run: `git checkout -b feat/drag-and-drop`
Expected: `Switched to a new branch 'feat/drag-and-drop'`

- [ ] **Step 2: Escrever os testes que falham** em `client/src/utils/drag.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minutesToTime } from './date.js';
import {
  applyPendingMoves, autoScrollDelta, buildMovePatch, describeDrop, describeTarget,
  dragKind, pickDayIndex, snapAndClampStart, stepKeyboardTarget, taskSpan,
} from './drag.js';

const WED = new Date(Date.UTC(2026, 10, 25)); // quarta
const MON = new Date(Date.UTC(2026, 10, 23)); // segunda
const timed = { occurrenceId: 'a_2026-11-23', title: 'Academia', date: MON, startTime: '10:00', endTime: '11:00' };
const noEnd = { ...timed, endTime: null };
const todo = { occurrenceId: 't_2026-11-23', title: 'Ligar', date: MON, isTodo: true, allDay: true, startTime: null };
const cols = [{ left: 40, right: 100 }, { left: 100, right: 160 }, { left: 160, right: 220 }];

test('minutesToTime', () => {
  assert.equal(minutesToTime(615), '10:15');
  assert.equal(minutesToTime(0), '00:00');
});

test('dragKind / taskSpan', () => {
  assert.equal(dragKind(timed), 'timed');
  assert.equal(dragKind(todo), 'strip');
  assert.equal(dragKind({ ...timed, allDay: true }), 'strip');
  assert.deepEqual(taskSpan(timed), { start: 600, duration: 60, hasEnd: true });
  assert.deepEqual(taskSpan(noEnd), { start: 600, duration: 0, hasEnd: false });
  assert.deepEqual(taskSpan({ ...timed, endTime: '09:00' }), { start: 600, duration: 0, hasEnd: true });
});

test('snapAndClampStart', () => {
  assert.equal(snapAndClampStart(602, 60), 600);
  assert.equal(snapAndClampStart(608, 60), 615);
  assert.equal(snapAndClampStart(-20, 60), 0);
  assert.equal(snapAndClampStart(1430, 60), 1379);
  assert.equal(snapAndClampStart(1430, 0), 1425);
  assert.equal(snapAndClampStart(1438, 0), 1439);
});

test('pickDayIndex', () => {
  assert.equal(pickDayIndex(120, cols), 1);
  assert.equal(pickDayIndex(10, cols), 0);
  assert.equal(pickDayIndex(999, cols), 2);
  assert.equal(pickDayIndex(999, [cols[0]]), 0); // densidade "Dia"
});

test('stepKeyboardTarget', () => {
  const opts = { kind: 'timed', duration: 60, dayCount: 7 };
  assert.deepEqual(stepKeyboardTarget({ dayIndex: 1, startMin: 600 }, 'ArrowDown', opts), { dayIndex: 1, startMin: 615 });
  assert.deepEqual(stepKeyboardTarget({ dayIndex: 1, startMin: 600 }, 'ArrowUp', opts), { dayIndex: 1, startMin: 585 });
  assert.deepEqual(stepKeyboardTarget({ dayIndex: 0, startMin: 600 }, 'ArrowLeft', opts), { dayIndex: 0, startMin: 600 });
  assert.deepEqual(stepKeyboardTarget({ dayIndex: 6, startMin: 600 }, 'ArrowRight', opts), { dayIndex: 6, startMin: 600 });
  assert.deepEqual(stepKeyboardTarget({ dayIndex: 2, startMin: 0 }, 'ArrowUp', opts), { dayIndex: 2, startMin: 0 });
  assert.equal(stepKeyboardTarget({ dayIndex: 1, startMin: null }, 'ArrowDown', { ...opts, kind: 'strip' }), null);
  assert.equal(stepKeyboardTarget({ dayIndex: 1, startMin: 600 }, 'Enter', opts), null);
});

test('buildMovePatch', () => {
  assert.deepEqual(buildMovePatch(timed, { date: WED, startMin: 615 }), { date: '2026-11-25', startTime: '10:15', endTime: '11:15' });
  assert.deepEqual(buildMovePatch(noEnd, { date: MON, startMin: 660 }), { date: '2026-11-23', startTime: '11:00', endTime: null });
  assert.deepEqual(buildMovePatch(todo, { date: WED, startMin: null }), { date: '2026-11-25' });
  assert.equal(buildMovePatch(timed, { date: MON, startMin: 600 }), null);
  assert.equal(buildMovePatch(todo, { date: MON, startMin: null }), null);
});

test('applyPendingMoves', () => {
  const other = { occurrenceId: 'b_2026-11-23', title: 'Outra', date: MON };
  const out = applyPendingMoves([timed, other], new Map([[timed.occurrenceId, { date: '2026-11-25', startTime: '10:15', endTime: '11:15' }]]));
  assert.equal(out[0].startTime, '10:15');
  assert.equal(out[0].date.toISOString(), '2026-11-25T00:00:00.000Z');
  assert.equal(out[1], other);
  assert.equal(timed.startTime, '10:00'); // não muta o original
});

test('describeTarget / describeDrop', () => {
  assert.equal(describeTarget(timed, WED, 615), 'Academia, quarta, 10:15');
  assert.equal(describeTarget(todo, WED, null), 'Ligar, quarta');
  assert.equal(describeDrop(timed, WED, 615), 'Movida para quarta, 10:15');
  assert.equal(describeDrop(todo, WED, null), 'Movido para quarta');
});

test('autoScrollDelta', () => {
  assert.equal(autoScrollDelta(300, 100, 600), 0);
  assert.equal(autoScrollDelta(100, 100, 600), -16);
  assert.equal(autoScrollDelta(124, 100, 600), -8);
  assert.equal(autoScrollDelta(50, 100, 600), -16);
  assert.equal(autoScrollDelta(600, 100, 600), 16);
  assert.equal(autoScrollDelta(576, 100, 600), 8);
});
```

- [ ] **Step 3: Adicionar `"test": "node --test src/**/*.test.js"` em `client/package.json` e rodar**

Run (em `client/`): `npm test`
Expected: FAIL — `Cannot find module '.../drag.js'` (ou `minutesToTime` não exportado).

- [ ] **Step 4: Implementar** `minutesToTime` em `date.js` (mover do `WeekView`, que passa a importar) e todas as funções de `drag.js` conforme o bloco Interfaces. `drag.js` só importa de `./date.js`.

- [ ] **Step 5: Rodar testes, lint e build**

Run (em `client/`): `npm test && npm run lint && npm run build`
Expected: todos os testes `ok`, lint sem erros, build conclui.

- [ ] **Step 6: Commit**

```bash
git add client/package.json client/src/utils/date.js client/src/utils/drag.js client/src/utils/drag.test.js client/src/components/WeekView.jsx
git commit -m "feat: add pure drag-and-drop helpers with node:test suite"
```

---

### Task 2: Arrastar tarefas com horário usando o mouse (ponta a ponta)

**Files:**
- Create: `client/src/hooks/useTaskDrag.js`
- Modify: `client/src/components/WeekView.jsx`
- Modify: `client/src/components/CalendarScroller.jsx` (repassar `onMoveTask` pro `WeekView`, igual `onAddTodo`)
- Modify: `client/src/App.jsx` (`handleMoveTask` + prop no `CalendarScroller` de semana)
- Modify: `server/src/controllers/taskController.js` (`detachOccurrence`)
- Modify: `client/src/App.css`

**Interfaces:**
- Consumes: tudo de `utils/drag.js` (Task 1).
- Produces:
  - `App.handleMoveTask(task, patch) -> Promise<Task>` (prop `onMoveTask`). Se `task.recurrence?.enabled`: `updateTask(task._id, { title, description, date: patch.date, allDay, startTime, endTime, isGoal, isTodo, category, categoryId, categoryColor, completed, scope: 'single', occurrenceDate: dateKey(task.date) })` — campos vêm de `task`, com `startTime/endTime` do `patch` quando presentes. Senão: `updateTask(task._id, patch)`. Sucesso → `bump()` e resolve com o JSON retornado. Erro → `console.error`, `alert(err.message || 'Erro ao mover')` e **rejeita**.
  - `useTaskDrag({ days, rowHeight, tasks, rootRef, gridRef, headerRef, onMoveTask })` retorna:
    - `displayTasks: Task[]` — `applyPendingMoves(tasks, pending)`.
    - `dragState: null | { task, kind, source: 'pointer' | 'keyboard', originDayIndex, dayIndex, startMin }`
    - `getBlockProps(task, kind, dayIndex, { onContextMenu }) -> props` pro wrapper do item (`data-occurrence-id`, `onPointerDown`, `onClickCapture`, `onContextMenu`).
  - Marcações DOM que o hook lê: `.day-column` ganha `data-day-col={i}`; elementos com `data-drag-ignore` (as bolinhas/checkbox) nunca iniciam arraste.
  - `detachOccurrence` passa a gravar `completed: !!body.completed`.

- [ ] **Step 1: Servidor** — em `detachOccurrence` (`taskController.js`), adicionar `completed: !!body.completed` ao `Task.create`. Run (em `server/`): `node --check src/controllers/taskController.js` → sem saída.

- [ ] **Step 2: `App.handleMoveTask`** conforme Interfaces; passar `onMoveTask={handleMoveTask}` só no `CalendarScroller mode="week"`; `CalendarScroller` repassa `onMoveTask` pro `View`.

- [ ] **Step 3: `useTaskDrag` — núcleo do ponteiro (mouse)**. Pontos que a assinatura não determina:
  - `onPointerDown`: ignora `button !== 0` e alvos dentro de `[data-drag-ignore]`. Guarda origem (x, y, `scrollTop` do `.calendar-scroller` = `rootRef.current.closest('.calendar-scroller')`, rect do elemento, `grabOffsetMin = minutoDoPonteiro - taskSpan(task).start`). Escuta `pointermove`/`pointerup`/`pointercancel`/`keydown` (Esc) no `window` até terminar.
  - Ativa quando o movimento passa de **4px**; aí lê os rects de `[data-day-col]`, põe `body.is-task-dragging` e liga `suppressClick`.
  - A cada frame (`requestAnimationFrame`), escreve direto no elemento `transform: translate(dx, dy)` com `dy = (clientY - startY) + (scrollTopAgora - scrollTopInicial)`, pra compensar o auto-scroll. **Sem setState por pixel.** Recalcula o alvo com `pickDayIndex` + `snapAndClampStart(minutoDoPonteiro - grabOffsetMin, duration)`, onde `minutoDoPonteiro = (clientY - gridRect.top) / rowHeight * 60` com o `gridRect` relido no frame. `setDragState` **só quando o alvo muda**.
  - Auto-scroll no mesmo loop: `autoScrollDelta(clientY, headerRef.bottom, scroller.bottom)`, aplicado no `scrollTop` só enquanto a grade ainda passa da borda naquela direção (não rola pra fora da própria semana).
  - Soltar: `buildMovePatch(task, { date: days[dayIndex], startMin })`. Se `null`, anima de volta pra origem. Se não for `null`: grava o rect atual (pra FLIP), põe `pending.set(occurrenceId, { patch, settled: false })` e chama `onMoveTask`. Resolve → `settled = true`; rejeita → remove do `pending`.
  - **FLIP** num `useLayoutEffect` depois do re-render: acha `[data-occurrence-id="…"]` dentro de `rootRef`, aplica `translate(antigo - novo)` sem transição, força reflow e transiciona pra `none` em 150ms (`ease-out`). Pular se `matchMedia('(prefers-reduced-motion: reduce)')`.
  - Efeito em `tasks`: remove do `pending` só as entradas `settled`.
  - Esc durante o arraste: cancela (anima de volta, sem request).
  - `onClickCapture`: se `suppressClick`, `preventDefault` + `stopPropagation` e desliga a flag. A flag também é desligada no próximo `pointerdown`.

- [ ] **Step 4: Ligar no `WeekView`** (só tarefas com horário nesta task):
  - Refs `rootRef` (section), `headerRef` (`.week-sticky-header`), `gridRef` (`.week-grid`).
  - Passar `displayTasks` pro `byDay` no lugar de `tasks`.
  - Bloco `.task-block`: espalhar `getBlockProps(task, 'timed', i, { onContextMenu: <handler atual> })` e adicionar a classe `is-dragging` quando `dragState?.source === 'pointer'` e o `occurrenceId` bate.
  - `.task-check`: adicionar `data-drag-ignore`.
  - Na coluna de origem, enquanto arrasta com o ponteiro: `<div className="drag-origin" aria-hidden>` com `top`, `height`, `left` e `width` do bloco original.
  - Na coluna `dragState.dayIndex`: `<div className="drop-preview" aria-hidden>` com `top = startMin / 60 * ROW_HEIGHT` e altura pela mesma fórmula do bloco (sem fim = 60 min; mínimo 24px). Também leva `--chip-color`.

- [ ] **Step 5: CSS** em `App.css`:
  - `.task-block.is-dragging`: `z-index: 10`, sombra `0 8px 20px rgba(0,0,0,.18)`, `scale: 1.02`, `will-change: transform`, `cursor: grabbing`.
  - `.drag-origin`: absoluto, `border-radius: 5px`, fundo `color-mix(in srgb, var(--chip-color) 10%, white)`, `pointer-events: none`.
  - `.drop-preview`: absoluto, `left: 2px`, `right: 2px`, borda `1.5px dashed color-mix(in srgb, var(--chip-color) 70%, black)`, `border-radius: 5px`, `z-index: 3`, `pointer-events: none`, `transition: top 80ms ease-out`.
  - `body.is-task-dragging { cursor: grabbing; user-select: none; }`
  - `@media (prefers-reduced-motion: reduce)`: sem transição no `.drop-preview` e sem `scale`.

- [ ] **Step 6: Testes unitários + lint + build**

Run (em `client/`): `npm test && npm run lint && npm run build`
Expected: tudo passa.

- [ ] **Step 7: Verificação manual no navegador** (subir `server/` com `npm run dev`, confirmando `DB_NAME=trilho_dev`, e `client/` com `npm run dev`; desktop ≥ 900px):
  - [ ] Arrastar 10:00→14:15 no mesmo dia: a prévia pula de 15 em 15, o bloco segue o mouse sem pular pro cursor, encaixa suave e continua lá depois do refetch.
  - [ ] Arrastar pra outro dia, e dia + horário juntos.
  - [ ] Levar uma tarefa pra perto das 23h: o fim nunca passa de 23:59.
  - [ ] Arrastar até perto do fundo e do topo: a grade rola sozinha e para nos limites da semana.
  - [ ] Soltar no mesmo lugar ou apertar Esc: volta suave, sem request (aba Network).
  - [ ] Clique com tremida mínima (< 4px) abre o modal. Depois de um arraste de verdade, o modal não abre.
  - [ ] Bolinha `.task-check` só conclui. Botão direito continua concluindo.
  - [ ] Recorrente: arrastar a segunda-feira só move aquele dia, e as outras ocorrências ficam. Com uma ocorrência concluída, ela continua concluída no dia novo.
  - [ ] Dois arrastes seguidos e rápidos: nenhum bloco "volta" no meio.
  - [ ] Forçar um erro (parar o server e arrastar): aparece o alert e o bloco volta pra origem.

- [ ] **Step 8: Commit**

```bash
git add client/src/hooks/useTaskDrag.js client/src/components/WeekView.jsx client/src/components/CalendarScroller.jsx client/src/App.jsx client/src/App.css server/src/controllers/taskController.js
git commit -m "feat: drag timed tasks to a new time or day in the week view"
```

---

### Task 3: Arrastar "dia todo" e ToDos entre dias na faixa do topo

**Files:**
- Modify: `client/src/hooks/useTaskDrag.js`
- Modify: `client/src/components/WeekView.jsx`
- Modify: `client/src/App.css`

**Interfaces:**
- Consumes: `getBlockProps`, `dragState`, `buildMovePatch` (com `startMin: null`), `pickDayIndex`.
- Produces: `.week-allday-cell` ganha `data-strip-cell={i}`. Com `kind === 'strip'`, o hook usa os rects de `[data-strip-cell]`, ignora o eixo vertical pro alvo (o `transform` segue os dois eixos, só pelo visual) e não faz auto-scroll. O `startMin` é sempre `null`.

- [ ] **Step 1: Hook** — fazer o caminho de ponteiro do Task 2 aceitar `kind: 'strip'` conforme Interfaces. FLIP e otimista continuam iguais.

- [ ] **Step 2: `WeekView`**:
  - `.chip` e `.todo-item`: espalhar `getBlockProps(task, 'strip', i, { onContextMenu: <handler atual> })` e adicionar a classe `is-dragging`.
  - `.chip-check` e `.todo-check`: adicionar `data-drag-ignore`.
  - A célula `dragState.dayIndex` ganha a classe `is-drop-target` quando `kind === 'strip'`.
  - Um item movido pra uma coluna que já está no limite (`STRIP_LIMIT`) deve aparecer: expandir a coluna de destino com o `setDayExpanded` que já existe, igual ao `handleAddTodo`.

- [ ] **Step 3: CSS**:
  - `.chip.is-dragging` e `.todo-item.is-dragging`: `position: relative`, `z-index: 10`, mesma sombra do bloco.
  - `.week-allday-cell.is-drop-target`: fundo `color-mix(in srgb, var(--text) 6%, transparent)`, `outline: 1.5px dashed var(--text-dim)`, `border-radius: 4px`.

- [ ] **Step 4: `npm test && npm run lint && npm run build`** (em `client/`) → tudo passa.

- [ ] **Step 5: Verificação manual**:
  - [ ] Chip "dia todo" e ToDo mudam de dia e continuam na faixa.
  - [ ] Soltar em cima da grade de horários não converte o item: ele vai pro dia da coluna e continua na faixa.
  - [ ] O checkbox do ToDo e a bolinha do chip só concluem.
  - [ ] Soltar numa coluna que já está com "+N mais": a coluna expande e o item aparece.

- [ ] **Step 6: Commit**

```bash
git add client/src/hooks/useTaskDrag.js client/src/components/WeekView.jsx client/src/App.css
git commit -m "feat: drag all-day chips and todos between days"
```

---

### Task 4: Toque longo no celular

**Files:**
- Modify: `client/src/hooks/useTaskDrag.js`
- Modify: `client/src/App.css`

**Interfaces:**
- Consumes: o caminho de ponteiro das Tasks 2 e 3.
- Produces: nenhuma assinatura nova. O comportamento muda quando `pointerType !== 'mouse'`.

- [ ] **Step 1: Hook — ativação por toque**:
  - `pointerdown` de toque ou caneta inicia um timer de **450ms**.
  - Se o dedo mover mais de **8px** antes do timer, ou se chegar `pointercancel` (o navegador começou a rolar), aborta sem efeito.
  - Quando o timer dispara, ativa o mesmo arraste da Task 2 e chama `navigator.vibrate?.(10)`.
  - Trava a rolagem com **um listener permanente** de `touchmove` com `{ passive: false }` no `rootRef` (registrado no mount, removido no unmount), que só chama `preventDefault()` enquanto `touchDragActiveRef` for `true`. Precisa ser permanente: registrar só na hora não funciona de forma confiável no iOS.
  - O `onContextMenu` composto do `getBlockProps`: se o último `pointerdown` não foi de mouse, chama `preventDefault()` e **não** chama o handler de concluir. Com mouse, chama o handler como hoje.

- [ ] **Step 2: CSS**:
  - `.task-block`, `.chip` e `.todo-item`: `-webkit-touch-callout: none`, `user-select: none`, `-webkit-user-select: none`.
  - `@media (hover: none) { .task-check, .chip-check { display: flex; } }`. No desktop nada muda.

- [ ] **Step 3: `npm test && npm run lint && npm run build`** (em `client/`) → tudo passa.

- [ ] **Step 4: Verificação manual** (DevTools → emulação de dispositivo touch, largura < 900px, densidades 1/3/7):
  - [ ] Toque rápido abre o modal.
  - [ ] Deslizar sem segurar rola a tela.
  - [ ] Segurar ~0,5s pega a tarefa, e arrastar não rola a página.
  - [ ] Segurar e soltar sem mover não conclui e não abre o menu de contexto.
  - [ ] No "Dia", o arraste horizontal não muda o dia. No "3 dias", só os 3 dias visíveis.
  - [ ] As bolinhas de concluir aparecem sempre e concluem com um toque.
  - [ ] No desktop as bolinhas continuam só no hover.
  - [ ] Se houver um Android real: segurar não conclui mais.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useTaskDrag.js client/src/App.css
git commit -m "feat: long-press to drag tasks on touch screens"
```

---

### Task 5: Teclado, leitor de tela e documentação

**Files:**
- Modify: `client/src/hooks/useTaskDrag.js`
- Modify: `client/src/components/WeekView.jsx`
- Modify: `client/src/App.css`
- Modify: `client/CLAUDE.md`

**Interfaces:**
- Consumes: `stepKeyboardTarget`, `describeTarget`, `describeDrop`, `MOVE_CANCELLED`, `buildMovePatch`, o caminho de commit (otimista + `onMoveTask`) da Task 2.
- Produces (somados ao retorno do hook):
  - `announcement: string` — texto atual da região `aria-live`.
  - `hintId: string` — id do texto de instrução (via `useId`).
  - `getHandleProps(task, kind, dayIndex) -> { 'data-drag-focus': occurrenceId, 'aria-describedby': hintId, onKeyDown, onBlur }` — vai no botão focável do item: `.task-block-body`, `.chip-body` ou `.todo-body`.

- [ ] **Step 1: Hook — teclado**:
  - `onKeyDown` com uma seta, sem Alt/Ctrl/Meta: chama `stepKeyboardTarget`. Se a seta foi tratada (`!== null`), faz `preventDefault()` (pra não rolar a tela), inicia ou atualiza `dragState` com `source: 'keyboard'` e anuncia `describeTarget`.
  - Enter com `source: 'keyboard'` ativo: `preventDefault()` (pra não abrir o modal) e commit pelo mesmo caminho de soltar, que anuncia `describeDrop`.
  - Esc: cancela e anuncia `MOVE_CANCELLED`.
  - `onBlur` com teclado ativo: cancela.
  - Enter sem ter mexido nas setas: não intercepta, e o modal abre como hoje.

- [ ] **Step 2: Hook — foco e anúncio do ponteiro**:
  - No commit por teclado, guarda `pendingFocusId = occurrenceId` antigo. Quando o `onMoveTask` resolver, troca pra `` `${saved._id}_${patch.date}` ``, porque o `occurrenceId` muda com a data e o detach cria um `_id` novo.
  - Um `useLayoutEffect` sem deps foca `[data-drag-focus="…"]` dentro do `rootRef` quando ele existir e não estiver focado, e depois limpa o `pendingFocusId`.
  - Soltar com o ponteiro também anuncia `describeDrop`.

- [ ] **Step 3: `WeekView`**:
  - `getHandleProps` nos três botões de corpo.
  - Uma vez por `WeekView`: `<div className="sr-only" aria-live="polite">{announcement}</div>` e `<span id={hintId} className="sr-only">Use as setas para mover, Enter para confirmar e Esc para cancelar.</span>`.
  - A prévia (`.drop-preview` e `.is-drop-target`) também aparece com `source: 'keyboard'`. O bloco original fica onde está, sem `is-dragging`.

- [ ] **Step 4: CSS**:
  - `.sr-only` no padrão de esconder só visualmente (`position: absolute`, `width/height: 1px`, `overflow: hidden`, `clip-path: inset(50%)`, `white-space: nowrap`).
  - `.task-block-body:focus-visible`, `.chip-body:focus-visible` e `.todo-body:focus-visible`: `outline: 2px solid var(--text)`, `outline-offset: -2px` (o pai tem `overflow: hidden`).

- [ ] **Step 5: `client/CLAUDE.md`**:
  - Na lista de componentes, adicionar `useTaskDrag.js` e `utils/drag.js`: o que cada um faz, as decisões do spec (só dias visíveis, 15 min, recorrente = só esse dia, toque longo 450ms, bolinha sempre visível em `hover: none`, teclado setas/Enter/Esc) e o motivo do listener `touchmove` permanente.
  - Registrar `npm test` (`node:test`) como o runner de testes puros do client.

- [ ] **Step 6: `npm test && npm run lint && npm run build`** (em `client/`) → tudo passa.

- [ ] **Step 7: Verificação manual**:
  - [ ] Tab até um bloco: ↓↓ mostra a prévia em +30 min.
  - [ ] ← muda o dia e não passa do primeiro dia visível.
  - [ ] Enter salva e o foco continua no bloco, inclusive depois do refetch e numa recorrente.
  - [ ] Esc cancela.
  - [ ] Tab pra fora cancela.
  - [ ] Enter sem setas abre o modal.
  - [ ] Na faixa do topo, ↑↓ não fazem nada e rolam normalmente.
  - [ ] Com leitor de tela (NVDA ou Narrador): ouve "Academia, quarta, 10:15" a cada passo, "Movida para…" ao confirmar e "Movimento cancelado" ao cancelar. A instrução é lida ao focar o bloco.
  - [ ] Releitura final da matriz das Tasks 2–4 depois de tudo junto.

- [ ] **Step 8: Commit**

```bash
git add client/src/hooks/useTaskDrag.js client/src/components/WeekView.jsx client/src/App.css client/CLAUDE.md
git commit -m "feat: keyboard and screen-reader support for moving tasks"
```
