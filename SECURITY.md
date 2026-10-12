# Security

Courtly stores user emails, names and password hashes, and signs
authentication tokens with a secret. It is a take-home project that runs
locally; this document says what is protected, what is not, and what would
have to change before it faced real users.

## What is sensitive

| Asset           | Where it lives                                |
| --------------- | --------------------------------------------- |
| Password hashes | `User.passwordHash` in PostgreSQL             |
| JWT signing key | `JWT_SECRET` environment variable             |
| Database access | `DATABASE_URL` environment variable           |
| Personal data   | user email and name; booking history per user |

## Threat model

| Threat                                              | Mitigation                                                                                                                                                                                                              | State                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| A user calls an admin endpoint directly             | Routes are authenticated by default; admin routes require `@Roles('ADMIN')`, checked in the API                                                                                                                         | planned                    |
| A user reads or cancels someone else's booking      | Bookings are queried by id and owner together; the acting user comes from the token, never the request body                                                                                                             | planned                    |
| A forged or edited token claims a higher role       | The token carries only the user id; the role is read from the database on every request                                                                                                                                 | planned                    |
| Password hashes leak through an API response or log | Response shapes are explicit Zod schemas in `contracts`; `passwordHash` appears in none of them                                                                                                                         | planned                    |
| Weak password storage                               | bcrypt with a per-password salt                                                                                                                                                                                         | planned                    |
| The app starts with a missing or default secret     | Environment is validated at boot; the process exits if a variable is absent or empty. `DATABASE_URL` and `FACILITY_TIMEZONE` are validated today; `JWT_SECRET` joins the schema with auth                               | planned                    |
| Malformed or oversized input                        | Every request body, query and param is parsed by a Zod schema before reaching a service                                                                                                                                 | planned                    |
| SQL injection                                       | Prisma parameterises queries; raw SQL exists only in migrations and in tests, as `$executeRaw`/`$queryRaw` tagged templates with no user input interpolated                                                             | planned                    |
| Two users take the same slot                        | Database exclusion constraint; see ARCHITECTURE.md. Proven at the database level by the ten-request race test and by dropping the constraint, which makes that test fail. The `409` mapping in the API is still planned | done at the database level |
| A stolen token is replayed                          | Short token lifetime only. There is no revocation                                                                                                                                                                       | accepted                   |
| XSS reads the token from the browser                | React escapes output by default. The token is still reachable from JavaScript                                                                                                                                           | accepted                   |
| Password guessing on login                          | None                                                                                                                                                                                                                    | open                       |

"Planned" becomes "done" only when a test or a deliberate violation proves it.
"Accepted" is a known weakness that fits a local take-home and not a product.

## Current state

The database exists with a run-once seed of demo accounts (bcrypt, 12 rounds).
No authentication or JWT yet. Update this section and the table above as each
mitigation lands.

Known and deliberate for this submission:

- Seeded accounts use a published demo password. That is correct for a
  project a reviewer must log into, and wrong anywhere else.
- `docker-compose.yml` contains development-only database credentials and
  will contain a development `JWT_SECRET`, so the project starts with one
  command.
- `apps/api/.env.test` is committed on purpose. It holds only the development
  credentials of the local `courtly_test` database, the same ones already in
  `docker-compose.yml` and `apps/api/.env.example`.
- The database port 5432 and the API port 3000 are published to the host for
  local development. Port 3000 bypasses the single origin that nginx gives on
  8080, and it is open to anything that can reach the host.

## Before this faced real users

- [ ] Secrets come from a secret store; nothing usable is committed
- [ ] Seeded demo accounts are removed
- [ ] Login is rate limited and failed attempts are logged
- [ ] Tokens are short-lived with refresh and server-side revocation
- [ ] The token moves to an `httpOnly`, `Secure`, `SameSite` cookie, with CSRF protection
- [ ] TLS terminates in front of both web and API
- [ ] Security headers and a content security policy are set on the web server
- [ ] The API database role cannot alter the schema
- [ ] Dependencies are audited in CI
- [ ] Booking and court changes are written to an audit log
- [ ] Personal data has an export and deletion path
