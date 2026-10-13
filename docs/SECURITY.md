# Security

Courtly stores user emails, names and password hashes, and signs
authentication tokens with a secret. It is a take-home project that runs
locally; this document says what is protected, what is not, and what would
have to change before it faced real users.

Sensitive: password hashes (`User.passwordHash`), the `JWT_SECRET` and
`DATABASE_URL` environment variables, and user emails, names and booking
history.

## Threat model

| Threat                                              | Mitigation                                                                                                                                                                                                                                                       | State                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| A user calls an admin endpoint directly             | Routes are authenticated by default; admin routes require `@Roles('ADMIN')`, checked in the API. The courts e2e covers every admin court route. The admin bookings e2e covers `GET /admin/bookings`: 401 without a token, 403 for a user and for a demoted admin | done                     |
| A user reads or cancels someone else's booking      | Bookings are queried by id and owner together; the acting user comes from the token, never the request body. Creation uses the token's user and strips a body `userId` (bookings e2e). Reading and cancelling: my-bookings e2e                                   | done                     |
| A forged or edited token claims a higher role       | The token carries only the user id; the role is read from the database on every request. Covered by the auth e2e                                                                                                                                                 | done                     |
| Password hashes leak through an API response or log | Response shapes are explicit Zod schemas in `contracts`; `passwordHash` appears in none of them. Login and `/auth/me` are tested to return only the contract fields, and the admin day response is tested to carry only id, name, email per user                 | done                     |
| Weak password storage                               | bcrypt, cost 12, per-password salt; the cost is checked by a unit test                                                                                                                                                                                           | done                     |
| The app starts with a missing or default secret     | Environment is validated at boot; the process exits if a variable is absent or empty. `JWT_SECRET` needs at least 32 characters and has no default                                                                                                               | done                     |
| Malformed or oversized input                        | Every request body, query and param is parsed by a Zod schema before reaching a service                                                                                                                                                                          | done for existing routes |
| SQL injection                                       | Prisma parameterises queries; raw SQL exists only in migrations and tests, never with user input interpolated                                                                                                                                                    | planned                  |
| Two users take the same slot                        | Database exclusion constraint, see ARCHITECTURE.md. The ten-request race test proves it at the database level, and the HTTP test in the bookings e2e (ten parallel `POST /api/bookings`: one `201`, nine `409 SLOT_TAKEN`) proves the endpoint                   | done                     |
| A stolen token is replayed                          | Short token lifetime only. There is no revocation                                                                                                                                                                                                                | accepted                 |
| XSS reads the token from the browser                | React escapes output by default. The token is in `localStorage`, so JavaScript can reach it. It is sent only to the same-origin `/api` and cleared on sign out and on any 401; sign out is client-side only                                                      | accepted                 |
| Password guessing on login                          | None                                                                                                                                                                                                                                                             | open                     |

"Planned" becomes "done" only when a test or a deliberate violation proves it.
"Accepted" is a known weakness that fits a local take-home and not a product.

## Known and deliberate for this submission

- Seeded accounts use a published demo password. That is correct for a
  project a reviewer must log into, and wrong anywhere else.
- `docker-compose.yml` contains development-only database credentials and a
  development `JWT_SECRET`, so the project starts with one command.
- `apps/api/.env.test` is committed on purpose: it holds only the same
  development credentials and a test-only `JWT_SECRET`.
- The database port 5432 and the API port 3000 are published to the host for
  local development. Port 3000 bypasses the single origin that nginx gives on
  8080, and it is open to anything that can reach the host.
- The web app loads its fonts from Google Fonts at runtime, which sends each
  visitor's IP address to Google. A content security policy would have to
  allow `fonts.googleapis.com` and `fonts.gstatic.com`, or the fonts would be
  self-hosted.

## Before this faced real users

- Secrets come from a secret store; nothing usable is committed
- Seeded demo accounts are removed
- Login is rate limited and failed attempts are logged
- Tokens are short-lived with refresh and server-side revocation
- The token moves to an `httpOnly`, `Secure`, `SameSite` cookie, with CSRF protection
- TLS terminates in front of both web and API
- Security headers and a content security policy are set on the web server
- The API database role cannot alter the schema
- Dependencies are audited in CI
- Booking and court changes are written to an audit log
- Personal data has an export and deletion path
