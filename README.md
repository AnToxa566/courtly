# Courtly

Sports facility booking platform: users book padel and tennis courts by the
hour, admins manage courts and see daily bookings with expected revenue.
Take-home challenge for Procimo (Mid-Level Fullstack Software Developer).

The screens are the easy part. What I found interesting to engineer is that two
people must never hold the same court at the same time, even when their
requests arrive in the same instant, and that "now", "today" and "two hours
before" all have to mean the facility's clock (`Europe/Lisbon`), not the
server's and not the browser's. So the double-booking guarantee lives in the
database, all time logic lives in the API behind an injectable clock, and the
rest of the rules sit in services where they are easy to change and to test.

## Run it

Requirements: Docker with Docker Compose.

```bash
git clone https://github.com/AnToxa566/courtly.git courtly
cd courtly
docker compose up --build
```

This starts the database, runs the migrations and the seed, then starts the API
and the web app. To throw everything away, including the database volume, and
start from a clean state:

```bash
docker compose down -v
```

| What | URL                       |
| ---- | ------------------------- |
| Web  | http://localhost:8080     |
| API  | http://localhost:3000/api |

Seeded accounts:

| Role  | Email               | Password   |
| ----- | ------------------- | ---------- |
| Admin | admin@courtly.test  | courtly123 |
| User  | maria@courtly.test  | courtly123 |
| User  | daniel@courtly.test | courtly123 |

The seed creates four courts (two padel, one tennis and one deactivated squash
court) and eight bookings around today: past, upcoming and one cancelled. It is
idempotent: if users already exist it does nothing. The facility runs on Lisbon
time; all slots are shown in that zone regardless of where your browser is.

### Configuration

The API reads three environment variables and validates them with Zod at boot.
**If any of them is missing or empty, the API does not start**: the process
exits and the error names the variable. None of them has a default in code.

| Variable            | Required | Rule                                           |
| ------------------- | -------- | ---------------------------------------------- |
| `DATABASE_URL`      | yes      | PostgreSQL connection string                   |
| `JWT_SECRET`        | yes      | at least 32 characters                         |
| `FACILITY_TIMEZONE` | yes      | an IANA zone name, for example `Europe/Lisbon` |

`docker-compose.yml` sets development-only values for all three so that the
project starts with one command. For local development they come from
`apps/api/.env`, copied from `apps/api/.env.example`.

## Stack

| Layer     | Choice                                                                                   |
| --------- | ---------------------------------------------------------------------------------------- |
| Monorepo  | npm workspaces: `apps/api`, `apps/web`, `packages/contracts`                             |
| Web       | React 19, Vite 8, React Router, TanStack Query, react-hook-form, Tailwind CSS, shadcn/ui |
| API       | NestJS 11, JWT auth, nestjs-zod, Luxon                                                   |
| Contracts | Zod 4 schemas shared by API and web                                                      |
| Database  | PostgreSQL 17, Prisma 7                                                                  |
| Tests     | Jest and Supertest against a real PostgreSQL in the API, Vitest in the web app           |
| Language  | TypeScript 5.9, strict mode in every package                                             |

`packages/contracts` is the only definition of the API surface: request,
response and error schemas, one file per area (`auth`, `courts`,
`availability`, `bookings`, `admin`, `facility`, `errors`). The API validates
with those schemas and the web app infers its types from them, so neither side
has a hand-written copy of a shape.

## Stack choices and why

### React + Vite rather than Next.js

Every screen is behind a login, so server rendering and SEO buy nothing here. A
static Vite build served by nginx is the simplest thing that works, and nginx
also forwards `/api` to the API, so the browser talks to one origin and there is
no CORS setup. The cost is that a public page that needs server rendering would
mean adding something later.

### NestJS rather than Express

For an app this size Express would be less code. I chose NestJS because it gives
the rules a clear place to live: guards for authentication and roles, a
validation pipe for the Zod schemas, one exception filter for the error
envelope, and dependency injection, which is what lets tests replace the clock.
The price is more boilerplate. I stayed on NestJS 11 because `nestjs-zod` does
not support 12 yet.

### PostgreSQL

The one rule that must survive a race is "no overlapping bookings for a court",
and PostgreSQL can state it directly as an exclusion constraint over a time
range. MySQL has no equivalent, and MongoDB would push me to slot documents and
application-level locking. The cost is that the guarantee is specific to
PostgreSQL, and Prisma cannot express it, so it lives in a hand-written
migration.

## How double bookings are prevented

The guarantee is a PostgreSQL exclusion constraint, `booking_no_overlap`,
created in `apps/api/prisma/migrations/20261012111349_booking_invariants/migration.sql`:

```sql
ALTER TABLE "Booking"
  ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "courtId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  )
  WHERE ("cancelledAt" IS NULL);
```

A booking is one row with a start and an end. The database refuses two
non-cancelled rows for the same court whose ranges overlap. The range is
half-open, so 16:00–17:00 and 17:00–18:00 do not conflict, and the `WHERE`
clause means a cancelled booking frees its slot.

When two requests for the same slot arrive at the same instant, both `INSERT`s
run. The second waits on the first and fails with SQLSTATE `23P01` once the
first commits. The exception filter maps that error to `409 Conflict` with the
code `SLOT_TAKEN`. There is no application lock, no serializable transaction and
no "select, then insert".

A check in the service or the UI cannot be the guarantee, because two requests
can both pass it before either inserts. `POST /bookings` therefore has no
pre-check at all: it inserts, and the database decides. The web app only
refetches availability after a `409` so the user sees the slot as taken.

Two tests prove it against a real PostgreSQL, never a mock:

- `apps/api/test/database.e2e-spec.ts`: ten parallel inserts for one slot give
  exactly one row and nine `23P01` errors naming `booking_no_overlap`.
- `apps/api/test/bookings.e2e-spec.ts`: ten parallel `POST /api/bookings` for one
  slot, from two users, give one `201`, nine `409 SLOT_TAKEN` and one row.

Run them with the database up (`npm run db:up`):

```bash
npm run test:e2e -w @courtly/api -- 'test/(database|bookings)\.e2e-spec'
```

These tests are meant to fail without the constraint: with it dropped from the
test database, the parallel test ends with ten successful inserts.

## Assumptions

The brief leaves these open. They are decisions, not oversights; the full list
and the reasoning are in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

- One facility, one time zone (`FACILITY_TIMEZONE`).
- Opening hours are the same every day and do not cross midnight.
- Slots start on the hour; a booking is 1 or 2 consecutive hours.
- A booking is cancellable up to and including 2 hours before it starts.
- Deactivating a court blocks new bookings. Existing future bookings stay valid
  and visible to the admin; nothing is ever deleted.
- Shortening a court's opening hours does not cancel bookings that fall outside
  the new hours.
- Expected revenue for a day is the sum of the price of non-cancelled bookings
  that start on that facility-local day. A booking stores its price when it is
  made, so a later price change does not rewrite past revenue.
- Money is integer cents, and there is no registration: users are seeded.

## Development

Requirements: Node.js 24, Docker (for PostgreSQL).

```bash
npm ci
cp apps/api/.env.example apps/api/.env
npm run db:up                                  # PostgreSQL only
npm run db:deploy -w @courtly/api              # apply migrations
npm run db:seed -w @courtly/api                # demo data
npm run dev:api                                # API on :3000, watch mode
npm run dev:web                                # Vite on :5173
```

Open http://localhost:5173. Vite proxies `/api` to the API on port 3000, which
is the same single-origin setup nginx provides in Docker.

The API consumes the compiled build of `packages/contracts`. `dev:api` builds it
once on start; run `npm run dev:contracts` in a third terminal to rebuild it when
you change a schema. The web app reads the contracts source directly, so it
needs no rebuild.

```bash
npm run lint
npm test          # unit tests
npm run test:e2e  # API tests against PostgreSQL (needs npm run db:up)
npm run build
npm run format:check
```

## What I would do next

- **Login rate limiting and real sessions.** Today a token lives 8 hours with no
  refresh or revocation and sits in `localStorage`. I would move it to an
  `httpOnly` cookie with CSRF protection, add refresh tokens and throttle
  failed logins.
- **Frontend tests.** Only the pure modules (formatting, date stepping, slot
  selection, the API client) are tested. I would add component tests for the
  booking and cancellation flows and a browser end-to-end test of the full
  booking path.
- **Pagination.** `GET /bookings/mine` and `GET /admin/bookings` return whole
  lists. That is fine for the data volume here, not for a busy facility.

Everything known to be unsolved, with the reasons, is listed in
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), "Known open problems".

## More

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — boundaries, data model, decisions and their reasoning
- [docs/SECURITY.md](./docs/SECURITY.md) — threat model and what is and is not covered
- [AGENTS.md](./AGENTS.md) — rules for AI coding agents working in this repo
