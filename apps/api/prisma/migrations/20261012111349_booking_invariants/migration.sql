-- Hand-written: Prisma's schema language cannot express exclusion or CHECK
-- constraints, so the booking invariants live here. See ARCHITECTURE.md,
-- "Data model" and "Double bookings".

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
