// Policy numbers, defined once. GET /facility serves them so the web app never
// hard-codes them, and the bookings service imports the same constants.
export const CANCELLATION_WINDOW_HOURS = 2;
export const MAX_BOOKING_HOURS = 2;
