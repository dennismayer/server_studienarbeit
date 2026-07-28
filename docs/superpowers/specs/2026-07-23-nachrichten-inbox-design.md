# Nachrichten (Messages) Inbox — Design

**Date:** 2026-07-23
**Revised:** 2026-07-26 — audio URL is now fetched per message **at play time**
(Option 2) instead of in the list response, plus a player **error/retry** handler.
**Status:** Approved (frontend scope)
**Area:** Frontend page + proposed DB schema for the Professorenportal

## Summary

A read-only **voice-message inbox** for professors. Students (who are *not*
logged-in users of the portal) leave a professor a short **context text** plus a
**voice message** stored in AWS S3. The professor opens the **Nachrichten** page
from the sidebar and sees their messages newest-first, can play each voice
message with a custom in-page player, and can delete messages.

This document covers the **frontend page** (author's own responsibility per
`CLAUDE.md` is the backend/API wiring) and a **proposed database schema** for the
author to implement.

## Scope boundary

- **In scope (this work):** `views/nachrichten.ejs` frontend (markup, inline CSS
  using existing design tokens, inline vanilla JS), the custom audio player, the
  read/unread + delete interactions built against **mock data**, and updating the
  sidebar links in `views/index.ejs`.
- **Out of scope (author / `TODO(author)` markers):** the actual `fetch` calls,
  the `GET /nachrichten` page route, the `/api/messages` endpoints, the AWS SDK
  presigned-URL generation, and the `messages` table creation. The schema below
  is a **proposal**, not something implemented in `server.js`.

## Message model

Each message represents one student drop-off:

- **sender_name** — the student's name (free text; students are not portal users)
- **body** — context text, e.g. "Max Mustermann hat Unterlagen im Sekretariat
  hinterlassen und eine Sprachnachricht aufgenommen."
- **voice message** — audio stored in S3
- **timestamp** — when it was left; inbox is sorted newest-first
- **read/unread** — unread messages are visually highlighted; playing/opening a
  message marks it read

There is **no** sender email/contact and **no** reply/compose flow — this is a
one-way, read-only inbox with a delete action.

## Audio delivery — decision: Approach A (presigned URL), fetched on demand

The S3 bucket stays **private**. The DB stores only the S3 **object key**. A
dedicated route uses the AWS SDK to generate a **short-lived presigned URL** for a
single message's audio, and the frontend requests it **just-in-time, when the
professor presses play** — not in the message list.

Why fetch per message at play time (rather than presigning every row in the list
response):

- A presigned URL expires (e.g. 15–30 min). If it were minted at list time and
  the professor left the tab open past the expiry, playback would fail with a
  `403`. Fetching seconds before playback means expiry can never be hit.
- The list response stays cheaper — no signing work for messages that are never
  played.

Consequence for the contract: `GET /api/messages` returns **no** audio URL (only
metadata); a new **`GET /api/messages/:id/audio-url`** returns the fresh URL on
demand. The frontend still just plays whatever URL string it receives.

Alternatives considered and rejected:

- **Presign at list time** — one fewer endpoint, but subject to the expiry
  problem above once the tab sits open.
- **Public URL** — simplest backend, but voice messages would be publicly
  reachable by anyone with the link; poor student privacy.
- **Proxy stream** through Express — keeps the bucket private without presigning,
  but routes every playback through the app server.

## Proposed DB schema — new `messages` table

```sql
CREATE TABLE messages (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(user_id),  -- professor (recipient)
    sender_name      TEXT    NOT NULL,                            -- student's name
    body             TEXT,                                        -- context text
    audio_key        TEXT,                                        -- S3 object key (Approach A); NULL for text-only
    audio_duration_s INTEGER,                                     -- optional, for the player's total-time label
    is_read          BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX messages_user_created_idx ON messages (user_id, created_at DESC);
```

Notes:
- No reserved-word column names, so none of the `"from"`/`"to"`/`"repeatUntil"`
  double-quoting gotchas from `time_slots` apply here.
- `audio_key` and `audio_duration_s` are nullable to tolerate a text-only message.

## API contract expected by the frontend (all `TODO(author)`)

| Method & route | Purpose | Notes |
|---|---|---|
| `GET /nachrichten` | Render `nachrichten.ejs` | Behind `checkAuthenticated`, pass `name: req.user.surname` like `/`. |
| `GET /api/messages` | List the professor's messages, newest-first | **Metadata only — no audio URL** (see the audio-url route). Return `204` when empty (matches the slot API convention). |
| `GET /api/messages/:id/audio-url` | Fresh presigned S3 URL for one message's audio | Generated **on demand at play time**; returns `{ audioUrl }`. Scope `AND user_id = <session user>`. |
| `POST /api/messages/:id/read` | Mark one message read | Scope `AND user_id = <session user>`. |
| `DELETE /api/messages` | Delete by `id` | Body `{ id }`, scoped `AND user_id = $2` — mirrors the existing `time_slots` delete exactly. |

Response shape the frontend consumes per message from `GET /api/messages` (note:
**no `audioUrl`** — that comes separately from the audio-url route):

```json
{
  "id": 12,
  "sender_name": "Max Mustermann",
  "body": "… context text …",
  "audio_duration_s": 14,
  "is_read": false,
  "created_at": "2026-07-23T09:12:00Z"
}
```

And `GET /api/messages/:id/audio-url` returns:

```json
{ "audioUrl": "https://…s3…/presigned…" }
```

## Frontend page — `views/nachrichten.ejs`

Reuses the exact shell and design tokens from `index.ejs` (fonts `DM Serif
Display` / `DM Sans`, `:root` palette, sidebar, top-right Abmelden button).

**Layout**
- Sidebar identical to `index.ejs` but with **Nachrichten** marked `active`.
  Sidebar buttons become real links: index's "Nachrichten" → `/nachrichten`,
  this page's "Kalender" → `/`.
- Header: title "Nachrichten" + subtitle, with an **unread count** ("3 ungelesen").
- No filter tabs (YAGNI).

**Message card** (newest first)
- Unread affordance: accent left-border + subtle tint + a dot; clears on
  play/open.
- Sender name + relative timestamp ("vor 2 Std."), exact datetime on hover
  (`title` attribute).
- Context text (`body`).
- **Custom audio player**: play/pause button, click-to-seek progress bar,
  `0:00 / 0:14` time label, styled with portal tokens. Only one message plays at
  a time (playing one pauses any other).
- Delete button (trash icon), same hover-red styling as the slot-row delete.

**States**
- Empty: "Keine Nachrichten vorhanden."
- Loading a clip → the play button shows a spinner while the audio URL is fetched.
- Playback failure (expired URL `403`, network drop) → inline error message with an
  **"Erneut versuchen"** retry button that re-fetches a fresh URL and retries.
- Successful playback start → optimistic mark-read + `POST /api/messages/:id/read`
  (`TODO(author)`).
- Delete → optimistic card removal + `DELETE /api/messages` (`TODO(author)`).

## Data boundary (mock strategy)

- In-page `MOCK_MESSAGES` array feeds a `loadMessages()` stub (metadata only); the
  real request site carries `// TODO(author): wire up GET /api/messages`.
- A `getAudioUrl(id)` stub returns the play-time URL, carrying
  `// TODO(author): wire up GET /api/messages/:id/audio-url`. For the mock it
  synthesizes a short playable WAV tone on demand, so the custom player is fully
  demonstrable offline (a comment marks where to force an error to exercise the
  retry path).
- `markRead()` and `deleteMessage()` update the UI optimistically and carry
  `// TODO(author): wire up …` at the request site. No `fetch` is written.

## Custom audio player behavior

- One lazily-created `HTMLAudioElement` per card, with its source set at play time.
- **Play** fetches a fresh URL via `getAudioUrl(id)` (spinner shown, button
  disabled), sets it as the source, and plays. **Pause → play** resumes in place
  without re-fetching; a fresh start (or after error/ended) fetches a new URL.
- `timeupdate` → progress-bar width + current-time label; `loadedmetadata` →
  total-time label (falls back to `audio_duration_s` before load).
- Click on progress bar → seek (only once a source is loaded).
- Starting playback pauses any currently-playing message (single-active-player).
- Successful playback start triggers `markRead()`; a failed load does not.
- An `error` listener plus the `play()`/fetch `catch` surface a retryable inline
  error; mock blob URLs are revoked on replace to avoid leaks.

## Out of scope / non-goals

- Composing or replying to messages.
- Real-time/websocket updates.
- Pagination or search (small inbox assumed; can be added later).
- Any change to `server.js`, `passwort-config.js`, or SQL execution.
