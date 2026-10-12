# Courtly

Sports facility booking platform: users book padel and tennis courts by the
hour, admins manage courts and see daily bookings with expected revenue.
Take-home challenge for Procimo (Mid-Level Fullstack Software Developer).

<!--
  TODO(Anton) — write this opening yourself (the brief requires the README to
  be written by the candidate). Two or three sentences on what is actually
  interesting to engineer here, not a feature list. Material to draw from:
  - two requests for the same slot at the same instant (ARCHITECTURE.md, "Double bookings")
  - "now", "today" and "2 hours before" in a facility time zone that is not
    the server's or the browser's (ARCHITECTURE.md, "Time")
  - which rules belong in the database and which in the service
    (ARCHITECTURE.md, "Invariants and policy")
-->

## Run it

Requirements: Docker with Docker Compose.

```bash
git clone <repo-url> courtly
cd courtly
docker compose up
```

<!-- TODO(Anton) — confirm every value below against docker-compose.yml and the seed before submitting. -->

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

The seed also creates three courts and a handful of bookings. The facility
runs on Lisbon time (`Europe/Lisbon`); all slots are shown in that zone
regardless of where your browser is.

## Stack

| Layer     | Choice                                                                                   |
| --------- | ---------------------------------------------------------------------------------------- |
| Monorepo  | npm workspaces: `apps/api`, `apps/web`, `packages/contracts`                             |
| Web       | React 19, Vite 8, React Router, TanStack Query, react-hook-form, Tailwind CSS, shadcn/ui |
| API       | NestJS 11, JWT auth, nestjs-zod, Luxon                                                   |
| Contracts | Zod 4 schemas shared by API and web                                                      |
| Database  | PostgreSQL 17, Prisma 7                                                                  |
| Tests     | Jest, Supertest, real PostgreSQL                                                         |
| Language  | TypeScript 5.9, strict mode in every package                                             |

## Stack choices and why

<!--
  TODO(Anton) — 2–3 sentences each, in your own words, as trade-offs.
  The decisions and what each one costs are recorded in ARCHITECTURE.md,
  "Decisions". The brief asks for at least these three:
-->

### React + Vite rather than Next.js

### NestJS rather than Express

### PostgreSQL

## How double bookings are prevented

<!--
  TODO(Anton) — the mechanism and where it lives. Cover:
  - the constraint itself and the migration file that creates it
  - what happens to the second of two simultaneous requests, and what the
    API returns
  - why a check in the service or the UI is not the guarantee
  - the test that proves it and how to run it
  Source: ARCHITECTURE.md, "Double bookings".
-->

## Assumptions

<!--
  TODO(Anton) — the brief leaves these open; say what you decided.
  Listed in ARCHITECTURE.md, "Assumptions".
-->

## Development

Requirements: Node.js 24, Docker (for PostgreSQL).

```bash
npm ci
npm run dev:api       # API with watch mode
npm run dev:web       # Vite dev server
npm run dev:contracts # rebuild contracts on change (API reads the build)
```

```bash
npm run lint
npm test          # unit tests
npm run test:e2e  # API tests against PostgreSQL
npm run build
```

## What I would do next

<!--
  TODO(Anton) — be specific. Candidates are listed in ARCHITECTURE.md,
  "Known open problems". Pick the ones you would really do first and say why.
-->

## More

- [ARCHITECTURE.md](./ARCHITECTURE.md) — boundaries, data model, decisions and their reasoning
- [SECURITY.md](./SECURITY.md) — threat model and what is and is not covered
- [AGENTS.md](./AGENTS.md) — rules for AI coding agents working in this repo
