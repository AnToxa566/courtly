# Decisions

The log of product and process decisions for Courtly, so that a question
answered once is never asked again. Maintained by the `product-owner` agent;
every entry was confirmed by the human (Anton).

How this file relates to the others:

- Structural decisions and their trade-offs live in ARCHITECTURE.md
  ("Decisions", "Assumptions", "API"); rules for agents live in AGENTS.md;
  visual decisions live in `design/DESIGN.md`. None of them is repeated here.
- When an entry changes something ARCHITECTURE.md or AGENTS.md describes, the
  task that implements it updates that document too.
- An entry is never edited to mean something else. A changed decision gets a
  new entry that says which one it supersedes, and the old one is marked
  `superseded by D-…`.
- On 2026-10-13 the entries that only restated ARCHITECTURE.md, AGENTS.md or
  the code were removed. Their numbers are not reused.

Entry format: `D-NNN` · date · how it was decided · the decision, then why.
"Planning" means agreed in the planning chat; "Agent question" means answered
by Anton when an agent asked during a `/feature` run.

## Open questions

Need a human answer before the item named in brackets can be planned.

- **D-Q2** [W3] Mockup 03 shows "jump to the next day with free slots" on a
  fully booked day, which the API cannot answer. **Proposal (needs human
  confirmation):** show the fully booked empty state with a "Next day" button
  that moves one day forward; no new endpoint. Why: finding the next free day
  needs a search endpoint that the brief does not ask for.

## Product and scope

- **D-001** · 2026-10-09 · Planning · Scope is exactly the brief; the
  non-goals are listed in VISION.md. Admins cannot cancel other users'
  bookings; there is no booking horizon and no pagination.

- **D-005** · 2026-10-09 · Planning · Expected revenue for a day = sum of
  `totalPriceCents` of non-cancelled bookings that start on that facility day.
  Cancelled bookings are listed, struck through, and excluded.
  `bookingCount` counts non-cancelled bookings only.

- **D-007** · 2026-10-12 · Planning · "Not in the past" means the start must
  be strictly after now. A slot whose hour has already begun is `past` and
  cannot be booked.

- **D-008** · 2026-10-12 · Planning · Cancelled bookings belong to the Past
  list, whatever their date. Upcoming is soonest first; Past is newest first.

- **D-009** · 2026-10-12 · Planning · Inside the 2-hour window the cancel
  action is replaced by a lock and the reason, never silently hidden. A
  server rejection keeps the dialog open with the reason and refreshes the list.

- **D-010** · 2026-10-12 · Planning · After sign-in, admins land on Daily
  bookings and users on Courts. Admins have no booking screens in the web app.

- **D-011** · 2026-10-09 · Planning · Seed: admin@courtly.test,
  maria@courtly.test, daniel@courtly.test, password `courtly123`; four courts
  including an inactive Squash court with past history; eight bookings
  relative to the facility's "today". The seed runs once (skips when users
  exist).

- **D-012** · 2026-10-09 · Planning · No "Demo accounts" box on the sign-in
  page, even though mockup 01 shows one. Credentials go in the README.

- **D-050** · 2026-10-13 · Planning · A malformed `:id` is 400, an unknown or
  inactive court is 404; the web app treats both as "not found".
  `/courts` is sorted by name; `/admin/courts` active first, then by name.

- **D-077** · 2026-10-13 · Agent question · A booking has one of four
  statuses: `upcoming`, `in_progress`, `completed`, `cancelled`. Boundaries
  are half-open: at exactly `startsAt` it is `in_progress`, at exactly
  `endsAt` `completed`; `cancelled` wins over the time-based statuses.
  `GET /bookings/mine?scope=upcoming` returns `upcoming` and `in_progress`;
  `scope=past` returns `completed` and `cancelled` (D-008 ordering
  unchanged). `cancellableUntil` is always `startsAt` minus 2 hours, with no
  special case; `canCancel` is true when now ≤ `startsAt` minus 2 hours, so
  exactly 2 hours before is still cancellable, and it is false for
  `in_progress`, `completed` and `cancelled`. Why: calling a booking that has
  not ended "completed" or "past" would be false, and the 2-hour rule stays
  one rule. Answers the former D-Q1 and rejects its proposal that the booking
  stays `upcoming`.

- **D-078** · 2026-10-13 · Agent question · In availability, a slot whose
  hour has begun is `past` even if a booking covers it, consistent with
  D-007. `GET /courts/:id/availability` without `date` uses the facility's
  "today" from the `Clock`. Why: every slot follows one rule, and the web app
  never derives a date from the browser clock.

- **D-079** · 2026-10-13 · Agent question · When several creation rules
  fail, `POST /bookings` checks them in this order: court exists (404
  `NOT_FOUND`), court active (422 `COURT_INACTIVE`), `NOT_ON_THE_HOUR`,
  `BOOKING_IN_PAST`, `OUTSIDE_OPENING_HOURS`, then the insert (409
  `SLOT_TAKEN`). Why: basic input errors first; the database check last
  because it is the only racy one.

## Process

- **D-022** · 2026-10-12 · Planning · `design/` is local reference, gitignored,
  never in the repository or the Docker context. It is binding for visuals.

- **D-023** · 2026-10-12 · Planning · Backend and web items may run in
  parallel in separate branches or worktrees. A worktree needs `design/` and
  `apps/api/.env` copied in, because both are gitignored.

## Implementation

- **D-033** · 2026-10-09 · Planning · Visual direction "Clay club" with Clay
  as the primary action colour; Brick is never a fill. Details in DESIGN.md.

- **D-064** · 2026-10-12 · Planning · Booking tests go through HTTP:
  parallel requests for one slot give exactly one 201; boundaries at exactly
  2 hours before start, a booking ending exactly at closing time, a start
  exactly at "now"; a day on 25 October 2026, when Lisbon's clocks go back.

- **D-076** · 2026-10-12 · Planning · shadcn components are added only when a
  screen renders them, and adjusted to DESIGN.md inside the component files.

- **D-080** · 2026-10-13 · Agent question · A day's slots come from the
  court's opening and closing wall-clock times on that date, resolved to
  instants, then stepped one real hour at a time. On 25 October 2026 a
  00:00–24:00 court has 25 slots, two labelled 01:00 with different
  `startsAt`; on 28 March 2027 it has 23. Availability and `POST /bookings`
  accept exactly the same starts; courts open 08:00–23:00 are unaffected.
  Why: every offered slot is bookable, and a fixed 24 hours is never added.
  Refines the "walk wall-clock hours" wording in ARCHITECTURE.
