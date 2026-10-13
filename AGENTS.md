# AGENTS.md

Context for coding agents working on Courtly: a sports court booking app
(NestJS API, React web, PostgreSQL, shared Zod contracts) built as a take-home
challenge. The author must be able to defend every line in a live interview,
so prefer the plain solution over the clever one, and never add anything the
task did not ask for.

Read [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) before structural work. It records
why, not only what. Read [docs/SECURITY.md](./docs/SECURITY.md) before touching auth,
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
   `DateTime.now()` outside the clock implementation and
   `apps/api/prisma/seed.ts`. The web app formats instants in the facility
   zone and does no time arithmetic. Exception: JWT issue and expiry use real
   system time inside `@nestjs/jwt`; that is security, not business time.
5. **Timestamps are `timestamptz`; money is integer cents.** Every `DateTime`
   column has `@db.Timestamptz(3)`. No floats or decimals for prices.
6. **Request and response shapes are defined once, in `@courtly/contracts`.**
   The API validates with those Zod schemas and the web app infers its types
   from them. Do not hand-write a duplicate type on either side.
7. **Invariants in the database, policy in services.** Follow the table in
   docs/ARCHITECTURE.md, "Invariants and policy". Controllers hold no business
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

| Kind of code                                             | Location                                         |
| -------------------------------------------------------- | ------------------------------------------------ |
| Request, response and enum schemas; inferred types       | `packages/contracts/src/`                        |
| HTTP routes, status codes                                | `apps/api/src/<module>/<module>.controller.ts`   |
| Business rules                                           | `apps/api/src/<module>/<module>.service.ts`      |
| Time helpers, `Clock`                                    | `apps/api/src/common/time/`                      |
| Guards, decorators, exception filters, shared param DTOs | `apps/api/src/common/`                           |
| Environment schema                                       | `apps/api/src/config/`                           |
| Prisma service and module                                | `apps/api/src/prisma/`                           |
| Schema, migrations, seed                                 | `apps/api/prisma/`                               |
| Compose file; container init scripts                     | `docker-compose.yml`, `docker/`                  |
| Dockerfiles; nginx config                                | `apps/api/`, `apps/web/`                         |
| Generated Prisma client (never edited, not committed)    | `apps/api/src/generated/prisma/`                 |
| Unit tests                                               | next to the file, `*.spec.ts`                    |
| API tests against PostgreSQL                             | `apps/api/test/*.e2e-spec.ts`                    |
| Pages; route table                                       | `apps/web/src/pages/`; `apps/web/src/router.tsx` |
| API client and TanStack Query hooks                      | `apps/web/src/api/`                              |
| Session: token state, `useAuth`, route guards            | `apps/web/src/auth/`                             |
| Formatting helpers; shadcn's `cn`                        | `apps/web/src/lib/`                              |
| shadcn/ui primitives                                     | `apps/web/src/components/ui/`                    |
| App-specific components                                  | `apps/web/src/components/`                       |
| Design reference (read-only, local, gitignored)          | `design/`                                        |

Import rules: `web` and `api` never import from each other. `contracts`
imports `zod` and nothing else — no NestJS, React, Node, DOM or Luxon. In
contracts, types are imported and exported with `import type` and
`export type`, because the web app compiles that source with
`verbatimModuleSyntax`.

## Conventions

- **Modules.** One NestJS module per domain area: `auth`, `courts`,
  `bookings` and `facility` (`GET /facility`). Admin controllers live in
  their domain module (`courts/admin-courts.controller.ts`, later
  `bookings/admin-bookings.controller.ts`), each with `@Roles('ADMIN')` at
  class level, because a module with no data of its own would reach into two
  other modules' services. Do not add a module the plan does not name.
- **Validation.** Controllers receive DTOs created from contracts schemas
  with `nestjs-zod`. Services trust their inputs' shape and enforce policy.
- **Errors.** Services and guards raise a domain error with
  `new ApiException(code, message[, details])`, the only way: the filter does
  not honour a plain `HttpException` that carries a code. `details` is for
  service validation that needs stored data. One exception filter builds the
  error envelope and maps database errors; a slot conflict is `409`. The error
  shape, every error code and how the filter picks one are in docs/ARCHITECTURE.md,
  "API".
- **Web data.** All server state goes through TanStack Query. After a
  mutation, invalidate the affected queries; after a `409` on booking,
  refetch availability. Forms use react-hook-form with the contracts schema
  as resolver.
- **Styling.** Tailwind and shadcn/ui, using the tokens in
  `apps/web/src/index.css` (copied from the local `design/theme.css`) and,
  where available locally, the rules in `design/DESIGN.md`. A filled primary
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
npm run test:e2e       # API tests against PostgreSQL (needs npm run db:up)
npm run format:check   # Prettier
npm run dev:api        # API in watch mode
npm run dev:web        # Vite dev server
npm run dev:contracts  # rebuild contracts on change
docker compose up      # the whole system: web on :8080, api on :3000, db on :5432
npm run db:up          # start only the database container
npm run db:migrate -w @courtly/api   # prisma migrate dev; read generated SQL first
npm run db:deploy -w @courtly/api    # prisma migrate deploy
npm run db:seed -w @courtly/api      # run-once demo data
```

The API scripts `build`, `test`, `test:e2e`, `start:dev` and `lint` run
`prisma generate` first, so a fresh clone needs no manual generate step.

Add a dependency to one workspace with
`npm install <pkg>@<exact-version> -w @courtly/<workspace>`.

Nothing is done because it looks right. A step is done when a command printed
a pass. When a rule is said to be enforced by tooling, prove it once by
breaking it on purpose and watching the check fail.

## Version facts checked on 2026-10-09

Library knowledge goes stale. Trust these over memory, and check the library's
own documentation for anything not listed.

- `npm install prisma` resolves to an **8.0 release candidate**. Always
  install `prisma@7.10.0`, `@prisma/client@7.10.0`,
  `@prisma/adapter-pg@7.10.0`; version 7 docs are under
  `prisma.io/docs/orm/v7`. The client is imported from `src/generated/prisma`,
  not from `@prisma/client` (setup notes are in `schema.prisma` and
  `prisma.config.ts`). The adapter depends on `pg`; do not install it.
- The latest major is deliberately not used for NestJS (12), `@nestjs/jwt`
  and `@nestjs/config` (both 12.x are ESM-only; the repo uses 11.0.2 and
  4.0.4) or TypeScript (7; `ts-jest` needs `<7`). `npx @nestjs/cli`
  scaffolds NestJS 12: use the local `nest` binary or `@nestjs/cli@11`.
  Reasons: docs/ARCHITECTURE.md, "Decisions".
- `test:e2e` runs Node with `--experimental-vm-modules`: the generated Prisma
  client loads its query compiler with a dynamic `import()`, which Jest's
  sandbox rejects without it.

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

## Current state

Done: scaffold, database, Docker, contracts, auth, web foundation, facility,
courts API and courts screens. Not started: availability, bookings, my
bookings and the admin day view. Status of every item is in
[docs/ROADMAP.md](./docs/ROADMAP.md); do not list features here.
