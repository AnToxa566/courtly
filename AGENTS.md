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
| Compose file; container init scripts                  | `docker-compose.yml`, `docker/`                  |
| Dockerfiles; nginx config                             | `apps/api/`, `apps/web/`                         |
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
  `bookings`, `facility` (`GET /facility`) and `admin` (the single
  `admin.controller.ts` for `/admin/*`, calling services exported by `courts`
  and `bookings`). Do not
  add a module the plan does not name.
- **Validation.** Controllers receive DTOs created from contracts schemas
  with `nestjs-zod`. Services trust their inputs' shape and enforce policy.
- **Errors.** Services and guards raise a domain error with
  `new ApiException(code, message)`, the only way: the filter does not honour a
  plain `HttpException` that carries a code. One exception filter builds the
  error envelope and maps database errors; a slot conflict is `409`. The error
  shape, every error code and how the filter picks one are in ARCHITECTURE.md,
  "API".
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
  Confirmed in this repository: `prisma.config.ts` reads
  `process.env.DATABASE_URL` rather than Prisma's `env()`, because `env()`
  throws when the variable is unset and `prisma generate` must work on a
  clone with no `.env`; `.env` is loaded by `import 'dotenv/config'`.
  The seed runs only through `prisma db seed` (command in
  `prisma.config.ts`). The generator also needs `importFileExtension = ""`:
  with `module: nodenext` it otherwise emits `.js` relative imports that
  Jest and ts-node cannot resolve.
- The generated client loads its query compiler with a dynamic `import()`,
  which Jest's sandbox rejects unless Node runs with
  `--experimental-vm-modules`. The `test:e2e` script sets it.
- `@nestjs/config` latest (12.x) is ESM-only; the repo uses 4.0.4 (CommonJS,
  NestJS 10 and 11). `@prisma/adapter-pg` depends on `pg` itself, so do not
  install `pg`.
- npm 11 prints "allow-scripts" warnings on install. None were needed:
  `bcrypt` 6 ships prebuilt binaries and Prisma 7 needs no engine download.
- `npx @nestjs/cli` now scaffolds NestJS 12 (ESM, Vitest, Oxlint). This repo
  is NestJS 11: use the local `nest` binary or `@nestjs/cli@11` for
  generators.
- `@nestjs/jwt` 12.x is ESM-only; the repo uses 11.0.2 (CommonJS), which
  pulls `jsonwebtoken` 9.0.3.
- `nestjs-zod@5.5.0` declares peer support for NestJS 10 and 11 only.
- `typescript@latest` is 7.x; `ts-jest` requires `<7`. The repo is on 5.9.3.
- `create-vite@9` defaults to Oxlint; this repo uses ESLint in both apps.
- PostgreSQL reports an exclusion violation as SQLSTATE `23P01`.
  `@prisma/adapter-pg@7.10.0` does not map it, so expect a
  `PrismaClientKnownRequestError` with code `P2039` and the original code
  `23P01` inside. Observed by the concurrency test in
  `apps/api/test/database.e2e-spec.ts`: `meta.driverAdapterError.cause`
  holds `originalCode: "23P01"` and an `originalMessage` that names
  `"booking_no_overlap"`. The adapter drops pg's `constraint` field, and
  CHECK violations also arrive as `P2039`, so
  `isBookingOverlapError` matches the code, the original code and the
  constraint name in the message.
- The API image's runtime stage installs with
  `npm ci --omit=dev --omit=optional`. `--omit=dev` alone keeps `prisma` and
  `typescript`: `prisma` is an optional peer of `@prisma/client`, which npm
  drops only when optional packages are omitted too.
- `openssl` is installed only in the API image's build stage: Prisma's
  schema engine is a native binary chosen at install time by the OpenSSL it
  finds, and `node:*-slim` has none. The runtime image needs none, because
  the query compiler is WASM. `migrate` runs from the build stage for this
  reason.
- The Node and nginx images are pinned to exact tags:
  `node:24.19.0-bookworm-slim` (the Node and npm that produced the lockfile)
  and `nginx:1.30.5-alpine`. The `db` service still uses the floating
  `postgres:17-alpine`.
- Verified working together: NestJS 11.x, Jest 30, ts-jest 29, Vite 8,
  React 19, Zod 4.6.5, TypeScript 5.9.3. TypeScript has one copy. Zod does
  not: each workspace pins 4.6.5, while `nestjs-zod` (a production
  dependency of the API) and `eslint-plugin-react-hooks` (web, dev only) both
  resolve 4.6.6 in the root `node_modules`.

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

- **Done:** npm workspace; NestJS API with a `/api/health` route (global
  prefix `api`, set in `configureApp`); React + Vite web app;
  `@courtly/contracts` consumed by both; strict mode, lint, format and test
  scripts. Docker Compose `db` service (PostgreSQL 17, plus a
  `courtly_test` database); Prisma 7 schema and two migrations (`init`,
  and the hand-written `booking_invariants` with the exclusion and CHECK
  constraints); run-once seed; boot-time environment validation
  (`DATABASE_URL`, `FACILITY_TIMEZONE`); `PrismaModule` and
  `PrismaService`; `isBookingOverlapError`; database tests against
  PostgreSQL, including the ten-request double-booking race. Docker Compose
  runs the whole system: `db`, a one-shot `migrate` (deploy, then seed),
  `api` and `web` (nginx, proxies `/api`); the Vite dev server proxies
  `/api` too. `@courtly/contracts` defines every request, response and
  error shape (see ARCHITECTURE.md, "API"); `apps/api/src/contracts-sync.spec.ts`
  ties `Role` and `SportType` to the Prisma enums and every error code to the
  API section. Auth: `POST /api/auth/login`, `GET /api/auth/me`, global
  `JwtAuthGuard` and `RolesGuard` (deny by default, `@Public()`, `@Roles()`,
  `@CurrentUser()` in `common/auth/`), `JWT_SECRET` in the environment schema
  and compose, `ApiException` with its code-to-status map and the single
  `ApiExceptionFilter`, and the global `ZodValidationPipe` and
  `ZodSerializerInterceptor`, all registered in `AppModule`.
- **Not started:** `Clock`, courts, bookings, the `facility` and `admin` API
  modules, admin views, Tailwind and shadcn/ui, the web app's pages.
- **Next step:** backend and frontend proceed in parallel against the
  contracts.
