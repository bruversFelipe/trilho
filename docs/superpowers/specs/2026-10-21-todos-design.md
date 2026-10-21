# ToDos rápidos na visão Semana

## Problema

Pra anotar algo rápido no dia (estilo Asana: clicar na coluna do dia e digitar),
hoje é preciso criar uma tarefa "dia todo" pelo modal completo. E a faixa de
"dia todo" estica a altura de todas as colunas conforme a coluna mais cheia.

## Decisões

- **ToDo é uma `Task` com `isTodo: true`** (mesmo padrão do `isGoal`), sem
  model nem rotas novas.
- O servidor normaliza: `isTodo` força `allDay: true`, `startTime/endTime: null`,
  `isGoal: false` e recorrência desligada.
- **Sem "atrasado"**: o ToDo fica no dia em que foi criado, sem destaque se
  passar. Pra jogar pra frente, o usuário troca a data no modal.
- Campos editáveis: título, descrição, categoria e data. Sem horário, sem
  recorrência, sem meta.

## UI

- **Faixa do topo da semana** (a mesma do "dia todo"): primeiro os chips
  "dia todo", depois os ToDos em ordem de criação. O limite de **3 itens
  visíveis** vale pra soma dos dois; além disso aparece "+N mais", que expande
  só aquela coluna (com "mostrar menos" pra recolher).
- Toda coluna termina em **"+ todo"**, que vira um input inline:
  - Enter salva e mantém o input aberto (pra anotar vários em sequência).
  - Esc, ou sair do campo vazio, fecha o input. Sair do campo com texto salva.
  - No desktop o "+ todo" só aparece ao passar o mouse na faixa (com o espaço
    já reservado, pra não dar pulo); no touch fica sempre visível.
- **Visual do ToDo**: checkbox quadrado sempre visível + título. Concluído =
  riscado e cinza. Com categoria, a borda do checkbox usa a cor dela; sem
  categoria, cinza neutro. Clique no título abre o modal; botão direito conclui.
- **Modal**: o `TaskModal` em modo ToDo mostra só título, descrição, categoria
  e data.
- **Mês**: os ToDos entram nas bolinhas como qualquer tarefa. **Tempo
  agendado**: fica de fora, porque já ignora `allDay`.

## Verificação

Lint + build do client e teste manual no navegador contra `trilho_dev`: criar
vários ToDos em sequência, concluir, "+N mais"/"mostrar menos", editar a data
pelo modal.
