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

| Threat                                              | Mitigation                                                                                                  | State    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| A user calls an admin endpoint directly             | Routes are authenticated by default; admin routes require `@Roles('ADMIN')`, checked in the API             | planned  |
| A user reads or cancels someone else's booking      | Bookings are queried by id and owner together; the acting user comes from the token, never the request body | planned  |
| A forged or edited token claims a higher role       | The token carries only the user id; the role is read from the database on every request                     | planned  |
| Password hashes leak through an API response or log | Response shapes are explicit Zod schemas in `contracts`; `passwordHash` appears in none of them             | planned  |
| Weak password storage                               | bcrypt with a per-password salt                                                                             | planned  |
| The app starts with a missing or default secret     | Environment is validated at boot; the process exits if `JWT_SECRET` or `DATABASE_URL` is absent             | planned  |
| Malformed or oversized input                        | Every request body, query and param is parsed by a Zod schema before reaching a service                     | planned  |
| SQL injection                                       | Prisma parameterises queries; raw SQL exists only in migrations                                             | planned  |
| Two users take the same slot                        | Database exclusion constraint; see ARCHITECTURE.md                                                          | planned  |
| A stolen token is replayed                          | Short token lifetime only. There is no revocation                                                           | accepted |
| XSS reads the token from the browser                | React escapes output by default. The token is still reachable from JavaScript                               | accepted |
| Password guessing on login                          | None                                                                                                        | open     |

"Planned" becomes "done" only when a test or a deliberate violation proves it.
"Accepted" is a known weakness that fits a local take-home and not a product.

## Current state

Scaffold only. No authentication, no database, no secrets exist yet. Update
this section and the table above as each mitigation lands.

Known and deliberate for this submission:

- Seeded accounts use a published demo password. That is correct for a
  project a reviewer must log into, and wrong anywhere else.
- `docker-compose.yml` will contain development-only credentials and a
  development `JWT_SECRET` so the project starts with one command.

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
