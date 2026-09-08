# Trilho

Organizador pessoal semanal por horário (estilo agenda), com metas da semana,
categorias coloridas e tarefas recorrentes. Substitui o uso do Asana para
organização pessoal. Multiusuário: cada conta só acessa suas próprias tarefas
e categorias.

- **/server** — API em Node.js (Express) + MongoDB (Mongoose)
- **/client** — Front-end em React + Vite, mobile-first

## Como rodar

Precisa do Node.js instalado. O banco já está configurado (MongoDB Atlas) via `.env`.

### 1. Backend

```bash
cd server
npm install
npm run dev    # http://localhost:4000
```

`server/.env` guarda `MONGODB_URI`, `DB_NAME` e `JWT_SECRET`. **Nunca commite esse
arquivo** — já está no `.gitignore`. Use `server/.env.example` como referência
(gere um `JWT_SECRET` novo por ambiente, ex.: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).

### 2. Frontend

Em outro terminal:

```bash
cd client
npm install
npm run dev    # http://localhost:5173
```

O front aponta para a API via `client/.env` (`VITE_API_URL=http://localhost:4000`).

Abra `http://localhost:5173` no navegador (ou no celular, na mesma rede, usando
`npm run dev -- --host`). Na primeira vez, crie uma conta com seu nome + uma
senha — isso já cria 2 categorias e 2 compromissos de exemplo na semana atual.

## Conta e autenticação

- No cadastro você digita seu **nome**; o backend deriva um **usuário (slug)**
  a partir dele (minúsculo, sem espaço/acento, ex.: "Ana Souza" → `ana-souza`)
  — não dá pra editar esse slug diretamente. O front checa em tempo real se
  está disponível (`GET /auth/slug-availability?name=...`) e mostra o usuário
  final antes de você confirmar; se já existir, pede pra tentar outro nome.
- No login, você usa esse usuário (slug) + senha. Sem e-mail, sem 2FA.
- Autenticação via **JWT sem expiração**, guardado no `localStorage` do
  navegador — a sessão não vence sozinha, só ao clicar em "Sair".
- Toda `Task` e `Category` pertence a um `userId`; todas as rotas de
  `/tasks` e `/categories` exigem o token e filtram só pelos dados do dono.
- Sem conta logada, o calendário aparece desfocado atrás de um modal
  obrigatório de entrar/criar conta.

## Conceitos do produto

- **Tarefas com horário**: aparecem posicionadas na grade semanal (como Google
  Calendar), no dia e horário certos. Tarefas no mesmo horário dividem a
  largura da coluna lado a lado, em vez de se sobrepor.
- **Tarefas recorrentes**: marque os dias da semana em que se repetem
  (ex.: seg/qua/sex). As ocorrências futuras são calculadas pelo backend a
  partir de uma única regra — não criam documentos duplicados no banco.
- **Metas da semana**: tarefas sem horário fixo. Em telas largas (desktop)
  aparecem numa barra lateral fixa; no mobile, numa aba própria.
- **Categorias**: nome + cor, criadas automaticamente ao digitar um nome novo
  no formulário de tarefa (ou reaproveitadas se já existirem).

## Endpoints da API

| Método | Rota                          | Auth | Descrição                                             |
|--------|-------------------------------|:----:|--------------------------------------------------------|
| GET    | `/auth/slug-availability?name=` | não | Deriva o slug de um nome e diz se esta disponivel        |
| POST   | `/auth/register`              | não  | Cria conta (`{ name, password }`), já com dados de exemplo |
| POST   | `/auth/login`                 | não  | Login (`{ username, password }`), retorna `{ token, user }` |
| GET    | `/categories`                 | sim  | Lista categorias do usuário logado                      |
| POST   | `/categories`                 | sim  | Cria categoria (`{ name, color }`)                       |
| GET    | `/tasks?start=&end=`          | sim  | Lista tarefas do usuário no período, já expandindo recorrências |
| POST   | `/tasks`                      | sim  | Cria tarefa                                              |
| PUT    | `/tasks/:id`                  | sim  | Edita tarefa (a série inteira, se recorrente)            |
| DELETE | `/tasks/:id`                  | sim  | Remove tarefa                                            |
| PATCH  | `/tasks/:id/complete`         | sim  | Marca/desmarca conclusão (`{ date }` para ocorrência específica) |

Rotas com "Auth: sim" exigem `Authorization: Bearer <token>` e só enxergam
dados do próprio usuário (tentar editar/excluir uma tarefa de outra conta
retorna 404).

## Estrutura

```
trilho/
├── server/          API Express + Mongoose
│   └── src/
│       ├── models/       User, Task, Category
│       ├── controllers/  regras de negócio (auth, find-or-create categoria, expansão de recorrência)
│       ├── middleware/    requireAuth (JWT)
│       ├── routes/
│       └── utils/        recorrência, datas, dados de exemplo no cadastro
└── client/          React + Vite
    └── src/
        ├── components/   CalendarScroller, WeekView, MonthView, GoalsPanel, TaskModal, AuthModal
        ├── hooks/         useTasksForRange
        ├── api/           cliente HTTP (token, auth, endpoints)
        └── utils/         helpers de data, layout de eventos sobrepostos
```
