# Architecture

Courtly is a booking system for one sports facility. The interesting parts are
not the screens: they are the guarantee that two people never hold the same
court at the same time, and the handling of time in a facility whose clock is
neither the server's nor the browser's.

This document records the structure, the rules that break the design if
violated, and every significant decision with what it buys and what it costs.
It describes the target design. For what is built so far, see "Current state"
in [AGENTS.md](./AGENTS.md).

## System overview

```
browser ──▶ web (static React build, nginx)
               │  /api/*  proxied, same origin
               ▼
            api (NestJS) ──▶ PostgreSQL
               ▲
               └── @courtly/contracts (Zod schemas) ──▶ also compiled into web
```

- **web** is a single-page app. It renders, collects input and calls the API.
  It holds no business rules and does no time arithmetic.
- **api** owns every rule: authentication, roles, booking policy, time.
- **PostgreSQL** owns the invariants that must hold under concurrency.
- **contracts** is the single definition of every request and response shape.

In Docker, nginx serves the web build and forwards `/api` to the API
container. In development the Vite dev server does the same forwarding. The
browser therefore only ever talks to one origin.

## Workspace boundaries

```
apps/api            NestJS application
apps/web            React + Vite application
packages/contracts  Zod schemas and inferred types
```

| From → To        | Allowed | Notes                                            |
| ---------------- | ------- | ------------------------------------------------ |
| api → contracts  | yes     | consumes the compiled CommonJS build (`dist/`)   |
| web → contracts  | yes     | reads the TypeScript source through a Vite alias |
| contracts → apps | never   | contracts depends on `zod` and nothing else      |
| web ↔ api       | never   | they share types only through contracts          |

Contracts must stay framework-free: no NestJS, React, Node or DOM APIs, no
Luxon. It is compiled twice under two different compiler configurations, so
anything environment-specific breaks one of the two consumers.

### How contracts is consumed, and why two ways

NestJS 11 compiles to CommonJS, so the API imports the package through
`node_modules` and gets `packages/contracts/dist`. Vite is pointed at
`packages/contracts/src/index.ts` by an alias in `apps/web/vite.config.ts` and
a matching `paths` entry in `apps/web/tsconfig.app.json`.

This buys a tree-shaken browser bundle with a single copy of Zod (measured on
the empty scaffold: 282 kB against 705 kB when the web app bundled the
CommonJS build) and contract changes that hot-reload in the web app without a
build step. It costs two consumption paths that must both keep working, and
contracts source has to satisfy the web app's stricter compiler flags
(`verbatimModuleSyntax`: use `import type` and `export type` for types).

The API needs the build to exist. Root `prelint`, `pretest`, `pretest:e2e` and
`predev:api` scripts build it, so a fresh clone works without a manual step.
The generated Prisma client is not committed either: the api's `prebuild`,
`pretest`, `pretest:e2e`, `prestart:dev` and `prelint` scripts run
`prisma generate`. There is no `postinstall`.

## API layering

```
controller  HTTP only: route, guards, Zod-validated input, status codes
    │
service     policy: every business rule, reads "now" from Clock
    │
prisma      persistence; the database enforces invariants
```

- Controllers contain no business rules and never call Prisma.
- Services never read HTTP objects. They receive the acting user as an
  argument.
- Database errors are translated to HTTP in one exception filter, not caught
  ad hoc in services.

Planned modules: `auth`, `courts`, `bookings`, plus infrastructure (`prisma`,
`config`, and `common` for the clock, guards, decorators and filters). The
endpoint list and the error envelope are not designed yet; see "Known open
problems".

## Data model

```prisma
enum Role {
  USER
  ADMIN
}

enum SportType {
  PADEL
  TENNIS
  SQUASH
  BADMINTON
}

model User {
  id           String    @id @default(uuid()) @db.Uuid
  email        String    @unique
  passwordHash String
  name         String
  role         Role      @default(USER)
  createdAt    DateTime  @default(now()) @db.Timestamptz(3)
  bookings     Booking[]
}

model Court {
  id                String    @id @default(uuid()) @db.Uuid
  name              String
  sportType         SportType
  pricePerHourCents Int
  opensAtMinutes    Int       // minutes from midnight, facility time
  closesAtMinutes   Int
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt         DateTime  @updatedAt @db.Timestamptz(3)
  bookings          Booking[]
}

model Booking {
  id              String    @id @default(uuid()) @db.Uuid
  userId          String    @db.Uuid
  courtId         String    @db.Uuid
  startsAt        DateTime  @db.Timestamptz(3)
  endsAt          DateTime  @db.Timestamptz(3)
  totalPriceCents Int
  cancelledAt     DateTime? @db.Timestamptz(3)
  createdAt       DateTime  @default(now()) @db.Timestamptz(3)

  user  User  @relation(fields: [userId], references: [id], onDelete: Restrict)
  court Court @relation(fields: [courtId], references: [id], onDelete: Restrict)

  @@index([userId, startsAt])
  @@index([courtId, startsAt])
  @@index([startsAt])
}
```

Constraints Prisma's schema language cannot express live as raw SQL in a
migration:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "courtId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE ("cancelledAt" IS NULL);

ALTER TABLE "Booking"
  ADD CONSTRAINT booking_time_order CHECK ("endsAt" > "startsAt");

ALTER TABLE "Court"
  ADD CONSTRAINT court_hours_valid
  CHECK ("opensAtMinutes" >= 0 AND "closesAtMinutes" <= 1440
         AND "opensAtMinutes" < "closesAtMinutes");

ALTER TABLE "Court"
  ADD CONSTRAINT court_price_positive CHECK ("pricePerHourCents" > 0);
```

Why the model looks like this:

- **A booking is a time range, not a set of slot rows.** One row with
  `startsAt` and `endsAt`. Slot length and maximum duration are policy that
  can change in the service without touching the table, and the same model
  carries over to rentals of arbitrary length. It costs a constraint Prisma
  cannot describe, so the guarantee is in hand-written SQL.
- **No `status` column.** Only `cancelledAt`. "Upcoming" and "completed" are
  derived from time when read. A stored status would need something to update
  it when time passes, and would be wrong whenever that something lagged.
- **`totalPriceCents` is a snapshot** taken when the booking is created. An
  admin changing a court's price must not rewrite history or past revenue.
  Money is integer cents; no floating point anywhere.
- **Opening hours are minutes from midnight** (480 and 1380 for 08:00–23:00).
  Integers compare trivially and closing at 24:00 is 1440. They are wall-clock
  values in the facility time zone, not instants.
- **Every timestamp is `timestamptz`.** Prisma's default is `timestamp`
  without a zone, which would silently break both `tstzrange` and all facility
  time logic.
- **Nothing is deleted.** Courts are deactivated with `isActive`; bookings are
  cancelled with `cancelledAt`; foreign keys use `onDelete: Restrict`. This is
  what keeps booking history when a court is deactivated.

## Double bookings

The guarantee is the `booking_no_overlap` exclusion constraint: PostgreSQL
refuses to hold two non-cancelled rows for the same court whose time ranges
overlap. The range is half-open (`[)`), so 16:00–17:00 and 17:00–18:00 do not
conflict. A cancelled booking leaves the constraint because of the `WHERE`
clause, which frees the slot.

When two requests arrive at the same instant, both `INSERT`s run; the second
waits on the first's index entry and fails with SQLSTATE `23P01` once the
first commits. The API maps that error to `409 Conflict`. No application lock,
no serializable transaction, no "select then insert".

The service may check availability before inserting, but only to produce a
friendlier message. That check is never the guarantee, because two requests
can both pass it.

Verified against PostgreSQL 17 by `apps/api/test/database.e2e-spec.ts`: ten
parallel inserts for one slot produce exactly one row and nine `23P01` errors
naming `booking_no_overlap`; adjacent slots both succeed; a partially
overlapping range is rejected; the slot can be booked again after
cancellation. Breaking the constraint on purpose (dropping it in the test
database) makes the parallel test fail with ten fulfilled inserts.

## Time

- The facility lives in one time zone, configured as `FACILITY_TIMEZONE`
  (`Europe/Lisbon`). Containers run in UTC and browsers can be anywhere.
- All time arithmetic happens in the API with Luxon, where the zone is part of
  the value. Luxon was chosen over date-fns because a forgotten zone
  conversion on a native `Date` silently computes in the process zone, which
  is a bug visible in only one environment.
- "Now" is read from an injected `Clock`. Nothing else in the API calls
  `new Date()`, `Date.now()` or `DateTime.now()`. The one exception is
  `apps/api/prisma/seed.ts`, which runs from the command line outside the API
  process and places demo bookings relative to today. This is what makes "not in
  the past" and "cancel up to 2 hours before" testable.
- Instants cross the wire as UTC ISO strings. The web app does not compute
  with them; it formats them in the facility zone, never the browser's.

## Invariants and policy

| Rule                                          | Lives in                 | Why there                              |
| --------------------------------------------- | ------------------------ | -------------------------------------- |
| No overlapping bookings on a court            | DB, exclusion constraint | the only rule that must survive a race |
| End after start, price > 0, hours well-formed | DB, CHECK constraints    | never change; cheap to guarantee       |
| 1 or 2 hours, on the hour                     | service, Zod             | policy; expected to change             |
| Inside opening hours, court is active         | service                  | needs another table's data             |
| Not in the past, cancel ≥ 2 hours before      | service, injected clock  | depends on "now"; must be testable     |
| Role and ownership                            | API guards and services  | the UI is not a security boundary      |

The database holds invariants. The service holds policy. Moving policy into
the database makes it slow to change; dropping an invariant from the database
makes it false under concurrency.

## Authentication and authorization

- Seeded users, email and password, bcrypt hashes. No registration.
- Login returns a JWT sent in the `Authorization: Bearer` header.
- The token carries only the user id (`sub`). On every request the user is
  loaded from the database and the role is taken from that row, not from the
  token. This costs one query per request and buys role changes and removed
  users taking effect immediately.
- Routes are authenticated by default (global guard); `@Public()` is the
  opt-out and is used for login only. Admin routes carry `@Roles('ADMIN')`.
- Ownership is enforced in queries: a user's booking is looked up by id and
  owner together, so another user's booking is simply not found.

## Assumptions

The brief leaves these open. They are decisions, not oversights.

- One facility, one time zone.
- Opening hours are the same every day and do not cross midnight.
- Slots start on the hour; a booking is 1 or 2 consecutive hours.
- Deactivating a court blocks new bookings. Existing future bookings stay
  valid and visible to the admin.
- Expected revenue for a day is the sum of `totalPriceCents` of non-cancelled
  bookings that start on that facility-local day.
- Sport types are a fixed enum; adding one is a migration.

## Decisions

| Decision                                       | Buys                                                                                                        | Costs                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| npm workspaces, no Nx or Turborepo             | zero extra tooling to explain for three packages                                                            | no task cache; build order is the order of the `workspaces` array |
| React + Vite, not Next.js                      | the whole app is behind login, so SSR and SEO buy nothing; static build served by nginx                     | no server rendering if a public page is ever needed               |
| NestJS, not Express                            | explicit places for guards, validation pipes and exception filters; DI makes the clock replaceable in tests | more boilerplate than Express for an app this size                |
| NestJS 11, not 12                              | `nestjs-zod` 5.5.0 supports NestJS 10 and 11 only; 11 is still maintained and keeps Jest and CommonJS       | not the newest major; a later migration to ESM                    |
| TypeScript 5.9.3 in every package              | one compiler version; `ts-jest` does not support TypeScript 7 yet                                           | not on the native compiler                                        |
| PostgreSQL                                     | exclusion constraints over time ranges; MySQL has none, MongoDB would need slot documents                   | a Postgres-specific guarantee                                     |
| Prisma 7                                       | readable schema, versioned migrations, typed client, simple seed                                            | cannot express the exclusion constraint; it lives in raw SQL      |
| Range plus exclusion constraint, not slot rows | policy changes without schema changes                                                                       | hand-written SQL; a non-obvious Prisma error to map               |
| Zod schemas in a shared package                | one definition gives runtime validation and static types on both sides                                      | a build step for the API side                                     |
| Token in the `Authorization` header            | no CSRF surface, trivial to test                                                                            | the token is readable by JavaScript, so XSS exposes it            |
| Same-origin `/api` through a proxy             | no CORS configuration, no API URL baked into the web build                                                  | the web container must be able to reach the API container         |
| Jest and Supertest against real PostgreSQL     | the concurrency test exercises the real constraint                                                          | tests need a running database                                     |
| shadcn/ui components inside `apps/web`         | one consumer, so no cross-package Tailwind setup                                                            | components are not reusable by another app without moving them    |

## Known open problems

Not solved. Listed so nobody mistakes the gaps for decisions.

- **API surface is not designed yet.** Endpoints, the slot response shape and
  the error envelope are the next design step. Until they are recorded here,
  nothing should invent them.
- **Prisma and the exclusion constraint.** `@prisma/adapter-pg` 7.10.0 has no
  mapping for SQLSTATE `23P01`. The first concurrency test pinned the shape:
  `PrismaClientKnownRequestError` with code `P2039`, and the original error
  under `meta.driverAdapterError.cause` (`originalCode: "23P01"`,
  `originalMessage` naming `"booking_no_overlap"`). The adapter drops pg's
  `constraint` field and CHECK violations arrive as `P2039` too, so
  `isBookingOverlapError` matches code, original code and constraint name.
  The exception filter that turns it into `409` is not built yet.
- **Migration drift.** Prisma does not know `booking_no_overlap` exists. At
  the time of writing, `prisma migrate dev --create-only` against the migrated
  database produced an empty migration, so Prisma does not try to drop the
  constraint. That must be re-checked, and every generated migration read
  before it is applied, whenever the schema changes. A test asserts the
  constraint is present in `pg_constraint`.
- **The seed validates the whole API environment.** `prisma/seed.ts` calls
  `validateEnv(process.env)`, so once auth adds `JWT_SECRET` to the schema the
  seed will require it too, though it never uses it. Account for this when
  deciding where the seed runs in the containers.
- **Daylight saving time.** Lisbon changes clocks on 25 October 2026. A local
  day is then 25 hours long, so slot generation must walk wall-clock hours and
  not add 24 × 60 minutes. Needs a test on that date.
- **Sessions.** No refresh tokens, no logout that invalidates a token, no
  login rate limiting.
- **Lists are unpaginated.**
- **No audit trail** of who cancelled or who changed a court.
- **Frontend tests** are a bonus in the brief and not planned yet.
