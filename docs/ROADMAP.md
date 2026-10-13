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

| ID  | Item                                                                                                                                            | Depends on | Status | Notes                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------- |
| S1  | Workspace scaffold: npm workspaces, api, web, contracts                                                                                         | —          | done   |                                                                       |
| S2  | Documents and agent set (README skeleton, ARCHITECTURE, SECURITY, AGENTS, subagents, `/feature`)                                                | S1         | done   |                                                                       |
| B1  | Database: Prisma 7, schema, migrations, exclusion constraint, seed, DB tests                                                                    | S1         | done   |                                                                       |
| B2  | Docker: compose, migrate job, api and web images, nginx, `/api` prefix                                                                          | B1         | done   |                                                                       |
| C1  | Contracts: every request, response and error shape; API section in ARCHITECTURE                                                                 | B1         | done   |                                                                       |
| B3  | Auth, global guards, `ApiException` and the error envelope                                                                                      | C1, B2     | done   |                                                                       |
| W1  | Web foundation: theme, shell, routing, API client, sign in (mockups 01, 07)                                                                     | C1         | done   |                                                                       |
| B4  | Facility, `Clock`, courts (user and admin endpoints)                                                                                            | B3         | done   |                                                                       |
| W2  | Courts screens: player list and admin management (mockups 02, 05)                                                                               | W1, B4     | done   |                                                                       |
| B5  | Availability and booking creation: `GET /courts/:id/availability`, `POST /bookings`, every creation rule, concurrency tests over HTTP, DST test | B4         | next   | Largest and most important item. Needs D-Q1 answered before planning. |
| B6  | My bookings and cancellation: `GET /bookings/mine`, `POST /bookings/:id/cancel`, cancellation-window tests                                      | B5         | todo   |                                                                       |
| W3  | Availability and booking screen (mockup 03)                                                                                                     | W2, B5     | todo   | Needs D-Q2 answered before planning.                                  |
| W4  | My bookings screen with cancellation (mockup 04)                                                                                                | W2, B6     | todo   |                                                                       |
| B7  | Admin daily bookings: `GET /admin/bookings` with revenue                                                                                        | B6         | todo   |                                                                       |
| W5  | Admin daily bookings screen (mockup 06)                                                                                                         | W2, B7     | todo   |                                                                       |
| Q1  | Whole-repository review: reviewer and architect against the brief, not a diff                                                                   | B7, W5     | todo   |                                                                       |
| Q2  | Clean-clone run: `docker compose down -v && docker compose up`, every scenario by hand with two users and the admin                             | Q1         | todo   | Done by the human.                                                    |
| R1  | README written by Anton                                                                                                                         | Q2         | todo   | Human only. Agents never write it (AGENTS.md rule 13).                |
| R2  | Submission: commit history checked, repository shared                                                                                           | R1         | todo   | Human only.                                                           |

## Not planned

Considered and left out; picking one up needs a human decision.

| Item                                     | Why not now                                                       |
| ---------------------------------------- | ----------------------------------------------------------------- |
| CI pipeline (lint, tests, build on push) | Not in the brief; worth naming in "What I would do next".         |
| Frontend component or browser tests      | Bonus in the brief; pure-function Vitest tests exist instead.     |
| OpenAPI / Swagger                        | Contracts already document the shapes.                            |
| "Jump to the next day with free slots"   | Shown in mockup 03, but the API has no endpoint for it; see D-Q2. |

## Brief coverage

Every requirement in VISION.md, "What the brief requires", and where it is
satisfied.

| Requirement                                                        | Covered by                 | Status                                    |
| ------------------------------------------------------------------ | -------------------------- | ----------------------------------------- |
| Court model; admin create, edit, deactivate; history kept          | B1, B4, W2                 | done                                      |
| Day's hourly slots, available or taken, inside opening hours       | B5, W3                     | todo                                      |
| Book 1 or 2 consecutive hours                                      | B5, W3                     | todo                                      |
| No double booking, guaranteed in the database, tested concurrently | B1 (constraint), B5 (HTTP) | partly: constraint and DB-level test done |
| No bookings in the past                                            | B5                         | todo                                      |
| Cancel up to 2 hours before start, clear error after               | B6, W4                     | todo                                      |
| User's bookings, upcoming and past                                 | B6, W4                     | todo                                      |
| Admin: a day's bookings across courts with expected revenue        | B7, W5                     | todo                                      |
| Roles enforced by the API                                          | B3                         | done                                      |
| TypeScript strict, separate backend, real schema                   | S1, B1                     | done                                      |
| Seed: ≥3 courts, 2 users, 1 admin, some bookings                   | B1                         | done                                      |
| `docker compose up` starts everything                              | B2                         | done; re-checked in Q2                    |
| Tests: double booking, cancellation window, opening hours          | B1, B5, B6                 | partly                                    |
| README sections                                                    | R1                         | todo                                      |
| Clean commit history                                               | R2                         | ongoing                                   |
