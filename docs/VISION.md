# Vision

Courtly is a take-home challenge for Procimo (Mid-Level Fullstack Software
Developer): a small booking platform for one sports facility where users book
padel and tennis courts by the hour and an admin manages courts and sees the
day's bookings and revenue.

It is judged by engineers who clone the repository, run `docker compose up`,
click through the app and then read the code. After that comes an interview
where the author changes behaviour live and defends every line. Everything
below follows from that.

## Deadline

**Wednesday 14 October 2026, 13:06 Lisbon time (15:06 in Sofia).** Work that
cannot be finished, reviewed and explained before then is not started.

## Who uses it

- **User** (a player): signs in, browses active courts, picks a court and a
  date, sees hourly slots, books 1 or 2 consecutive hours, sees upcoming and
  past bookings, cancels up to 2 hours before start.
- **Admin**: creates, edits, deactivates and reactivates courts; sees every
  booking of a chosen day across all courts with the expected revenue.

Sign-in uses seeded accounts. There is no registration.

## What the brief requires

The source of every roadmap item. "Brief coverage" in ROADMAP.md tracks each
line.

- Courts: name, sport type, hourly price, opening hours, active flag. Admin
  creates, edits, deactivates; deactivation keeps booking history.
- Availability: a court and a date give the day's 1-hour slots, available or
  taken, respecting opening hours and existing bookings.
- Bookings: 1 or 2 consecutive hours; no double booking, including two
  requests at the same instant, guaranteed in the database; not in the past;
  cancel up to 2 hours before start, with a clear error after that; a user's
  own list, upcoming and past.
- Admin view: all bookings of a day across courts, with total expected revenue.
- Roles enforced by the API, not only hidden in the UI.
- TypeScript strict everywhere; React or Next.js; Express or NestJS with a
  separate backend; PostgreSQL, MySQL or MongoDB with a real schema.
- Seed data: at least 3 courts, 2 users, 1 admin, a handful of bookings.
- `docker compose up` starts frontend, backend, database, migrations and seed.
- Tests: mandatory backend tests for double-booking prevention, the
  cancellation window and opening-hours validation. Frontend tests are a bonus.
- README written by the author: how to run, stack choices as trade-offs, how
  double bookings are prevented, what comes next.
- A clean commit history that tells the story of the work.

## What the evaluators weigh

Correctness of the business rules, data modelling, API design and error
handling, code organisation, tests, the Docker setup and the reasoning in the
README. UI polish matters less than correctness and clarity, but the app must
be usable without reading the code.

## Principles for every decision

1. **Correct over complete.** A booking rule that is subtly wrong costs more
   than a missing nicety. The booking rules and their tests come first.
2. **Explainable over clever.** The author defends every line live. No
   abstraction with one implementation, no helper with one caller, no
   dependency nobody asked for.
3. **The brief is the scope.** Anything it does not ask for is out unless it
   makes a required part clearer or safer, and then it is a recorded decision.
4. **One command, every time.** If `docker compose up` on a clean clone breaks,
   nothing else matters.
5. **Name the gaps.** What is deliberately not done is written down
   (ARCHITECTURE.md, "Known open problems"), so a gap reads as a decision.

## Not the goal

Registration, payments, recurring bookings, multiple facilities, per-day
opening hours, notifications, a booking horizon, pagination, dark mode,
internationalisation, admin cancelling other users' bookings.

## Where everything else lives

- ROADMAP.md: what is done, what is next, what each item depends on
- DECISIONS.md: every decision taken so far, and the questions still open
- ARCHITECTURE.md: structure, data model, API, and the trade-offs behind them
- AGENTS.md: rules for coding agents
- SECURITY.md: threat model
- `design/` (local, gitignored): DESIGN.md, theme and one mockup per screen
