# InsureFlow API

Backend for an insurance-management platform. Agents register and sign in, and the data model covers their customers, the policies sold to them, the products those policies are based on, and the payments made against each policy.

Built with **NestJS 12**, **Prisma 6** and **PostgreSQL 17**, written in TypeScript (ESM).

## Status

This is an early-stage project. What exists today:

- Agent registration and login with JWT access tokens
- A protected `GET /auth/me` endpoint
- A database health check
- The full relational schema and initial migration for users, agents, customers, policies, products and payments
- CI pipeline (Jenkins) and a production Docker image

CRUD endpoints for customers, policies and payments are not built yet. The schema for them is already in place.

## API

Interactive documentation (Swagger UI) is served at **`/docs`**, for example <http://localhost:3000/docs>. Use **Authorize** there to paste an access token and try the protected endpoints. The raw OpenAPI document is at `/docs-json`.

| Method | Path             | Auth   | Description                                                   |
| ------ | ---------------- | ------ | ------------------------------------------------------------- |
| GET    | `/`              | –      | Service banner: `{ service, status, message }`                |
| GET    | `/health`        | –      | Liveness: `200` while the process is up (no database call)    |
| GET    | `/health/db`     | –      | Readiness: `200` when PostgreSQL answers, `503` otherwise     |
| POST   | `/auth/register` | –      | Create an agent account                                       |
| POST   | `/auth/login`    | –      | Exchange credentials for a bearer token (15 min lifetime)     |
| GET    | `/auth/me`       | Bearer | Returns the authenticated user's `userId`, `email` and `role` |

Example:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"a-long-password","fullName":"Jane Agent"}'

curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"a-long-password"}'
# => {"accessToken":"...","tokenType":"Bearer","expiresIn":900}

curl http://localhost:3000/auth/me -H "Authorization: Bearer <accessToken>"
```

### Design notes

- **Validation:** a global `ValidationPipe` strips unknown fields and rejects requests that contain them (`whitelist` + `forbidNonWhitelisted`).
- **Passwords:** hashed with bcrypt (cost 12). Inputs are capped at 72 characters because bcrypt ignores anything beyond 72 bytes.
- **Login errors:** unknown email, deactivated account and wrong password all return the same `401` message, so the endpoint can't be used to discover which emails are registered.
- **Duplicate emails:** checked up front, and the unique index is also handled (Prisma `P2002` becomes a `409`) so two simultaneous sign-ups can't both succeed.
- **Token validation:** `JwtStrategy` re-reads the user on every request, so deactivating an account takes effect immediately instead of when the token expires.
- **Money:** amounts are stored as `Decimal` columns rather than floats.
- **Rate limiting:** 100 requests/minute per client by default, and 5/minute on `register` and `login` to slow brute-force attempts (`@nestjs/throttler`). Health routes are exempt. `trust proxy` is enabled so limits apply to the real client IP behind a load balancer.
- **HTTP hardening:** `helmet` sets secure response headers. CORS is closed unless `CORS_ORIGIN` lists the allowed frontend origin(s). Only `/docs` has its Content-Security-Policy relaxed, because Swagger UI needs inline scripts.
- **API docs:** generated from the code with `@nestjs/swagger` (`src/swagger.ts`), so the schemas come from the same DTOs the validation pipe uses and can't drift from the real request rules.

## Data model

```
User 1──0..1 Agent 1──* Customer 1──* Policy *──1 PolicyProduct
                                        │
                                        1
                                        │
                                        * Payment
```

Defined in [`prisma/schema.prisma`](prisma/schema.prisma). Deletes are `Restrict` throughout, so a customer or policy with history can't be removed by accident. Policies are indexed by customer, product and `(status, endDate)` for expiry queries.

## Getting started

**Prerequisites:** Node.js 24, npm, and Docker (for the local database).

```bash
npm install
cp .env.example .env        # then edit: set POSTGRES_PASSWORD, DATABASE_URL and JWT_SECRET
npm run db:up               # start PostgreSQL in Docker
npm run prisma:migrate      # apply migrations and generate the Prisma client
npm run start:dev           # http://localhost:3000
```

Check it is up: `curl http://localhost:3000/health/db`.

### Environment variables

| Variable                                | Required   | Purpose                                                            |
| --------------------------------------- | ---------- | ------------------------------------------------------------------ |
| `DATABASE_URL`                          | yes        | PostgreSQL connection string used by Prisma                        |
| `JWT_SECRET`                            | yes        | Signing key for access tokens. The app refuses to start without it |
| `POSTGRES_PASSWORD`                     | for Docker | Password `docker-compose.yml` gives the local database             |
| `PORT`                                  | no         | HTTP port, defaults to `3000`                                      |
| `CORS_ORIGIN`                           | no         | Comma-separated frontend origins allowed by CORS. Empty = CORS off |
| `OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET` | no         | Enables [NestJS Observe](#observability)                           |

## Scripts

| Command                                | What it does                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run start:dev`                    | Run with file watching                                                                            |
| `npm run build` / `npm run start:prod` | Compile to `dist/` and run the compiled app                                                       |
| `npm run lint`                         | Type-aware lint with oxlint                                                                       |
| `npm run format`                       | Format `src/` and `test/` with Prettier                                                           |
| `npm test`                             | Unit tests (Vitest)                                                                               |
| `npm run test:cov`                     | Unit tests with coverage                                                                          |
| `npm run test:e2e`                     | End-to-end tests. These boot the real app, so they need the database running and `JWT_SECRET` set |
| `npm run prisma:migrate`               | Create/apply migrations in development                                                            |
| `npm run prisma:deploy`                | Apply existing migrations (CI / production)                                                       |

Unit tests mock Prisma, so they run with no database.

## Docker

```bash
docker build -t insureflow-api .
docker run --rm -p 3000:3000 --env-file .env insureflow-api
```

Inside the container `localhost` is the container itself, so point `DATABASE_URL` at a host the container can reach (for example `host.docker.internal` on Docker Desktop).

The image is multi-stage (build, then a production stage with only runtime dependencies) and runs as the unprivileged `node` user. On start it runs `prisma migrate deploy` and then the server. That only applies migrations not yet recorded in the database, so restarts are safe.

## Deployment (Render + Supabase)

Production runs as a Docker web service on [Render](https://render.com), backed by a Supabase PostgreSQL database. [`render.yaml`](render.yaml) describes the service.

1. In Render choose **New → Blueprint**, connect this repository and select `render.yaml`.
2. Set the secrets Render asks for:
   - `DATABASE_URL`: the Supabase **session pooler** string (host `…pooler.supabase.com`, port `5432`). It is IPv4-compatible, which Render needs, and it supports migrations. `JWT_SECRET` is generated by Render.
   - `CORS_ORIGIN` (frontend URL) and the optional `OBSERVE_APP_*` pair.
3. Deploy. Render builds the image, uses `GET /health` as the health check, and redeploys on every push to `master`.
4. Smoke test: `curl https://<service>.onrender.com/health/db` should return `{"status":"ok","database":"connected"}`.
5. Browse the API docs at `https://<service>.onrender.com/docs`.

To roll back, redeploy a previous deploy from the Render dashboard. Keep migrations backward-compatible so an older build still works against the newer schema.

On Render's free plan the service sleeps after inactivity, so the first request after a pause is slow.

## CI

[`Jenkinsfile`](Jenkinsfile) runs on every build: install (`npm ci`), generate the Prisma client, lint, test, build.

## Observability

The app is instrumented with [NestJS Observe](https://observe.nestjs.com) (traces, logs, metrics and error tracking) through `ObserveModule` in [`src/app.module.ts`](src/app.module.ts). It is optional: without a key pair the app runs normally. To connect it, run `npx @nestjs/observe link`, or set `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment.

## Project structure

```
src/
  main.ts              bootstrap, global validation, shutdown hooks
  app.module.ts        root module
  app.controller.ts    liveness and database health endpoints
  auth/                registration, login, JWT strategy and guard, DTOs
  prisma/              PrismaService (connects/disconnects with the app lifecycle)
prisma/
  schema.prisma        data model
  migrations/          SQL migrations
test/                  end-to-end tests
```

## License

Unlicensed, private project.
