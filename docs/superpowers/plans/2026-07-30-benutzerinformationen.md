# Benutzerinformationen Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Benutzerinformationen" profile page where a logged-in professor can view their email and directly edit firstname, surname, and password, submitted via one button.

**Architecture:** A new EJS page (`views/benutzerinformationen.ejs`) styled like the existing `index.ejs`/`nachrichten.ejs` shell, served by one new, explicitly-authorized `GET /benutzerinformationen` route in `server.js` that passes the logged-in user's real `firstname`/`surname`/`email` as EJS locals (no new query — Passport's `deserializeUser` already loads the full user row onto `req.user`). Client-side vanilla JS validates the form and simulates the save; the actual persistence request is left as a marked `TODO(author)` — no `fetch` call or update route is written.

**Tech Stack:** Express + EJS (server-rendered), vanilla JS (no framework), inline CSS using the project's existing design tokens. No build step, no test runner — this repo has none (see Global Constraints).

## Global Constraints

- Design tokens are the `:root` CSS variables and fonts (`DM Serif Display` for headings, `DM Sans` for body) already inline in `index.ejs`/`nachrichten.ejs` — reuse them verbatim, no new colors/typography. (Spec: "Page content")
- All UI text is German, matching the rest of the app.
- Email is **read-only** — never becomes an editable input, never sent in the update payload. (Spec: "Out of scope")
- Password fields are **optional**: both blank ⇒ update proceeds without a password change; either filled ⇒ both must be non-empty and identical. (Spec: "Validation")
- No length/complexity password rules are invented client-side — match-check only. (Spec: "Validation")
- The only backend change permitted in this plan is the `GET /benutzerinformationen` route exactly as specified — no new SQL, no update/PUT route, no `fetch` call. (Spec: "Scope boundary")
- This repo has **no automated test suite, linter, or build tool** (`CLAUDE.md` → Commands). Every task's "test" step is a concrete manual verification via the dev server (`npm run devStart`, port 8080) and a browser (or `curl` for the parts that don't need a session) — not an automated test run.

---

## File Structure

- **Modify `server.js`** — add the `GET /benutzerinformationen` route, inserted right after the existing `GET /nachrichten` route (~line 117), following that route's exact shape.
- **Create `views/benutzerinformationen.ejs`** — the whole page: shared shell (fonts/tokens/sidebar/header, copied from `nachrichten.ejs`), the profile card (read-only email, editable firstname/surname, optional password-change fields), and the inline `<script>` with validation + mocked submit.
- **Modify `views/index.ejs`** — sidebar: replace the inert `Benutzerinformationen` `<button>` with a real link.
- **Modify `views/nachrichten.ejs`** — same sidebar replacement.

---

### Task 1: Backend route + page shell with real, pre-filled data

**Files:**
- Modify: `server.js:114-118` (insert new route directly after the `/nachrichten` route)
- Create: `views/benutzerinformationen.ejs`

**Interfaces:**
- Produces: route `GET /benutzerinformationen` (guarded by the existing `checkAuthenticated` middleware, same as `/nachrichten`), rendering `benutzerinformationen.ejs` with EJS locals `firstname`, `surname`, `email` (strings, from `req.user`).
- Produces: DOM ids used by Task 2's script — `firstname`, `surname`, `newPassword`, `repeatPassword`, `nameError`, `passwordError`, `saveBtn`, `saveStatus`. Task 1 creates these elements; Task 2 wires behavior to them.

- [ ] **Step 1: Add the route in `server.js`**

Open `server.js` and find the existing `/nachrichten` route:

```js
// load messages page if authenticated, otherwise redirect to login page
app.get('/nachrichten', checkAuthenticated, (req, res) => {
    res.render('nachrichten.ejs')
})
```

Immediately after it (still before the `/login` routes), add:

```js
// load user info page if authenticated, otherwise redirect to login page
app.get('/benutzerinformationen', checkAuthenticated, (req, res) => {
    res.render('benutzerinformationen.ejs', {
        firstname: req.user.firstname,
        surname: req.user.surname,
        email: req.user.email
    })
})
```

- [ ] **Step 2: Create `views/benutzerinformationen.ejs`**

Create the file with this exact content:

```html
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Benutzerinformationen – Professorenportal</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:        #f5f2ee;
    --surface:   #ffffff;
    --accent:    #2b5cad;
    --accent2:   #d4691e;
    --text:      #1a1a2e;
    --muted:     #7a7a8c;
    --border:    #e0dbd4;
    --slot:      #dde9f7;
    --slot-text: #1e3a6e;
    --repeat:    #fdecd8;
    --repeat-text:#7a3010;
    --shadow:    0 8px 40px rgba(43,92,173,.13);
    --radius:    14px;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    padding: 32px 16px 64px;
  }

  /* ── Header ── */
  .header {
    max-width: 1080px;
    width: 100%;
    margin: 0 auto 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .header-title {
    font-family: 'DM Serif Display', serif;
    font-size: clamp(1.6rem, 4vw, 2.4rem);
    line-height: 1.1;
    color: var(--text);
    margin-right: auto;
  }
  .header-sub { font-size: .85rem; color: var(--muted); margin-top: 4px; }

  .app-layout {
    max-width: 1200px;
    margin: 0 auto;
    position: relative;
    padding-left: 260px;
  }
  .sidebar {
    position: fixed;
    left: 16px;
    top: 32px;
    width: 220px;
    background: transparent;
    border: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sidebar-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 24px 18px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sidebar-title {
    font-family: 'DM Serif Display', serif;
    font-size: 1.1rem;
    margin-bottom: 14px;
    color: var(--text);
  }
  .sidebar-item {
    text-align: left;
    border: none;
    background: transparent;
    color: var(--text);
    padding: 12px 14px;
    border-radius: 12px;
    cursor: pointer;
    font-size: .95rem;
    font-family: inherit;
    text-decoration: none;
    display: block;
    transition: background .2s, color .2s;
  }
  .sidebar-item:hover { background: var(--slot); }
  .sidebar-item.active { background: var(--accent); color: #fff; }
  .main-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 1080px;
    width: 100%;
    margin: 0 auto;
  }
  .logout-top {
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 200;
  }
  .logout-form { margin: 0; }
  .logout-btn {
    padding: 10px 16px;
    background: var(--accent2);
    color: #fff;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-family: inherit;
    font-size: .9rem;
    transition: background .2s;
  }
  .logout-btn:hover { background: #be5b1d; }

  /* ── Profile card ── */
  .profile-card {
    max-width: 1080px;
    width: 100%;
    margin: 50px auto 0;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 28px 28px 32px;
  }
  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg);
    border-radius: 10px;
    margin-bottom: 20px;
  }
  .info-row .info-label {
    font-size: .78rem;
    font-weight: 500;
    color: var(--muted);
  }
  .info-row .info-value {
    font-size: .9rem;
    color: var(--text);
    font-weight: 500;
  }

  .section-heading {
    font-size: .75rem;
    font-weight: 600;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 24px 0 14px;
  }
  .section-heading:first-of-type { margin-top: 0; }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .form-group { display: flex; flex-direction: column; gap: 5px; }
  .form-group.full { grid-column: 1/-1; }
  .form-group label { font-size: .78rem; font-weight: 500; color: var(--muted); }
  .form-group input {
    padding: 9px 12px;
    border: 1.5px solid var(--border);
    border-radius: 9px;
    font-family: inherit;
    font-size: .875rem;
    background: var(--bg);
    color: var(--text);
    transition: border-color .2s;
    outline: none;
  }
  .form-group input:focus { border-color: var(--accent); background: #fff; }
  .form-hint {
    font-size: .75rem;
    color: var(--muted);
    grid-column: 1/-1;
    margin-top: -4px;
  }

  .field-error {
    font-size: .78rem;
    color: #c0392b;
    grid-column: 1/-1;
    display: none;
  }
  .field-error.visible { display: block; }

  .submit-btn {
    width: 100%;
    margin-top: 20px;
    padding: 12px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-family: inherit;
    font-size: .95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background .2s, transform .1s;
  }
  .submit-btn:hover { background: #1e4a99; }
  .submit-btn:active { transform: scale(.98); }
  .submit-btn:disabled { opacity: .7; cursor: default; }

  .save-status {
    margin-top: 14px;
    font-size: .85rem;
    padding: 10px 14px;
    border-radius: 10px;
    display: none;
  }
  .save-status.success { display: block; background: #e8f3e8; color: #2c6b2f; }
  .save-status.error { display: block; background: #fce8e6; color: #c0392b; }

  @media (max-width: 860px) {
    .app-layout { padding-left: 0; }
    .sidebar {
      position: static;
      width: 100%;
      top: auto;
      bottom: auto;
      left: auto;
      margin-bottom: 20px;
    }
    .logout-top {
      position: static;
      display: flex;
      justify-content: flex-end;
      margin-bottom: 16px;
      right: auto;
      top: auto;
    }
    .header { justify-content: space-between; }
    .profile-card { margin-top: 0; }
  }
  @media (max-width: 520px) {
    .form-grid { grid-template-columns: 1fr; }
    .form-group.full { grid-column: 1; }
    .info-row { flex-direction: column; align-items: flex-start; gap: 4px; }
  }
</style>
</head>
<body>

<!-- ── App layout ── -->
<div class="app-layout">
  <form action="/logout?_method=DELETE" method="post" class="logout-form logout-top">
    <button type="submit" class="logout-btn">Abmelden</button>
  </form>
  <aside class="sidebar">
    <div class="sidebar-panel">
      <div class="sidebar-title">Portal</div>
      <a class="sidebar-item" href="/">Kalender</a>
      <a class="sidebar-item" href="/nachrichten">Nachrichten</a>
      <a class="sidebar-item active" href="/benutzerinformationen">Benutzerinformationen</a>
    </div>
  </aside>

  <div class="main-content">
    <!-- ── Header ── -->
    <div class="header">
      <div>
        <div class="header-title">Benutzerinformationen</div>
        <div class="header-sub">Professorenportal · Kontoeinstellungen</div>
      </div>
    </div>

    <!-- ── Profile card ── -->
    <div class="profile-card">
      <div class="info-row">
        <span class="info-label">E-Mail-Adresse</span>
        <span class="info-value"><%= email %></span>
      </div>

      <div class="section-heading">Persönliche Daten</div>
      <div class="form-grid">
        <div class="form-group">
          <label for="firstname">Vorname</label>
          <input type="text" id="firstname" value="<%= firstname %>">
        </div>
        <div class="form-group">
          <label for="surname">Nachname</label>
          <input type="text" id="surname" value="<%= surname %>">
        </div>
        <div class="field-error" id="nameError">Vorname und Nachname dürfen nicht leer sein.</div>
      </div>

      <div class="section-heading">Passwort ändern</div>
      <div class="form-grid">
        <div class="form-group">
          <label for="newPassword">Neues Passwort</label>
          <input type="password" id="newPassword" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label for="repeatPassword">Passwort wiederholen</label>
          <input type="password" id="repeatPassword" autocomplete="new-password">
        </div>
        <div class="form-hint">Leer lassen, um das Passwort nicht zu ändern.</div>
        <div class="field-error" id="passwordError">Die eingegebenen Passwörter stimmen nicht überein.</div>
      </div>

      <button class="submit-btn" id="saveBtn" type="button">Änderungen speichern</button>
      <div class="save-status" id="saveStatus"></div>
    </div>
  </div>
</div>

</body>
</html>
```

Note: the submit button has no click handler yet (`type="button"`, no `<script>`) — that's Task 2. Loading the page now should show a static, styled, non-interactive form.

- [ ] **Step 3: Start the dev server**

Run in the background: `npm run devStart`
Expected: console prints `Connected to PostgreSQL` and `Server running on Port 8080`.

- [ ] **Step 4: Verify the auth guard with `curl` (no session needed)**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/benutzerinformationen`
Expected: `302` (redirect to `/login`, same guard behavior as `/` and `/nachrichten`).

- [ ] **Step 5: Verify real data renders, in a browser**

If you don't already have login credentials for this dev database, register one at `http://localhost:8080/register` (any firstname/surname/email/password). Then log in at `http://localhost:8080/login`, and navigate directly to `http://localhost:8080/benutzerinformationen` (not yet linked from the sidebar — type the URL).

Expected:
- Page loads with no server error.
- "E-Mail-Adresse" row shows the exact email you registered/logged in with.
- "Vorname" and "Nachname" inputs are pre-filled with the exact values you registered with (not placeholder text).
- Visual style (fonts, colors, sidebar, card shadow) matches `/` and `/nachrichten`.
- Clicking "Änderungen speichern" does nothing yet (expected — no JS wired up).

- [ ] **Step 6: Commit**

```bash
git add server.js views/benutzerinformationen.ejs
git commit -m "Add Benutzerinformationen page route and static shell"
```

---

### Task 2: Client-side validation and mocked save

**Files:**
- Modify: `views/benutzerinformationen.ejs` (add `<script>` block before `</body>`; change `saveBtn`'s `type="button"` stays as-is since JS attaches the handler)

**Interfaces:**
- Consumes: DOM ids from Task 1 — `firstname`, `surname`, `newPassword`, `repeatPassword`, `nameError`, `passwordError`, `saveBtn`, `saveStatus`.
- Produces: nothing consumed by a later task — this is the last piece of page behavior. The `TODO(author)` comment documents the payload shape `{ firstname, surname, password? }` for whoever wires the real request.

- [ ] **Step 1: Add the script**

In `views/benutzerinformationen.ejs`, insert this immediately before the closing `</body>` tag:

```html
<script>
document.getElementById('saveBtn').addEventListener('click', async () => {
  const firstnameEl = document.getElementById('firstname');
  const surnameEl = document.getElementById('surname');
  const newPasswordEl = document.getElementById('newPassword');
  const repeatPasswordEl = document.getElementById('repeatPassword');
  const nameError = document.getElementById('nameError');
  const passwordError = document.getElementById('passwordError');
  const status = document.getElementById('saveStatus');
  const btn = document.getElementById('saveBtn');

  nameError.classList.remove('visible');
  passwordError.classList.remove('visible');
  status.classList.remove('success', 'error');
  status.style.display = 'none';

  const firstname = firstnameEl.value.trim();
  const surname = surnameEl.value.trim();
  const newPassword = newPasswordEl.value;
  const repeatPassword = repeatPasswordEl.value;

  let hasError = false;

  if (!firstname || !surname) {
    nameError.classList.add('visible');
    hasError = true;
  }

  const wantsPasswordChange = newPassword.length > 0 || repeatPassword.length > 0;
  if (wantsPasswordChange && newPassword !== repeatPassword) {
    passwordError.classList.add('visible');
    hasError = true;
  }

  if (hasError) return;

  const payload = { firstname, surname };
  if (wantsPasswordChange) payload.password = newPassword;

  btn.disabled = true;
  btn.textContent = 'Speichern …';

  // TODO(author): wire up PUT /api/user_info with `payload` (shape: { firstname, surname, password? } —
  // password is only present when the professor filled in both password fields).
  // Replace this simulated delay with the real fetch call and handle its response/error
  // (e.g. show status.classList.add('error') with an appropriate message on failure).
  await new Promise(resolve => setTimeout(resolve, 500));

  btn.disabled = false;
  btn.textContent = 'Änderungen speichern';
  status.textContent = 'Änderungen gespeichert.';
  status.classList.add('success');

  newPasswordEl.value = '';
  repeatPasswordEl.value = '';
});
</script>
```

- [ ] **Step 2: Verify empty-name validation, in the browser**

With the dev server still running and logged in on `http://localhost:8080/benutzerinformationen`: clear the "Vorname" field entirely, click "Änderungen speichern".
Expected: the red "Vorname und Nachname dürfen nicht leer sein." message appears; the button never shows "Speichern …"; no success message appears.

- [ ] **Step 3: Verify password-mismatch validation**

Restore the "Vorname" field's value. Enter `abc123` in "Neues Passwort" and `abc124` in "Passwort wiederholen". Click "Änderungen speichern".
Expected: the red "Die eingegebenen Passwörter stimmen nicht überein." message appears; no success message; the name-error message from Step 2 is not showing at the same time (it should have been cleared).

- [ ] **Step 4: Verify successful mocked save with a password change**

Set both password fields to the same value, e.g. `abc123` / `abc123`. Click "Änderungen speichern".
Expected: button briefly shows "Speichern …" and is disabled, then returns to "Änderungen speichern"; a green "Änderungen gespeichert." banner appears; both password fields are cleared afterward; no error messages are visible.

- [ ] **Step 5: Verify successful mocked save with no password change**

Leave both password fields blank (valid firstname/surname present). Click "Änderungen speichern".
Expected: same success banner as Step 4, with no password validation error (since both fields being empty is the explicitly allowed "no change" case).

- [ ] **Step 6: Confirm no network request was made**

Open the browser's Network tab, repeat Step 5's click.
Expected: no new outgoing request appears (the save is fully simulated client-side) — confirms no `fetch` was accidentally written.

- [ ] **Step 7: Commit**

```bash
git add views/benutzerinformationen.ejs
git commit -m "Add form validation and mocked save to Benutzerinformationen page"
```

---

### Task 3: Wire sidebar navigation across all three pages

**Files:**
- Modify: `views/index.ejs` (sidebar `Benutzerinformationen` button → link)
- Modify: `views/nachrichten.ejs` (same)

**Interfaces:**
- Consumes: route `GET /benutzerinformationen` from Task 1.
- Produces: nothing consumed elsewhere — final integration task.

- [ ] **Step 1: Update the sidebar in `views/index.ejs`**

Find:

```html
      <a class="sidebar-item" href="/nachrichten">Nachrichten</a>
      <button class="sidebar-item" type="button">Benutzerinformationen</button>
```

Replace with:

```html
      <a class="sidebar-item" href="/nachrichten">Nachrichten</a>
      <a class="sidebar-item" href="/benutzerinformationen">Benutzerinformationen</a>
```

- [ ] **Step 2: Update the sidebar in `views/nachrichten.ejs`**

Find the identical block:

```html
      <a class="sidebar-item active" href="/nachrichten">Nachrichten</a>
      <button class="sidebar-item" type="button">Benutzerinformationen</button>
```

Replace with:

```html
      <a class="sidebar-item active" href="/nachrichten">Nachrichten</a>
      <a class="sidebar-item" href="/benutzerinformationen">Benutzerinformationen</a>
```

(Note: only the `Benutzerinformationen` line changes — `Nachrichten` keeps its existing `active` class on this page.)

- [ ] **Step 3: Verify navigation, in the browser**

With the dev server running and logged in:
1. On `http://localhost:8080/` (Kalender), click "Benutzerinformationen" in the sidebar.
   Expected: navigates to `/benutzerinformationen`; that sidebar item is highlighted active; "Kalender" and "Nachrichten" are not.
2. Click "Nachrichten" in the sidebar.
   Expected: navigates to `/nachrichten`; that item is highlighted active.
3. Click "Benutzerinformationen" again from the Nachrichten page.
   Expected: navigates back to `/benutzerinformationen` correctly.
4. From `/benutzerinformationen`, click "Kalender".
   Expected: navigates to `/` and the calendar still works as before (unaffected by this change).

- [ ] **Step 4: Commit**

```bash
git add views/index.ejs views/nachrichten.ejs
git commit -m "Link Benutzerinformationen sidebar item to its new page"
```
