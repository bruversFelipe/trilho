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
front).

## Metas ficam presas na semana em que foram criadas

`isGoal: true` — decisão explícita do usuário: se não concluída, não rola pra
semana seguinte automaticamente. Não "consertar" isso sem confirmar antes.

## Infra e produção

- **App está em produção de verdade**: cliente na Vercel (`trilho.me`), API
  no Railway, mesmo cluster MongoDB Atlas. `DB_NAME` local é **`trilho_dev`**,
  produção usa **`trilho`** — nunca rodar dev local com `DB_NAME=trilho`. Isso
  já aconteceu uma vez (contas de teste criadas via automação local
  apareceram no banco de produção) — mantenha esses dois sempre diferentes.
- `.env` tem segredos reais (Mongo Atlas + JWT secret) — nunca commitar, já
  está no `.gitignore` em `server/`, `client/` e na raiz.
