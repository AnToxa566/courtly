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

None.

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

- **D-081** · 2026-10-13 · Planning · On a fully booked day the availability
  screen shows the empty-state card with a "Next day" button that moves the
  selected date one day forward. There is no new endpoint and no search for
  free days, and the card makes no claim about the next day's availability.
  This supersedes `design/DESIGN.md` §5 "jump to next day with availability"
  and the mockup 3E copy "Sunday 11 October has 7 free hours" / "Show Sun 11
  Oct". Why: finding the next free day needs a search endpoint that the brief
  does not ask for. Answers the former D-Q2 and accepts its proposal.

- **D-083** · 2026-10-13 · Planning · A day with no `available` slot that is
  not fully booked (all slots past, or past mixed with booked) shows the same
  card and "Next day" button as D-081, titled "No free hours on {date}"
  instead of "fully booked". The summary bar is hidden. Why: "fully booked"
  would be false when some slots are only past.

- **D-084** · 2026-10-13 · Planning · A non-409 error from `POST /bookings`
  shows the API's `message` in the same banner above the grid, clears the
  selection and refetches availability. A 404 shows "not found" (D-050). A
  non-API (network) failure shows "We couldn't reach the server. Try again."
  Why: the selection may rest on stale data, so the grid is refreshed, and the
  user always sees a reason.

- **D-085** · 2026-10-13 · Planning · Booking has a confirmation step
  (mockup 03, state 3F "Confirm booking"). "Book court" only opens the
  confirmation dialog and sends nothing; "Confirm booking" sends
  `POST /bookings`. While the request is pending, both dialog buttons and the
  X are disabled, Escape does nothing, and the confirm button shows a spinner
  and "Booking…". Success replaces the dialog with the "Court booked" dialog
  (3G). A 409 or any other error closes the dialog and shows the banner above
  the grid (D-084 still decides the banner text and what happens to the
  selection and availability). "Change time" closes the dialog and keeps the
  selection. This refines the W3 flow in D-084 and the earlier mockup
  numbering: the success state, formerly 3F, is now 3G, and the 409 state,
  formerly 3G, is now 3H. Why: a booking is a commitment, and the user sees
  court, time and price before anything is sent.

- **D-086** · 2026-10-13 · Planning · The slot legend (Available / Selected /
  Booked / Past chips) is removed from the court page and is not added back.
  In the mockups it only explains the states; in the app each slot already
  says its state in words. This departs from mockup 03 and any `design/`
  description of the legend. Why: it repeats what each slot already says.

- **D-087** · 2026-10-13 · Planning · After sign-in, every user lands on their
  role's home page via `/`: admins on `/admin/bookings`, players on `/courts`
  (D-010). The "return to the page you asked for" behaviour is removed. After
  a session expires the user signs in and lands on their home page, not on the
  page they were on. This refines D-010. Why: returning to the requested page
  sent players to `/admin/courts` (a 403) after an admin had signed out there,
  and sent admins to `/courts`.

- **D-088** · 2026-10-13 · Planning · The Past list is sorted by `startsAt`
  descending, with court name as the tie-break, for every Past item. A
  cancelled booking for tomorrow therefore sits above yesterday's completed
  one. This refines D-008, which says only "Past is newest first". Rejected:
  completed bookings first with cancelled ones grouped after them, and sorting
  cancelled bookings by `cancelledAt`. Why: one sort key for the whole list,
  and the order stays predictable.

- **D-089** · 2026-10-13 · Planning · `CANCELLATION_WINDOW_CLOSED` has one
  message for every case: "Bookings can only be cancelled up to 2 hours before
  they start", with the number taken from `CANCELLATION_WINDOW_HOURS`. It
  applies to upcoming, in-progress and completed bookings alike. The web app
  shows the API message as the reason (D-009). Rejected: two separate
  messages, and a fixed text in the web app that ignores the API message. Why:
  the 2-hour rule stays one rule (D-077), and the web app never restates a
  rule the API owns.

- **D-092** · 2026-10-13 · Agent question · On the My bookings screen, an
  Upcoming row with `canCancel` false (inside the window, or `in_progress`)
  shows the lock (D-009) with the title "Can't cancel anymore" and the second
  line "Cancelling closes {cancellationWindowHours} hours before start.", the
  number taken from `GET /facility`. There is no countdown (D-082). The text is
  the same for in-window and `in_progress` rows. Why: the 2-hour rule stays one
  rule (D-077), and the web app has no clock to count down with.

- **D-093** · 2026-10-13 · Agent question · An `in_progress` booking (D-077)
  shows the badge "In progress", in the same green-tint style as Upcoming. Why:
  it is still an upcoming-list item, and the label says what is true without a
  new colour.

- **D-094** · 2026-10-13 · Agent question · On the My bookings screen, a
  network failure or an unparseable response uses the D-084 wording "We
  couldn't reach the server. Try again." When cancelling, the dialog stays open
  with that text as its banner and a "Close" button. When loading the list, the
  screen shows an inline error state with a "Retry" button. Why: one wording
  for the same failure across screens, and the user can always try again.

- **D-095** · 2026-10-13 · Planning · `adminDaySchema` gains `cancelledCount`
  and `cancelledCents`. The API computes them; the web app only displays them.
  The revenue note "N cancelled booking(s) (€X) excluded" is hidden when
  `cancelledCount` is 0. Refines D-005. Why: all money arithmetic stays in the
  API, and the web app does no sums.

- **D-096** · 2026-10-13 · Planning · `GET /admin/bookings` orders bookings by
  `startsAt` ascending, then court name ascending, then `id` ascending. Why: a
  day reads as a timeline, and the final `id` key makes the order
  deterministic.

- **D-097** · 2026-10-13 · Planning · On Daily bookings, an `in_progress`
  booking shows the badge "In progress" in the Upcoming green tint. Extends
  D-093. Why: one label and one colour for the same status on every screen.

- **D-098** · 2026-10-13 · Planning · The web app always sends `?date=` to
  `GET /admin/bookings`. The first value is today from `GET /facility`. The API
  default (facility today from the `Clock`) stays as the fallback. Why: the web
  app has no clock (D-082), and the URL always says which day is shown.

## Process

- **D-022** · 2026-10-12 · Planning · `design/` is reference,
  never in the Docker context. It is binding for visuals.

- **D-023** · 2026-10-12 · Planning · Backend and web items may run in
  parallel in separate branches or worktrees. A worktree needs `design/` and
  `apps/api/.env` copied in.

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

- **D-082** · 2026-10-13 · Planning · The web app may step calendar dates by
  whole days on `YYYY-MM-DD` strings (date strip, "Next day", Calendar). This
  uses no clock and no instants. "Today" comes from `GET /facility`. Every
  other time rule (past, booked, cancellable, instants) stays in the API.
  Refines AGENTS.md rule 4, "does no time arithmetic": calendar-date stepping
  on strings is allowed, nothing else. Why: the date strip needs neighbouring
  dates, and an endpoint for that would add nothing the API must guard.

- **D-090** · 2026-10-13 · Planning (planner answer, no human decision needed)
  · Cancelling a booking makes no `isActive` check on the court, so a future
  booking on a deactivated court can still be cancelled. Source:
  ARCHITECTURE.md "Assumptions" and D-077. Recorded for traceability.

- **D-091** · 2026-10-13 · Planning (planner decision) · `GET /bookings/mine`
  returns a bare `Booking[]` and adds no list schema to contracts, the same as
  `GET /courts`. Recorded for traceability.
