# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope of work (read first)

This is a university project. The backend is the author's own work and must be designed by them.

- **Your responsibility is the frontend only — and even there, NOT the API calls.** Work on the UI, markup, styling, and client-side rendering/interaction logic, but leave the actual `fetch(...)` request wiring to the author.
- **At the data boundary, stub with mock data and a clear TODO.** When a frontend feature needs backend data, build the full UI against realistic mock/placeholder data and mark where the request belongs with an explicit `// TODO(author): wire up <METHOD> <route>` so the author can drop in the real `fetch`. Do not write the fetch call yourself.
- **Do not write or modify backend code** ([server.js](server.js), [passwort-config.js](passwort-config.js), SQL, routes, auth) **unless the user directly and explicitly asks you to in that message.** A general request to "fix" or "improve" something does not authorize backend changes — ask or stay on the frontend.
- The rest of this file documents the backend for context so frontend work stays consistent with it — not as an invitation to change it.

## Frontend design & roadmap

- **Design source of truth:** the CSS and design tokens already inline in the `.ejs` files. Match the existing look — fonts `DM Serif Display` (headings) and `DM Sans` (body), and the `:root` color palette (`--bg`, `--surface`, `--accent`, `--accent2`, etc.). Reuse these tokens rather than introducing new colors/typography.
- **Planned frontend sections (not yet built):** the sidebar's **Nachrichten** (messages) and **Benutzerinformationen** (user info) buttons in [views/index.ejs](views/index.ejs) are placeholders for upcoming frontend work.

## Environment note

The PostgreSQL database runs inside a **Docker container in the development environment** (not a locally installed Postgres). The DB connection env vars point at that container.

## What this is

A German university "Professorenportal" (Studienarbeit / student project) for managing professors' office hours ("Sprechstunden"). Professors register/log in, then add one-time or weekly-recurring time slots on a month calendar. A single Express server renders EJS pages and serves a JSON API; the calendar UI is a self-contained vanilla-JS SPA embedded in one EJS template.

## Commands

- **Dev server (auto-reload):** `npm run devStart` — runs `nodemon server.js`. Server listens on **port 8080**.
- **Production start:** there is no `start` script. Production is run under **pm2** as the process named `server-studienarbeit`.
- No test, lint, or build tooling exists. `npm run build --if-present` in CI is a no-op.

## Deployment

`.github/workflows/node.js.yml` runs on push to `main` on a **self-hosted** runner: `npm ci` → `npm run build --if-present` (no-op) → `pm2 restart server-studienarbeit`. There is no separate deploy step — the runner and the production host are the same machine.

## Configuration

Env vars are loaded from `.env` via dotenv **only when `NODE_ENV !== 'production'`** (see top of [server.js](server.js)); in production pm2/the environment must supply them. Required keys:

- DB pool: `USER_DATABASE`, `HOST_DATABASE`, `PORT_DATABASE`, `DATABASE`, `PASSWORD_DATABASE`
- Sessions: `SESSION_SECRET`

## Architecture

Everything server-side lives in two files:

- **[server.js](server.js)** — the entire app: `pg` Pool, Passport wiring, middleware, all routes, and graceful shutdown (`SIGTERM`/`SIGINT`/`SIGUSR2` close the server then `pool.end()`; `SIGUSR2` matters because nodemon uses it to restart).
- **[passwort-config.js](passwort-config.js)** — Passport `LocalStrategy` setup (note the German spelling; it's required as `./passwort-config`). Auth is by **email** (`usernameField: 'email'`), password checked with `bcrypt.compare`, and the session stores `user.user_id`.

Auth is session-based (express-session + Passport). Two guard middlewares protect routes: `checkAuthenticated` and `checkNotAthenticated` (**sic** — the misspelling is the actual identifier; match it exactly).

### Database schema (managed outside this repo — no migrations here)

The DB must already contain two tables:

- `users` — `user_id`, `surname`, `firstname`, `email` (unique; violation raises Postgres code `23505`, handled on register), `password` (bcrypt hash).
- `time_slots` — `id`, `date`, `user_id`, `from`, `to`, `title`, `room`, `repeat` (bool), `repeatUntil`.

**SQL gotcha:** `from`, `to`, and the camelCase `repeatUntil` must be **double-quoted** in every query (`"from"`, `"to"`, `"repeatUntil"`) — `from`/`to` are reserved words and unquoted identifiers get lowercased. Times are stored as SQL `time`; inserts append `':00'` seconds to the `HH:MM` form values.

### Routes

- Page routes: `GET /` (calendar, auth-gated), `GET/POST /login`, `GET/POST /register`, `DELETE /logout` (via method-override; the logout form posts `?_method=DELETE`).
- API (`/api/slot_data`, all JSON):
  - `GET` — slots in a `startDate`..`endDate` range for the current user; a `UNION` returns both non-repeating slots in range and repeating slots whose window overlaps the range. Returns `204` when empty.
  - `POST` — create a slot for the current user.
  - `DELETE` — delete by `id`, always scoped with `AND user_id = $2` so users can't delete others' slots.
  - `GET /api/slot_data/get_next_timeslot` — computes the single next upcoming occurrence (handling weekly recurrence in SQL) for a user passed as the `id` query param. **This route is intentionally NOT behind `checkAuthenticated`** and takes the user id directly — it's meant for an external/unauthenticated caller (e.g. a hallway display). Keep it that way unless the task says otherwise.

### Recurrence model

Weekly only. A slot with `repeat = true` recurs every 7 days from its `date` until `repeatUntil`. This expansion is implemented **twice** and both must stay consistent: client-side in `slotsForDate()` in [views/index.ejs](views/index.ejs) (for calendar rendering), and server-side in the `get_next_timeslot` query.

### Frontend

`views/index.ejs` is a standalone SPA (all CSS and JS inline). It keeps an in-memory `state.slots` cache keyed by `YYYY-MM-DD`, refetching per visible month. The month fetch spans the visible grid including leading/trailing days of adjacent months. UI text is German. Note the existing identifier `chacheData()` (**sic** — misspelling of "cache") is the real function name.
