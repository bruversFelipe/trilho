# Arrastar e soltar tarefas na visão Semana

## Problema

Pra mudar o horário ou o dia de uma tarefa hoje é preciso abrir o modal,
trocar data/hora e salvar. O usuário quer reagendar só clicando e arrastando o
bloco na grade, como no Google Calendar — no desktop e no celular.

## Decisões (do usuário)

- **Escopo do arraste = o que está na tela**: os 7 dias da semana no desktop,
  ou os 1/3/7 dias da densidade escolhida no celular. **Não salta semanas.**
- **O que arrasta**:
  - Tarefas com horário: vertical muda horário, horizontal muda dia.
  - Chips "dia todo" e **ToDos** da faixa do topo: só mudam de dia, ficam na
    faixa (não viram tarefa com horário, e tarefa com horário não vira "dia
    todo").
- **Snap de 15 min** enquanto arrasta. **Duração se mantém.** Redimensionar
  (puxar a borda pra mudar duração) fica pra depois.
- **Recorrentes**: arrastar move **só aquela ocorrência**, sem perguntar — usa o
  contrato existente `PUT /tasks/:id` com `scope: 'single'` + `occurrenceDate`.
  Mudar a série inteira continua sendo pelo modal.
- **Desktop**: o arraste só começa depois de mover alguns pixels; clique simples
  continua abrindo o modal. Botão direito continua concluindo.
- **Celular**: toque longo (~450ms) pega a tarefa; toque rápido abre o modal;
  deslizar sem segurar continua rolando a tela.
- **Conflito resolvido**: no Android o toque longo hoje dispara `contextmenu`,
  que conclui a tarefa. Passa a iniciar o arraste. Em compensação, em telas de
  toque (`hover: none`) **a bolinha de concluir fica sempre visível** nos
  blocos com horário e nos chips "dia todo" (ToDos já têm o checkbox sempre
  visível). Desktop não muda.
- **Tem que ser acessível e suave** (detalhes abaixo).

## Abordagens consideradas

- **A. Arraste próprio com Pointer Events, sem biblioteca — escolhida.** A grade
  já converte minutos ↔ pixels (`ROW_HEIGHT`), então dia/horário saem da
  posição do ponteiro direto. Mouse e toque no mesmo código. Sem dependência
  nova.
- **B. Drag and drop nativo do HTML (`draggable`)**: descartada — não funciona
  direito no toque e não dá pra mostrar o encaixe de 15 min durante o arraste.
- **C. `@dnd-kit`**: descartada — é feita pra listas/zonas de soltar; o snap de
  horário e o teclado numa grade de tempo teriam que ser escritos por cima de
  qualquer jeito, e seria a primeira dependência de UI do projeto.

## Comportamento

### Suavidade

- O bloco segue o ponteiro de forma contínua (CSS `transform` atualizado via
  `requestAnimationFrame`, **sem re-render do React a cada pixel**), levemente
  "levantado" (sombra + escala ~1.02). O original fica esmaecido no lugar.
  O ponto onde o bloco foi agarrado é mantido (o bloco não "pula" pro cursor).
- Um **contorno tracejado** mostra onde a tarefa vai cair, encaixando de 15 em
  15 min (esse sim é estado React, mas só muda quando o encaixe muda).
- Ao soltar, o bloco desliza até o encaixe e **fica lá na hora**
  (atualização otimista); não volta pro lugar antigo enquanto a API responde.
  Se der erro, volta pro lugar original e avisa.
- **Auto-scroll**: arrastando perto da borda de cima (logo abaixo do cabeçalho
  fixo) ou de baixo do `.calendar-scroller`, a grade rola sozinha, limitada à
  grade daquela semana.
- `prefers-reduced-motion`: sem animações de deslizar/levantar.
- Celular: vibração curta (`navigator.vibrate`, onde existir) ao pegar.

### Acessibilidade

- **Teclado**: com o bloco focado (Tab), setas ↑↓ = ±15 min, ←→ = ±1 dia
  (dentro dos dias visíveis). Mostra a mesma prévia tracejada. **Enter
  confirma, Esc cancela**; perder o foco cancela. Sem ter mexido nas setas,
  Enter continua abrindo o modal. Itens da faixa do topo só respondem a ←→.
- **Leitor de tela**: região `aria-live` anuncia cada passo ("Academia,
  quarta, 10:15") e o resultado ("Movida para quarta, 10:15" / "Movimento
  cancelado"). Cada bloco tem `aria-describedby` com a instrução curta.
- O foco continua na tarefa depois de mover.
- O modal segue como alternativa sem arrastar (WCAG 2.5.7).

### Limites e casos de borda

- Horário fica dentro do dia: início ≥ 00:00 e fim ≤ 23:59 (o início é limitado
  pra a duração caber). Tarefa sem `endTime` move só o `startTime` (continua
  sem fim definido, desenhada com 1h como hoje).
- Soltar no mesmo lugar = nada acontece, sem request.
- Depois de um arraste, o clique que o navegador dispara ao soltar **não** abre
  o modal.
- Metas (`isGoal`) não aparecem na grade, então não entram nisso.

## Onde mexe

- **Front** (`client/`): `WeekView.jsx` (arraste, prévia, região de anúncio,
  sobrescrita otimista), `App.jsx` (`handleMoveTask`: payload simples
  `{ date, startTime, endTime }` pra tarefa avulsa, payload completo + `scope:
  'single'` pra ocorrência de recorrente), `App.css`. Lógica pura (snap,
  limites, ponteiro → dia/minuto, texto do anúncio) em `utils/`, e a máquina
  de estados do ponteiro/teclado num hook em `hooks/` pra não inchar o
  `WeekView`. Atualizar `client/CLAUDE.md` com a feature.
- **Back** (`server/`): uma linha em `detachOccurrence` pra respeitar
  `body.completed` — hoje destacar uma ocorrência concluída (pelo modal ou pelo
  arraste) cria a avulsa como não concluída. *(Decisão minha, não discutida.)*

## Fica a critério de quem implementa

Nomes de arquivos/funções, duração exata das transições, tamanho da zona de
auto-scroll, tolerância de movimento antes de começar (sugestão: 4px mouse,
8px toque antes do toque longo).

## Verificação

Lint + build do client e teste manual no navegador contra `trilho_dev`:
arrastar com mouse (horário, dia, dia+horário, borda do dia, auto-scroll,
soltar no mesmo lugar, clique ainda abre modal), recorrente (só aquele dia
muda), faixa do topo (chip e ToDo), teclado (setas/Enter/Esc/blur) com
anúncios, e emulação de toque no DevTools nas densidades 1/3/7 (toque longo
arrasta, toque rápido abre, deslizar rola, bolinha de concluir visível).
