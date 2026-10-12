# AGENTS.md

Context for coding agents working on Courtly: a sports court booking app
(NestJS API, React web, PostgreSQL, shared Zod contracts) built as a take-home
challenge. The author must be able to defend every line in a live interview,
so prefer the plain solution over the clever one, and never add anything the
task did not ask for.

Read [ARCHITECTURE.md](./ARCHITECTURE.md) before structural work. It records
why, not only what. Read [SECURITY.md](./SECURITY.md) before touching auth,
users, environment config or anything that returns user data.

## Non-negotiable rules

These are constraints, not suggestions. If a task seems to require breaking
one, stop and ask.

1. **The database prevents double bookings.** The `booking_no_overlap`
   exclusion constraint is the guarantee. Never remove, weaken or bypass it,
   and never rely on a check-then-insert in application code. A pre-check may
   exist only to return a friendlier message.
2. **Authorization is enforced in the API.** Every route is authenticated
   unless marked `@Public()`. Admin routes carry `@Roles('ADMIN')`. Hiding a
   button in the web app is not enforcement.
3. **Identity comes from the token, everything else from the database.** The
   acting user is the token's `sub`; the user and role are loaded from the
   database on each request. Never take a user id or role from a request body,
   query or param for an authorization decision. A user's bookings are always
   queried by id and owner together.
4. **All time logic lives in the API.** Use Luxon with `FACILITY_TIMEZONE`.
   Read "now" only from the injected `Clock`: no `new Date()`, `Date.now()` or
   `DateTime.now()` outside the clock implementation. The web app formats
   instants in the facility zone and does no time arithmetic.
5. **Timestamps are `timestamptz`; money is integer cents.** Every `DateTime`
   column has `@db.Timestamptz(3)`. No floats or decimals for prices.
6. **Request and response shapes are defined once, in `@courtly/contracts`.**
   The API validates with those Zod schemas and the web app infers its types
   from them. Do not hand-write a duplicate type on either side.
7. **Invariants in the database, policy in services.** Follow the table in
   ARCHITECTURE.md, "Invariants and policy". Controllers hold no business
   rules and never call Prisma.
8. **Nothing is deleted.** Courts are deactivated with `isActive`; bookings
   are cancelled with `cancelledAt`. Foreign keys stay `onDelete: Restrict`.
9. **Secrets come from validated environment.** Environment variables are
   parsed with Zod at boot and the process must exit when one is missing. No
   secret has a default in code. `passwordHash` never appears in a response,
   a contract or a log line.
10. **TypeScript strict, no escape hatches.** No `any`, `as any`,
    `@ts-ignore`, `@ts-expect-error` or `eslint-disable` without a comment
    saying why it is unavoidable.
11. **Dependencies are pinned and deliberate.** Exact versions only. No new
    dependency unless the plan names it. Do not move NestJS off 11,
    TypeScript off 5.9.3 or Prisma off 7.10.0.
12. **`docker compose up` on a clean clone starts everything**: database,
    migrations, seed, API, web. Anything that touches startup is verified from
    a clean state with `docker compose down -v` first. The seed is idempotent.
13. **README.md is written by the human.** The challenge rules require it. Do
    not create, edit or reformat its prose. Put facts the README should
    mention in your final summary instead.
14. **Agents do not commit.** Stop when the work is verified and wait.

## Where code goes

| Kind of code                                          | Location                                         |
| ----------------------------------------------------- | ------------------------------------------------ |
| Request, response and enum schemas; inferred types    | `packages/contracts/src/`                        |
| HTTP routes, status codes                             | `apps/api/src/<module>/<module>.controller.ts`   |
| Business rules                                        | `apps/api/src/<module>/<module>.service.ts`      |
| Time helpers, `Clock`                                 | `apps/api/src/common/time/`                      |
| Guards, decorators, exception filters                 | `apps/api/src/common/`                           |
| Environment schema                                    | `apps/api/src/config/`                           |
| Prisma service and module                             | `apps/api/src/prisma/`                           |
| Schema, migrations, seed                              | `apps/api/prisma/`                               |
| Generated Prisma client (never edited, not committed) | `apps/api/src/generated/prisma/`                 |
| Unit tests                                            | next to the file, `*.spec.ts`                    |
| API tests against PostgreSQL                          | `apps/api/test/*.e2e-spec.ts`                    |
| Pages; route table                                    | `apps/web/src/pages/`; `apps/web/src/router.tsx` |
| API client and TanStack Query hooks                   | `apps/web/src/api/`                              |
| shadcn/ui primitives                                  | `apps/web/src/components/ui/`                    |
| App-specific components                               | `apps/web/src/components/`                       |
| Design reference (read-only)                          | `design/`                                        |

Import rules: `web` and `api` never import from each other. `contracts`
imports `zod` and nothing else — no NestJS, React, Node, DOM or Luxon. In
contracts, types are imported and exported with `import type` and
`export type`, because the web app compiles that source with
`verbatimModuleSyntax`.

## Conventions

- **Modules.** One NestJS module per domain area: `auth`, `courts`,
  `bookings`. Do not add a module the plan does not name.
- **Validation.** Controllers receive DTOs created from contracts schemas
  with `nestjs-zod`. Services trust their inputs' shape and enforce policy.
- **Errors.** Services throw NestJS HTTP exceptions with a clear message.
  Database errors are mapped in one exception filter. A slot conflict is
  `409`. The full error envelope is not designed yet: if a task needs it and
  ARCHITECTURE.md does not define it, ask.
- **Web data.** All server state goes through TanStack Query. After a
  mutation, invalidate the affected queries; after a `409` on booking,
  refetch availability. Forms use react-hook-form with the contracts schema
  as resolver.
- **Styling.** Tailwind and shadcn/ui, using the tokens in
  `design/theme.css` and the rules in `design/DESIGN.md`. A filled primary
  button is used once per view; destructive actions are never filled.
- **Tests.** Booking rules are the priority: double booking, the cancellation
  window, opening hours. The double-booking test fires parallel requests at a
  real PostgreSQL and must never be replaced by a mock. Time-dependent tests
  use a fake `Clock`, not real time.
- **Naming.** Files `kebab-case`, classes `PascalCase`, database columns as
  Prisma generates them (`camelCase`).
- **Comments.** Explain why, not what. No commented-out code.

## Commands

```bash
npm ci                 # install
npm run build          # contracts, then api, then web
npm run lint           # builds contracts first
npm test               # unit tests
npm run test:e2e       # API tests against PostgreSQL
npm run format:check   # Prettier
npm run dev:api        # API in watch mode
npm run dev:web        # Vite dev server
npm run dev:contracts  # rebuild contracts on change
docker compose up      # the whole system
```

Add a dependency to one workspace with
`npm install <pkg>@<exact-version> -w @courtly/<workspace>`.

Nothing is done because it looks right. A step is done when a command printed
a pass. When a rule is said to be enforced by tooling, prove it once by
breaking it on purpose and watching the check fail.

## Version facts checked on 2026-10-09

Library knowledge goes stale. These were checked against the registry and by
running the scaffold; trust them over memory, and check the library's own
documentation for anything not listed.

- `npm install prisma` resolves to an **8.0 release candidate**. Always
  install `prisma@7.10.0`, `@prisma/client@7.10.0`,
  `@prisma/adapter-pg@7.10.0`. The main Prisma docs now describe version 8;
  version 7 docs are under `prisma.io/docs/orm/v7`.
- Prisma 7: generator provider is `prisma-client` with a required `output`
  (`../src/generated/prisma`) and `moduleFormat = "cjs"`; the client is
  imported from the generated path, not from `@prisma/client`; a driver
  adapter is passed to `new PrismaClient({ adapter })`; the connection URL
  lives in `prisma.config.ts`; `.env` is not loaded automatically at runtime.
  **Not yet run in this repository** — confirm with `prisma generate` and a
  build the first time it is set up.
- `npx @nestjs/cli` now scaffolds NestJS 12 (ESM, Vitest, Oxlint). This repo
  is NestJS 11: use the local `nest` binary or `@nestjs/cli@11` for
  generators.
- `nestjs-zod@5.5.0` declares peer support for NestJS 10 and 11 only.
- `typescript@latest` is 7.x; `ts-jest` requires `<7`. The repo is on 5.9.3.
- `create-vite@9` defaults to Oxlint; this repo uses ESLint in both apps.
- PostgreSQL reports an exclusion violation as SQLSTATE `23P01`.
  `@prisma/adapter-pg@7.10.0` does not map it, so expect a
  `PrismaClientKnownRequestError` with code `P2039` and the original code
  `23P01` inside. Read from source, not observed: the first concurrency test
  must confirm the shape before the filter depends on it.
- Verified working together: NestJS 11.x, Jest 30, ts-jest 29, Vite 8,
  React 19, Zod 4.6.5, TypeScript 5.9.3, with one hoisted copy each of
  TypeScript and Zod.

## Commit conventions

Commits are made by the human, one per meaningful step, so the history tells
the story of the work.

- `chore` — scaffolding, tooling, dependencies, configuration
- `feat` — functionality and anything that changes behaviour
- `fix` — a bug in behaviour that already existed
- `test` — tests only
- `docs` — documentation only
- `build` — Docker, CI
- `refactor` — structure changes with no behavioural difference

Workspace setup is `chore`, however substantial. Do not label infrastructure
as `feat`.

## Push back on these

- A dependency installed but unused, or an environment variable required at
  boot but read nowhere.
- "Record as a follow-up" on anything that leaves a privilege gap.
- A stored status that mixes user intent with something derivable from time.
- Trusting a claim inside the token beyond the user id.
- Seed data, extra endpoints, abstractions or fields the task did not ask for.

## Current state

_Update this section whenever a milestone lands._

- **Done:** npm workspace; NestJS API with a `/health` route; React + Vite
  web app; `@courtly/contracts` consumed by both; strict mode, lint, format
  and test scripts.
- **Not started:** Docker Compose, Prisma and the database schema, auth,
  courts, bookings, admin views, Tailwind and shadcn/ui, the web app's pages.
- **Next design step:** API surface and error envelope (see ARCHITECTURE.md,
  "Known open problems").
