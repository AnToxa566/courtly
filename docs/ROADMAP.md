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

| ID  | Item                                                                                                                                            | Depends on | Status | Notes                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------ |
| S1  | Workspace scaffold: npm workspaces, api, web, contracts                                                                                         | —          | done   |                                                        |
| S2  | Documents and agent set (README skeleton, ARCHITECTURE, SECURITY, AGENTS, subagents, `/feature`)                                                | S1         | done   |                                                        |
| B1  | Database: Prisma 7, schema, migrations, exclusion constraint, seed, DB tests                                                                    | S1         | done   |                                                        |
| B2  | Docker: compose, migrate job, api and web images, nginx, `/api` prefix                                                                          | B1         | done   |                                                        |
| C1  | Contracts: every request, response and error shape; API section in ARCHITECTURE                                                                 | B1         | done   |                                                        |
| B3  | Auth, global guards, `ApiException` and the error envelope                                                                                      | C1, B2     | done   |                                                        |
| W1  | Web foundation: theme, shell, routing, API client, sign in (mockups 01, 07)                                                                     | C1         | done   |                                                        |
| B4  | Facility, `Clock`, courts (user and admin endpoints)                                                                                            | B3         | done   |                                                        |
| W2  | Courts screens: player list and admin management (mockups 02, 05)                                                                               | W1, B4     | done   |                                                        |
| B5  | Availability and booking creation: `GET /courts/:id/availability`, `POST /bookings`, every creation rule, concurrency tests over HTTP, DST test | B4         | done   | D-Q1 settled by D-077 to D-080.                        |
| B6  | My bookings and cancellation: `GET /bookings/mine`, `POST /bookings/:id/cancel`, cancellation-window tests                                      | B5         | next   | Carry-overs from B5: see below.                        |
| W3  | Availability and booking screen (mockup 03)                                                                                                     | W2, B5     | done   | D-081 to D-087. Carry-overs from W3: see below.        |
| W4  | My bookings screen with cancellation (mockup 04)                                                                                                | W2, B6     | todo   | Handle the `in_progress` status (D-077).               |
| B7  | Admin daily bookings: `GET /admin/bookings` with revenue                                                                                        | B6         | todo   |                                                        |
| W5  | Admin daily bookings screen (mockup 06)                                                                                                         | W2, B7     | todo   |                                                        |
| Q1  | Whole-repository review: reviewer and architect against the brief, not a diff                                                                   | B7, W5     | todo   |                                                        |
| Q2  | Clean-clone run: `docker compose down -v && docker compose up`, every scenario by hand with two users and the admin                             | Q1         | todo   | Done by the human.                                     |
| R1  | README written by Anton                                                                                                                         | Q2         | todo   | Human only. Agents never write it (AGENTS.md rule 13). |
| R2  | Submission: commit history checked, repository shared                                                                                           | R1         | todo   | Human only.                                            |

## Carry-overs

Left behind by closed items; the item named must handle them.

- **B6** (from B5)
  - The upcoming and past filters use the same half-open boundaries as
    `bookingStatus` (D-077): a booking at exactly `endsAt` is `completed` and
    belongs to Past.
  - Cancel looks the booking up by id and owner together, checks
    `ALREADY_CANCELLED` first, then uses `bookingStatus().canCancel`.
  - The HTTP tests at exactly start − 2h and at start − 2h + 1 ms (D-064)
    belong here.
  - `bookings/booking-status.ts` already derives status, `canCancel` and
    `cancellableUntil`; B6 and B7 reuse it.
- **W4** (from B5)
  - The contract's booking status now includes `in_progress` (D-077).
- **W4** (from W3)
  - Creating a booking currently invalidates only the availability query.
    Once My bookings exists, a successful create must invalidate its query too.
    (If W4 is not the one to touch the booking-creation hook, whoever builds
    My bookings must still do this.)
- **Q1** (from W3, reviewer nits, non-blocking; fix or consciously accept)
  - `courtId` is not URI-encoded in the web API paths, so a crafted id shows
    an error banner instead of the not-found state (D-050).
  - Slots and dates stay clickable while a booking request is in flight.
    Likely resolved by the confirmation dialog (D-085), which locks its
    controls while pending; check that the grid behind it cannot be changed.
  - A contract-parse failure after a successful `POST /bookings` shows the
    network-error copy, though the booking exists.
  - The "Court booked" dialog's "{n} hours" would read wrongly for a 1-hour
    window; check the copy.
  - Not verified in W3: keyboard focus rings, screen-reader output, and real
    (unmocked) 404, 422 and network faults.
  - Added after W3 closed (D-085 to D-087), to verify against the code:
    the confirmation dialog's pending state (buttons and X disabled, Escape
    ignored, "Booking…"); no slot legend on the court page; sign-in lands on
    the role's home page whatever page the user came from, including after
    an expired session. Mockup state numbers 3G and 3H replace 3F and 3G.
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

| Requirement                                                        | Covered by                 | Status                                   |
| ------------------------------------------------------------------ | -------------------------- | ---------------------------------------- |
| Court model; admin create, edit, deactivate; history kept          | B1, B4, W2                 | done                                     |
| Day's hourly slots, available or taken, inside opening hours       | B5, W3                     | done                                     |
| Book 1 or 2 consecutive hours                                      | B5, W3                     | done                                     |
| No double booking, guaranteed in the database, tested concurrently | B1 (constraint), B5 (HTTP) | done                                     |
| No bookings in the past                                            | B5                         | done                                     |
| Cancel up to 2 hours before start, clear error after               | B6, W4                     | todo                                     |
| User's bookings, upcoming and past                                 | B6, W4                     | todo                                     |
| Admin: a day's bookings across courts with expected revenue        | B7, W5                     | todo                                     |
| Roles enforced by the API                                          | B3                         | done                                     |
| TypeScript strict, separate backend, real schema                   | S1, B1                     | done                                     |
| Seed: ≥3 courts, 2 users, 1 admin, some bookings                   | B1                         | done                                     |
| `docker compose up` starts everything                              | B2                         | done; re-checked in Q2                   |
| Tests: double booking, cancellation window, opening hours          | B1, B5, B6                 | partly: B6 (cancellation window) pending |
| README sections                                                    | R1                         | todo                                     |
| Clean commit history                                               | R2                         | ongoing                                  |
