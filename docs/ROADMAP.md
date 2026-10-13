# Roadmap

Maintained by the `product-owner` agent. Status changes only after an item has
passed review (and architect sign-off where it applies), or by an explicit
decision of the human.

Statuses: `done` · `next` (ready: every dependency is done) · `todo` (waiting
on a dependency) · `in progress` · `blocked` (needs a human decision, named in
the notes) · `dropped` (a recorded decision says why).

Deadline: Wednesday 14 October 2026, 13:06 Lisbon (15:06 Sofia).

## Delivery order

Backend items run first; each web item follows the backend item it depends
on. A backend item and an unrelated web item can run in parallel, in separate
branches.

| ID  | Item                                                                                                                                            | Depends on | Status | Notes                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------- |
| S1  | Workspace scaffold: npm workspaces, api, web, contracts                                                                                         | —          | done   |                                                                               |
| S2  | Documents and agent set (README skeleton, ARCHITECTURE, SECURITY, AGENTS, subagents, `/feature`)                                                | S1         | done   |                                                                               |
| B1  | Database: Prisma 7, schema, migrations, exclusion constraint, seed, DB tests                                                                    | S1         | done   |                                                                               |
| B2  | Docker: compose, migrate job, api and web images, nginx, `/api` prefix                                                                          | B1         | done   |                                                                               |
| C1  | Contracts: every request, response and error shape; API section in ARCHITECTURE                                                                 | B1         | done   |                                                                               |
| B3  | Auth, global guards, `ApiException` and the error envelope                                                                                      | C1, B2     | done   |                                                                               |
| W1  | Web foundation: theme, shell, routing, API client, sign in (mockups 01, 07)                                                                     | C1         | done   |                                                                               |
| B4  | Facility, `Clock`, courts (user and admin endpoints)                                                                                            | B3         | done   |                                                                               |
| W2  | Courts screens: player list and admin management (mockups 02, 05)                                                                               | W1, B4     | done   |                                                                               |
| B5  | Availability and booking creation: `GET /courts/:id/availability`, `POST /bookings`, every creation rule, concurrency tests over HTTP, DST test | B4         | done   | D-Q1 settled by D-077 to D-080.                                               |
| B6  | My bookings and cancellation: `GET /bookings/mine`, `POST /bookings/:id/cancel`, cancellation-window tests                                      | B5         | done   | D-088 to D-091. Reused by B7 and W4: see below.                               |
| W3  | Availability and booking screen (mockup 03)                                                                                                     | W2, B5     | done   | D-081 to D-087. Carry-overs from W3: see below.                               |
| W4  | My bookings screen with cancellation (mockup 04)                                                                                                | W2, B6     | done   | Reviewer approved (round 2). No browser check yet: see Q2 and Q1 carry-overs. |
| B7  | Admin daily bookings: `GET /admin/bookings` with revenue                                                                                        | B6         | done   | Reviewer and architect approved. Carry-overs below.                           |
| W5  | Admin daily bookings screen (mockup 06)                                                                                                         | W2, B7     | done   | Reviewer and architect approved. Browser-checked locally; Q2 on Docker.       |
| Q1  | Whole-repository review: reviewer and architect against the brief, not a diff                                                                   | B7, W5     | done   | Reviewer round 4 and architect round 2 approved. Outcome below.               |
| Q2  | Clean-clone run: `docker compose down -v && docker compose up --build`, every scenario by hand with two users and the admin                     | Q1         | done   | Done by the human.                                                            |
| R1  | README written by Anton                                                                                                                         | Q2         | todo   | Human only. Agents never write it (AGENTS.md rule 13).                        |
| R2  | Submission: commit history checked, repository shared                                                                                           | R1         | todo   | Human only.                                                                   |

## Carry-overs

Left behind by closed items; the item named must handle them.

- **B7** (from B5, B6)
  - `bookings/booking-status.ts` derives status, `canCancel`,
    `cancellableUntil` and now `bookingScope(status)`; B7 reuses it rather
    than restating the boundaries (D-077).
- **Q2** (from W4)
  - No browser check was run on the My bookings screen. By hand, with Maria,
    Daniel and the admin: isolation and counts per user; cancel success flow
    (nothing sent before confirm, controls inert while pending, toast, counts
    update); a new booking inside the 2-hour window shows the lock; the
    window-closed case (4D) via a second tab; network failure with the API
    stopped; an `in_progress` row (dev-only SQL insert); 375px vs desktop
    layout with a single filled Clay button per state; tab keyboard
    navigation; focus landing on the Tabs root after cancel and after closing
    4D; W2 court dialogs still returning focus.
- **Q1 outcome** (closed 2026-10-13)
  - Whole-repo trace of every AGENTS.md rule and VISION requirement passed.
    Rule 11 failed (13 caret ranges in `apps/web/package.json`); pinned.
    Architect findings fixed: `main.ts` listens on 3000 with no unvalidated
    `PORT` read; `MAX_BOOKING_HOURS` wired on both sides (D-099).
  - Resolved: grid locked while a booking is pending; D-085 pending state; no
    slot legend; sign-in lands on the role home.
  - Accepted as nits, not fixed: list error always uses network wording;
    `isError` replaces a cached list; cross-feature imports of
    `useReturnFocus`, `STATUS_BADGE`, `NETWORK_MESSAGE` (architect: accept;
    sharing `STATUS_BADGE` enforces D-097); refreshed toast shows before the
    refetch ends; unlabelled fallback focus target; Intl zone read in a test;
    `courtId` not URI-encoded (GET only); contract-parse failure after POST
    shows network copy; "{n} hours" in the booked dialog (value is 2 today);
    years 0 to 99 map to the 1900s.
  - Architect rulings accepted: bookings imports the facility booking-policy
    constants; web price x hours preview is a sanctioned exception to D-095
    (a D-entry naming it is the human's call); network wording duplicated in
    5 places (optional).
- **Q2** (from Q1: left for the human by hand)
  - Focus rings by eye, screen-reader output, and real 404, 422 and network
    faults.
- **Q2** (from B7, W5)
  - Docker compose clean start was not run (no Docker in the executor
    environment); the admin day view was checked only against local
    PostgreSQL and dev servers.
- **Open edge, for Anton** (from B7, inferred, not run)
  - `GET /admin/bookings?date=9999-12-31` and `?date=0000-01-01` probably
    return 500 rather than 400, the same root cause as the year 10000 edge
    below. Needs the same human decision on D-001. Nothing is recorded.
- **Open edge, for Anton** (from W3)
  - AGENTS.md "Where code goes" has no row for `apps/web/src/features/`
    (booking screen lives in `features/booking/`). Whether to add one is the
    human's call; agents do not edit it unasked.
- **Open edge, for Anton** (from B5, inferred, not run)
  - A date in year 10000 (for example `?date=9999-12-31` on a court that
    closes at 24:00) cannot be serialized: availability returns 500, and
    `POST /bookings` saves the booking but still returns 500. Setting an upper
    bound on the date contradicts or refines D-001 ("no booking horizon"), so
    it needs a human decision. Nothing is recorded.

## Not planned

Considered and left out; picking one up needs a human decision.

| Item                                     | Why not now                                                    |
| ---------------------------------------- | -------------------------------------------------------------- |
| CI pipeline (lint, tests, build on push) | Not in the brief; worth naming in "What I would do next".      |
| Frontend component or browser tests      | Bonus in the brief; pure-function Vitest tests exist instead.  |
| OpenAPI / Swagger                        | Contracts already document the shapes.                         |
| "Jump to the next day with free slots"   | Shown in mockup 03, but the API has no endpoint for it; D-081. |

## Brief coverage

Every requirement in VISION.md, "What the brief requires", and where it is
satisfied.

| Requirement                                                        | Covered by                 | Status                                |
| ------------------------------------------------------------------ | -------------------------- | ------------------------------------- |
| Court model; admin create, edit, deactivate; history kept          | B1, B4, W2                 | done                                  |
| Day's hourly slots, available or taken, inside opening hours       | B5, W3                     | done                                  |
| Book 1 or 2 consecutive hours                                      | B5, W3                     | done                                  |
| No double booking, guaranteed in the database, tested concurrently | B1 (constraint), B5 (HTTP) | done                                  |
| No bookings in the past                                            | B5                         | done                                  |
| Cancel up to 2 hours before start, clear error after               | B6, W4                     | done (B6, W4); W4 browser check in Q2 |
| User's bookings, upcoming and past                                 | B6, W4                     | done (B6, W4); W4 browser check in Q2 |
| Admin: a day's bookings across courts with expected revenue        | B7, W5                     | done (B7, W5); Docker run in Q2       |
| Roles enforced by the API                                          | B3                         | done                                  |
| TypeScript strict, separate backend, real schema                   | S1, B1                     | done                                  |
| Seed: ≥3 courts, 2 users, 1 admin, some bookings                   | B1                         | done                                  |
| `docker compose up` starts everything                              | B2                         | done; re-checked in Q2                |
| Tests: double booking, cancellation window, opening hours          | B1, B5, B6                 | done (B1, B5, B6)                     |
| README sections                                                    | R1                         | todo                                  |
| Clean commit history                                               | R2                         | ongoing                               |
