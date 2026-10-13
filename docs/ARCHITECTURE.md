# Architecture

Courtly is a booking system for one sports facility. The interesting parts are
not the screens: they are the guarantee that two people never hold the same
court at the same time, and the handling of time in a facility whose clock is
neither the server's nor the browser's.

This document records the structure, the rules that break the design if
violated, and every significant decision with what it buys and what it costs.
It describes the target design. For what is built so far, see
[ROADMAP.md](./ROADMAP.md).

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
  It holds no business rules and does no time arithmetic beyond stepping
  calendar dates (see Time).
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

Modules: `auth`, `courts`, `bookings` and `facility` (owns
`GET /facility`), plus infrastructure (`prisma`, `config`, and `common` for the
clock, guards, decorators and filters). Admin controllers live in their domain
module (`courts/admin-courts.controller.ts`,
`bookings/admin-bookings.controller.ts`), each with `@Roles('ADMIN')` at class
level: an `admin` module would hold no rules of its own and would need both
domain services.

Domain modules never import one another. `PrismaService` is global, and a
service reads the tables its rules need: availability (`courts`) reads
non-cancelled bookings, and booking creation (`bookings`) reads the court to
tell a `404` from a `422 COURT_INACTIVE`. Exporting services instead would make
`courts` and `bookings` depend on each other, because each needs the other's
data. The cost is that "non-cancelled" (`cancelledAt: null`) is written in more
than one query.

## API

All routes are under `/api` and require a bearer token except login and health. Shapes
are the Zod schemas in `packages/contracts`.

| Method | Path                                  | Who       | Purpose                                 |
| ------ | ------------------------------------- | --------- | --------------------------------------- |
| GET    | `/health`                             | anyone    | liveness for the container health check |
| POST   | `/auth/login`                         | anyone    | email and password → token and user     |
| GET    | `/auth/me`                            | signed in | current user, for page reloads          |
| GET    | `/facility`                           | signed in | time zone, facility "today", rules      |
| GET    | `/courts`                             | signed in | active courts                           |
| GET    | `/courts/:id`                         | signed in | one active court                        |
| GET    | `/courts/:id/availability?date=`      | signed in | the day's hourly slots                  |
| POST   | `/bookings`                           | signed in | create a booking                        |
| GET    | `/bookings/mine?scope=upcoming\|past` | signed in | the caller's bookings                   |
| POST   | `/bookings/:id/cancel`                | owner     | cancel                                  |
| GET    | `/admin/courts`                       | admin     | all courts, including inactive          |
| POST   | `/admin/courts`                       | admin     | create a court                          |
| PATCH  | `/admin/courts/:id`                   | admin     | edit, including `isActive`              |
| GET    | `/admin/bookings?date=`               | admin     | all bookings of a day, with revenue     |

Every error has one shape: `{ statusCode, code, message, details? }`.

| Status | Code                         | When                                                                            |
| ------ | ---------------------------- | ------------------------------------------------------------------------------- |
| 400    | `VALIDATION_FAILED`          | body, query or params fail the Zod schema, or a merged partial update does      |
| 401    | `INVALID_CREDENTIALS`        | wrong email or password, one message for both                                   |
| 401    | `UNAUTHENTICATED`            | missing or expired token, or the user no longer exists                          |
| 403    | `FORBIDDEN`                  | wrong role                                                                      |
| 404    | `NOT_FOUND`                  | no such court or booking, inactive court, someone else's booking                |
| 409    | `SLOT_TAKEN`                 | `booking_no_overlap` rejected the insert                                        |
| 409    | `ALREADY_CANCELLED`          | cancelling twice                                                                |
| 422    | `BOOKING_IN_PAST`            | start is not in the future                                                      |
| 422    | `OUTSIDE_OPENING_HOURS`      | the range leaves the court's hours                                              |
| 422    | `NOT_ON_THE_HOUR`            | start is not on a whole hour in facility time                                   |
| 422    | `COURT_INACTIVE`             | booking an inactive court                                                       |
| 422    | `CANCELLATION_WINDOW_CLOSED` | less than 2 hours before start, or already started or ended                     |
| 500    | `INTERNAL_ERROR`             | anything unexpected; the message is generic, details are logged, never returned |

A service or guard raises a domain error with
`new ApiException(code, message[, details])`, for example
`new ApiException('BOOKING_IN_PAST', 'The booking starts in the past')`.
`details` is for service validation that needs stored data, such as a partial
court update checked after merging with the stored court.
That is the only way: the status comes from the code through one map, and the
filter does not honour a plain `HttpException` that carries a `code`. The single
exception filter builds the `{ statusCode, code, message, details? }` envelope.
For exceptions that carry no code it chooses one: a 401 is `UNAUTHENTICATED`, a
403 is `FORBIDDEN`, the router's 404 is `NOT_FOUND`, the Zod validation
exception (400) is `VALIDATION_FAILED` with `details`, any other 400 (malformed
JSON) is `VALIDATION_FAILED` without `details`, and Prisma `P2039` with original
code `23P01` on `booking_no_overlap` (see `isBookingOverlapError`) is 409
`SLOT_TAKEN`. Anything else, including a 413, is 500 `INTERNAL_ERROR` with a
generic message; the details are logged, never returned.

Why it looks like this:

- **Admin routes live under `/admin`** instead of one resource whose behaviour
  depends on the role. The role guard sits on the whole controller, so what
  is protected is visible in one place. It costs two controllers for courts.
- **400 is a malformed request, 422 a well-formed one that breaks a rule.** The
  web app can tell a bug in its own code from a business refusal.
- **A booking is requested by `startsAt` as a UTC instant plus `hours`**, not
  by local date and time. An instant is unambiguous; local time is not on the
  night clocks change. The web app sends back the `startsAt` of the slot it
  was given.
- **The API computes `status`, `canCancel` and `cancellableUntil`**, so the
  web app does no time arithmetic. There are four statuses: `upcoming`,
  `in_progress`, `completed` and `cancelled`. The boundaries are half-open: at
  exactly `startsAt` a booking is `in_progress`, at exactly `endsAt` it is
  `completed`, and `cancelled` wins over the other three.
  `cancellableUntil` is always `startsAt` minus 2 hours, whatever the status;
  `canCancel` is true up to and including that instant, and false once the
  booking has started, ended or been cancelled. The upcoming list holds
  `upcoming` and `in_progress`; the past list holds `completed` and
  `cancelled`, because a cancelled booking is history, not something coming
  up.
- **Availability is for one facility day.** `GET /courts/:id/availability`
  takes an optional `date`, which defaults to the facility's today from the
  `Clock`. A slot that has begun is `past` even when it is booked.
- **`GET /facility` provides the facility's "today".** The browser's date can
  be a different day from the facility's, so the web app never derives
  defaults from its own clock.
- **Someone else's booking is a 404, not a 403**, so ids cannot be probed.
- **Cancelling is `POST /bookings/:id/cancel`, not `DELETE`.** Nothing is
  deleted; the row gets `cancelledAt`.
- **My bookings lists are filtered by derived status, not by a date range.**
  `GET /bookings/mine` loads the caller's bookings and keeps those whose
  `status` belongs to the requested scope, so the boundaries cannot drift from
  `booking-status.ts`. Upcoming is ordered by `startsAt` ascending and Past by
  `startsAt` descending, both with the court name as tie-break, so a cancelled
  booking for tomorrow sits above yesterday's completed one (D-088). Cancelling
  checks in a fixed order: not found or not yours `404`, already cancelled
  `409`, window closed `422` (one message for upcoming, in-progress and
  completed bookings, D-089), then an `UPDATE` conditional on
  `cancelledAt IS NULL`; if it touches no row, a concurrent cancel won and the
  answer is `409`. There is no `isActive` check, so a future booking on a
  deactivated court can be cancelled (D-090).
- **The admin day is the facility-local day.** `GET /admin/bookings` returns
  the bookings whose `startsAt` is in [local midnight, next local midnight),
  which is 25 or 23 hours on the days the clocks change. A booking that
  crosses midnight belongs to its start day. The day includes cancelled
  bookings and bookings on deactivated courts. The API computes
  `totalRevenueCents` and `bookingCount` over non-cancelled bookings only
  (D-005), and `cancelledCount` and `cancelledCents` for the rest (D-095). The
  order is `startsAt`, court name, then id (D-096). Each status comes from
  `booking-status.ts`. `date` defaults to the facility's today from the
  `Clock`, and the web app sends it explicitly (D-098).
- **The token is kept in `localStorage` and lives 8 hours, without refresh.**
  It survives a reload; the XSS exposure is accepted in SECURITY.md. Any 401
  outside login clears the session and sends the user back to sign-in with a
  "Session expired" notice.
- **Opening hours cross the wire as `"08:00"`–`"24:00"`.** Minutes from
  midnight stay a database detail.
- **Validation is split.** Contracts check shape and whatever one request can
  check by itself. Services check everything that needs stored data or "now":
  for example, a partial court update is validated after merging it with the
  stored court.

## Data model

Three tables; the full definitions are in `apps/api/prisma/schema.prisma`.

- **User**: `email` (unique), `passwordHash`, `name`, `role` (`USER` or
  `ADMIN`).
- **Court**: `name`, `sportType` (`PADEL`, `TENNIS`, `SQUASH`, `BADMINTON`),
  `pricePerHourCents`, `opensAtMinutes` and `closesAtMinutes`, `isActive`.
- **Booking**: `userId`, `courtId`, `startsAt`, `endsAt`, `totalPriceCents`,
  `cancelledAt`.

Constraints Prisma's schema language cannot express live as raw SQL in the
`booking_invariants` migration. The one that matters:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "courtId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE ("cancelledAt" IS NULL);
```

The same migration adds three CHECK constraints: a booking ends after it
starts (`booking_time_order`), a court's opening hours are valid
(`court_hours_valid`) and its price is positive (`court_price_positive`).

Why the model looks like this:

- **A booking is a time range, not a set of slot rows.** One row with
  `startsAt` and `endsAt`. Slot length and maximum duration are policy that
  can change in the service without touching the table, and the same model
  carries over to rentals of arbitrary length. It costs a constraint Prisma
  cannot describe, so the guarantee is in hand-written SQL.
- **No `status` column.** Only `cancelledAt`. The status is derived from time
  when read, in `bookings/booking-status.ts`, which takes "now" as an
  argument: `upcoming`, `in_progress`, `completed` or `cancelled`. A stored
  status would need something to update it when time passes, and would be
  wrong whenever that something lagged.
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
can both pass it. `POST /bookings` has no such check at all: it inserts, and
the filter turns the violation into `409 SLOT_TAKEN`.

Verified against PostgreSQL 17 by `apps/api/test/database.e2e-spec.ts`: ten
parallel inserts for one slot produce exactly one row and nine `23P01` errors
naming `booking_no_overlap`; adjacent slots both succeed; a partially
overlapping range is rejected; the slot can be booked again after
cancellation. Breaking the constraint on purpose (dropping it in the test
database) makes the parallel test fail with ten fulfilled inserts.

`apps/api/test/bookings.e2e-spec.ts` repeats the race through HTTP: ten
parallel `POST /api/bookings` for one slot, from two users, give exactly one
`201`, nine `409 SLOT_TAKEN` and one non-cancelled row. Without the pre-check,
dropping the constraint makes it fail with ten `201`s.
`apps/api/test/my-bookings.e2e-spec.ts` shows over HTTP that a cancelled slot
can be booked again by someone else.

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
  process and places demo bookings relative to today. The other exception is
  JWT issue and expiry, which use real system time inside `@nestjs/jwt`; that
  is security time, not business time. The `Clock` is never passed to the JWT
  library: tests that move the business clock would break authentication. Reading "now" only from the `Clock` is
  what makes "not in the past" and "cancel up to 2 hours before" testable.
- Instants cross the wire as UTC ISO strings. The web app does not compute
  with them; it formats them in the facility zone, never the browser's.
- The one thing the web app computes is calendar dates: it steps `YYYY-MM-DD`
  strings by whole days for the date strip, "Next day" and the Calendar
  (D-082). That uses no clock and no instants, and "today" still comes from
  `GET /facility`.
- A day's slots come from the court's opening and closing wall-clock times on
  that date. `openingHoursOn` sets each one on local midnight (`24:00` is the
  next midnight), which gives the right instant even when the clocks change
  during the day. Slots then step one real hour from the opening instant to
  the closing instant, and `POST /bookings` accepts exactly those starts.

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
  opt-out and is used for login and for `/api/health`, which the container
  healthcheck calls without a token. If health were authenticated, the `api`
  container would never become healthy and `web` would never start. Admin
  routes carry `@Roles('ADMIN')`.
- Ownership is enforced in queries: a user's booking is looked up by id and
  owner together, so another user's booking is simply not found.

## Assumptions

The brief leaves these open. They are decisions, not oversights.

- One facility, one time zone.
- Opening hours are the same every day and do not cross midnight.
- Slots start on the hour; a booking is 1 or 2 consecutive hours.
- Deactivating a court blocks new bookings. Existing future bookings stay
  valid and visible to the admin.
- Shortening a court's opening hours does not cancel existing bookings that
  fall outside the new hours, the same as deactivation.
- Expected revenue for a day is the sum of `totalPriceCents` of non-cancelled
  bookings that start on that facility-local day.
- Sport types are a fixed enum; adding one is a migration.

## Decisions

| Decision                                       | Buys                                                                                                        | Costs                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| npm workspaces, no Nx or Turborepo             | zero extra tooling to explain for three packages                                                            | no task cache; build order is the order of the `workspaces` array        |
| React + Vite, not Next.js                      | the whole app is behind login, so SSR and SEO buy nothing; static build served by nginx                     | no server rendering if a public page is ever needed                      |
| NestJS, not Express                            | explicit places for guards, validation pipes and exception filters; DI makes the clock replaceable in tests | more boilerplate than Express for an app this size                       |
| NestJS 11, not 12                              | `nestjs-zod` 5.5.0 supports NestJS 10 and 11 only; 11 is still maintained and keeps Jest and CommonJS       | not the newest major; a later migration to ESM                           |
| TypeScript 5.9.3 in every package              | one compiler version; `ts-jest` does not support TypeScript 7 yet                                           | not on the native compiler                                               |
| PostgreSQL                                     | exclusion constraints over time ranges; MySQL has none, MongoDB would need slot documents                   | a Postgres-specific guarantee                                            |
| Prisma 7                                       | readable schema, versioned migrations, typed client, simple seed                                            | cannot express the exclusion constraint; it lives in raw SQL             |
| Range plus exclusion constraint, not slot rows | policy changes without schema changes                                                                       | hand-written SQL; a non-obvious Prisma error to map                      |
| Zod schemas in a shared package                | one definition gives runtime validation and static types on both sides                                      | a build step for the API side                                            |
| Token in the `Authorization` header            | no CSRF surface, trivial to test                                                                            | the token is readable by JavaScript, so XSS exposes it                   |
| Same-origin `/api` through a proxy             | no CORS configuration, no API URL baked into the web build                                                  | the web container must be able to reach the API container                |
| Jest and Supertest against real PostgreSQL     | the concurrency test exercises the real constraint                                                          | tests need a running database                                            |
| shadcn/ui components inside `apps/web`         | one consumer, so no cross-package Tailwind setup                                                            | components are not reusable by another app without moving them           |
| Vitest in the web app, Jest in the API         | reuses the Vite config the web app already has (aliases, ESM, TSX) with no separate transform               | two test runners with different APIs (`vi` and `jest`) in one repository |
| Seed runs in the one-shot `migrate` service    | `api` starts only after migrations and seed succeed; the runtime image carries no Prisma CLI or dev tools   | `migrate` shares the API environment, so it also gets `JWT_SECRET`       |

## Known open problems

Not solved. Listed so nobody mistakes the gaps for decisions.

- **Migration drift.** Prisma does not know `booking_no_overlap` exists. At
  the time of writing, `prisma migrate dev --create-only` against the migrated
  database produced an empty migration, so Prisma does not try to drop the
  constraint. That must be re-checked, and every generated migration read
  before it is applied, whenever the schema changes. A test asserts the
  constraint is present in `pg_constraint`.
- **Daylight saving time.** Lisbon changes clocks on 25 October 2026, so that
  local day is 25 hours long (and 28 March 2027 is 23). Slots step real hours
  between the resolved opening and closing instants, so a court open 00:00 to
  24:00 has 25 slots on 25 October 2026, two of them labelled `01:00` with
  different `startsAt`, and 23 on 28 March 2027. A court open 08:00 to 23:00
  is unaffected. The web app must tell the two `01:00` slots apart by
  `startsAt`, not by label. Tested over HTTP for both availability and
  booking.
- **Sessions.** No refresh tokens, no logout that invalidates a token, no
  login rate limiting.
- **Lists are unpaginated.** `GET /bookings/mine` loads the caller's whole
  history for either scope and filters it in memory by derived status.
  Pagination would need the scope rewritten as a SQL predicate that matches
  `booking-status.ts`. `GET /admin/bookings` returns one whole facility day,
  also unpaginated (D-001).
- **No audit trail** of who cancelled or who changed a court.
- **Concurrent court edits.** Two PATCHes that each pass the merged-hours
  check against a stale row can both reach the database; the
  `court_hours_valid` CHECK rejects the second, which surfaces as a 500
  rather than a 400.
- **Frontend tests** cover only pure modules: `lib/format.ts` and
  `lib/local-date.ts` (both run in two far-apart time zones),
  `features/booking/slot-selection.ts`, `features/courts/court-form.ts`,
  `features/admin-bookings/admin-day.ts` and the
  API client (`api/client.ts`, with `fetch` mocked). There are no component or
  browser end-to-end tests, so routing, the session and the pages are checked
  by hand.
