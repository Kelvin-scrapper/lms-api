# Summertech LMS API

The backend for the Summertech LMS: accounts and sign-in, courses and
enrolments, learning progress, tutor content editing, file uploads and admin.
The web app (`lms/`) is a separate project that talks to this API over HTTP,
so each side can be deployed and scaled on its own, and other clients (a
mobile app, the marketing site) can use the same API.

## Structure

```
db/
  schema.prisma        data model (Prisma, PostgreSQL)
  setup.js             applies the schema — safe on every start
  seed.js              starting catalogue + demo accounts — safe on every start
  courses.js           the starting course catalogue
src/
  index.js             Express app: middleware, routes, error handling
  db.js                Prisma client
  routes/              URL → middleware → controller wiring, one file per area
  controllers/         request handling: read input, call models, shape the reply
  models/              all database access, one file per entity
  middleware/          auth (JWT + roles), rate limits, request validation
  schemas/             zod request-body schemas
  utils/               jwt, password hashing, email, file storage, progress maths
  jobs/                background cleanup (expired sign-in links / tokens)
test/
  api.test.js          end-to-end tests for every endpoint
  helpers/testServer.js
```

A request flows `routes → middleware → controllers → models → database`.
Controllers never touch Prisma directly; models never see `req`/`res`.

## Running locally

Needs Node 20+ and PostgreSQL.

```bash
cp .env.example .env        # then set DATABASE_URL and JWT_SECRET
npm install
npm run db:setup            # create/update tables
npm run db:seed             # catalogue; + demo accounts if NODE_ENV=development
npm run dev                 # http://localhost:4000
```

Demo accounts (password `Passw0rd!`): `admin@summertech.ac.ke`,
`grace@summertech.ac.ke` (tutor), `kelvin@summertech.ac.ke` (student).

Without `RESEND_API_KEY`, sign-in link emails are printed to the API log.

Or with Docker (API + Postgres): `docker compose up -d --build`.

## Deploying

**Vercel** (no server to manage): import the repo as a new Vercel project. The
included `vercel.json` runs the whole API as one function and, on each build,
applies the schema and seeds an empty database. Set these environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Your Postgres (use a plan that doesn't auto-pause) |
| `JWT_SECRET` | 32+ random characters |
| `APP_URL`, `FRONTEND_ORIGIN` | The LMS web app's URL |
| `BLOB_READ_WRITE_TOKEN` | Required on Vercel — uploads can't be kept on its disk |
| `CRON_SECRET` | Any random string; enables the daily token cleanup |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sign-in link emails |
| `SEED_ADMIN_EMAIL` / `_PASSWORD` | Optional: create the first admin |

**VPS / Docker**: `docker compose up -d --build` on the server (see
`docker-compose.yml`); put it behind nginx/Caddy for HTTPS and set `TRUST_PROXY=1`.

Never set `NODE_ENV=development` on a deployment with real data — that's what
creates the demo accounts with the published password.

## File uploads

With `BLOB_READ_WRITE_TOKEN` set, the web app uploads files straight from the
browser to Blob storage: it asks `POST /teach/lessons/:id/resources/upload-url`
for a token that allows exactly one file in that lesson's folder (up to
`MAX_DIRECT_UPLOAD_MB`, default 500 MB), uploads, then calls
`POST /teach/lessons/:id/resources/uploaded`, which checks the file really
exists in that folder before saving it. Large videos never pass through the web
app or the API. Without Blob, uploads go through
`POST /teach/lessons/:id/resources/upload` and are stored in `UPLOAD_DIR`.

## Tests

```bash
npm test
```

Runs every endpoint against a real Postgres. Each run creates its own
temporary schema inside `TEST_DATABASE_URL` and drops it afterwards, so
existing data is never touched. CI runs the same suite on every push.

## Authentication

`POST /auth/login` (or a magic link) returns `{ user, token, expiresAt }`.
Send the token as `Authorization: Bearer <token>`. Every request re-checks the
account, so suspending a user or changing their role applies immediately, and
`POST /auth/logout` revokes the token.

Roles: `STUDENT`, `MENTOR`, `INSTRUCTOR` (tutor), `ADMIN`.

## Endpoints

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | anyone | Email + password → token (rate limited) |
| POST | `/auth/magic-link` | anyone | Email a sign-in link (rate limited) |
| POST | `/auth/magic-link/verify` | anyone | Exchange a link's token for a session |
| POST | `/auth/logout` | signed in | Revoke the current token |
| GET / PATCH | `/auth/me` | signed in | Current user / update name |
| PUT | `/auth/me/password` | signed in | Set or change password |
| GET | `/courses` | signed in | Catalogue with `enrolled` flags |
| GET | `/courses/:slug` | signed in | Course tree, enrolment, progress, next lesson (notes and files only for enrolled learners and tutors) |
| POST | `/courses/:id/enroll` | signed in | Enrol yourself |
| POST / DELETE | `/courses/:id/instructors[/:userId]` | admin | Assign / remove a tutor |
| GET | `/learning` | signed in | My courses with progress |
| PUT / DELETE | `/learning/lessons/:lessonId/complete` | enrolled | Mark / unmark a lesson done |
| GET | `/teach/courses[/:slug]` | tutor, admin | Courses you can edit / full tree |
| POST | `/teach/courses/:courseId/modules` | course tutor | Add a module |
| PATCH / DELETE | `/teach/modules/:id` | course tutor | Rename / delete a module |
| POST | `/teach/modules/:id/move` | course tutor | `{direction: "up"\|"down"}` |
| POST | `/teach/modules/:id/lessons` | course tutor | Add a lesson |
| PATCH / DELETE | `/teach/lessons/:id` | course tutor | Edit / delete a lesson |
| POST | `/teach/lessons/:id/move` | course tutor | Reorder a lesson |
| POST | `/teach/lessons/:id/resources` | course tutor | Attach a link (video, PDF, slides…) |
| POST | `/teach/lessons/:id/resources/upload` | course tutor | Upload a file through the API (multipart `file`, `title`) |
| POST | `/teach/lessons/:id/resources/upload-url` | course tutor | One-file token for a direct browser→Blob upload |
| POST | `/teach/lessons/:id/resources/uploaded` | course tutor | Record a direct upload (`{url, title?}`) |
| DELETE | `/teach/resources/:id` | course tutor | Remove a resource |
| GET / POST | `/users` | admin | List (`?roles=INSTRUCTOR,ADMIN`) / create accounts |
| PATCH | `/users/:id` | admin | Change role or suspend (`{role}`, `{active}`) |
| GET / POST | `/enrollments` | admin | List / enrol a learner |
| GET | `/stats` | admin | Platform counts |
| GET | `/files/:key` | anyone | Uploaded files (local storage only) |
| GET | `/health` | anyone | API + database status |
| GET | `/jobs/purge-tokens` | scheduler (`CRON_SECRET`) | Remove used/expired sign-in links and tokens |

Errors are JSON: `{ "error": "message", "field": "name" }` (`field` when one
input is at fault).

## Scaling notes

- **Stateless API**: sessions are JWTs and every instance shares the database,
  so you can run several instances behind a load balancer.
- **File uploads**: set `BLOB_READ_WRITE_TOKEN` so files go to Vercel Blob,
  shared by all instances. The local `UPLOAD_DIR` fallback suits one server.
- **Rate limits** are kept in memory per instance; with several instances,
  move them to a shared store (e.g. Redis).
- Set `TRUST_PROXY` when running behind a proxy or load balancer.
