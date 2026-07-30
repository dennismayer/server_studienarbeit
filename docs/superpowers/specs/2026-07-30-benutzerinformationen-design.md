# Benutzerinformationen (User Profile) Page — Design

**Date:** 2026-07-30
**Status:** Approved
**Area:** Frontend page + one explicitly-authorized backend route for the
Professorenportal

## Summary

A profile page where a logged-in professor can view their account information
(email, firstname, surname) and directly edit firstname, surname, and
password — all through one form, submitted with a single button. This is the
third and final sidebar section, after Kalender (`/`) and Nachrichten
(`/nachrichten`).

## Scope boundary

Per `CLAUDE.md`, the author owns backend/API code and this is normally
frontend-only work. This feature is a deliberate, narrow exception, explicitly
requested by the user in conversation:

- **In scope (this work), including one backend exception:**
  - `views/benutzerinformationen.ejs` — the page itself (markup, inline CSS
    reusing existing design tokens, inline vanilla JS), built and validated
    against the real logged-in user's data.
  - `GET /benutzerinformationen` in `server.js` — **explicitly authorized by
    the user in this conversation** as a narrow exception to the
    backend-off-limits rule. It does nothing beyond what `GET /nachrichten`
    already does: guard with `checkAuthenticated` and render the template,
    passing `firstname`, `surname`, `email` from `req.user` (data Passport's
    `deserializeUser` already loads — no new query, no new logic).
  - Sidebar updates in `views/index.ejs` and `views/nachrichten.ejs`: replace
    the inert `Benutzerinformationen` `<button>` with a real
    `<a href="/benutzerinformationen">` link, matching how `Nachrichten` is
    already wired.
- **Out of scope (author / `TODO(author)` markers):** the actual update
  request — no route, no SQL, no `fetch` call is written for saving changes.
  The frontend simulates a successful save so the UI/UX is fully
  demonstrable, with a `TODO(author)` marking exactly where the real request
  belongs.

## Page content — `views/benutzerinformationen.ejs`

Reuses the exact shell and design tokens from `index.ejs`/`nachrichten.ejs`
(fonts `DM Serif Display` / `DM Sans`, `:root` palette, sidebar, top-right
Abmelden button).

**Layout**
- Sidebar identical to the other two pages, with **Benutzerinformationen**
  marked `active` and now a real link (all three pages link to all three
  routes).
- Header: title "Benutzerinformationen" + subtitle, same visual weight as the
  Nachrichten header.
- A single card containing one form — no separate view/edit mode; fields are
  directly editable, matching the user's request to edit "by directly editing
  the data."

**Form fields**
- **E-Mail-Adresse** — read-only display (plain text/info row, not an input).
  Not part of the update payload.
- **Vorname** / **Nachname** — text inputs, pre-filled from `req.user` via
  the page's initial render (no client fetch needed for the initial values).
- **Passwort ändern** section, visually separated (divider + subheading):
  - "Neues Passwort" and "Passwort wiederholen" — both password inputs, both
    **optional**. Helper text: leaving both blank keeps the current password.
- One **"Änderungen speichern"** button submits everything.

**Validation (client-side only)**
- Vorname/Nachname: required, non-empty after trim.
- Password: if *either* password field is non-empty, *both* must be
  non-empty **and** identical, else block submit and show an inline error
  ("Passwörter stimmen nicht überein."). No length/complexity rules are
  invented on the frontend — that's a backend concern if the author wants it.
- If both password fields are empty, the update proceeds without a password
  change.

**Submit behavior**
- On valid submit: brief pending state on the button, then a simulated
  success message — this previews the real UX for the author.
- The request site carries `// TODO(author): wire up PUT /api/user_info` (or
  whatever route the author chooses) with the intended payload documented
  inline: `{ firstname, surname, password? }` (password omitted/undefined
  when both fields are left blank). No `fetch` call is written.

## Data boundary (mock strategy)

- **Read:** not mocked — the page renders with the real `firstname`,
  `surname`, `email` passed as EJS locals from `req.user` by the new route.
  This mirrors how `index.ejs` already receives `name: req.user.surname`.
- **Write:** mocked. The submit handler validates, then simulates an
  async save (e.g. a short delay) and shows a success state, with the
  `TODO(author)` marking precisely where the real `fetch` replaces the mock.

## Out of scope / non-goals

- Changing the email address.
- Requiring the current password to confirm a change (not requested).
- Any SQL, `UPDATE users …` query, or new API route beyond the one
  explicitly authorized `GET /benutzerinformationen` page route.
- Account deletion or any other account-management action.
