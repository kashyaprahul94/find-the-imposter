# Imposter Party Game — Working Notes

## What this is

A phone-first web app for playing the "Imposter" word game with a friend group
in the same room. Someone creates a room, others join by QR or code, and rounds
are dealt in real time — everyone sees the same word except the imposter. The
dealer reveals with a full-screen strobe.

Target: **~10 players max**, friends physically together, playing casually.

## Current state

Built and working. **Server-authoritative**: the server picks the imposter and
tells each player only their own word. Verified end-to-end against the live
Supabase project (37 assertions, all passing) using a throwaway Node script —
there is no committed test suite and no `npm test`.

Not deployed. **Nothing is committed** — the whole app is untracked on `main`
over the initial commit.

## Architecture

```
browser ──HTTP──> Next route handlers ──service role──> Supabase Postgres
   └────WebSocket────> Supabase Realtime (presence + signals only)
```

The browser cannot reach the database. All three tables have RLS enabled with
**no policies**, so the publishable key can read and write nothing; it exists
only to authenticate the Realtime socket.

Realtime carries one event, `signal` = `{ kind, roundKey, byName }`, meaning
"something changed, go refetch". It contains no words and no imposter, so it
does not matter who reads it.

## Data model

`supabase/schema.sql` — **running it drops all three tables.**

```
rooms   (id, code unique, created_at)
players (id, room_id→rooms, player_key, name, token_hash, created_at,
         unique (room_id, player_key))
rounds  (id, room_id→rooms, round_key, dealer_player_id, imposter_player_id,
         others_word, imposter_word, participant_ids bigint[], started_at,
         revealed_at, cleared_at, unique (room_id, round_key))
```

`revealed_at` gates history. `cleared_at` is what "Begin new round" sets, so a
refresh doesn't resurrect a round the room has moved past. Deleting a room
cascades to its players and rounds.

## API

| Route | Auth | Notes |
|---|---|---|
| `POST /api/rooms` | — | Create; retries on code collision |
| `GET /api/rooms/[code]` | — | Existence check |
| `POST /api/rooms/[code]/join` | token optional | Token ⇒ same person returning; no token ⇒ new player |
| `GET /api/rooms/[code]/state` | token | **The security model.** Per-player view |
| `POST /api/rooms/[code]/rounds` | token | Server picks the imposter |
| `POST .../rounds/[key]/reveal` | token | **Dealer only**, enforced server-side |
| `POST .../rounds/[key]/clear` | token | Any member |
| `GET /api/rooms/[code]/history` | token | Revealed rounds only |

## Locked decisions — do not re-litigate

- **No audio, no vibration.** iOS has no Vibration API and won't play sound
  without a gesture. Anything that differs across phones ruins the reveal. It is
  visual only.
- **The server picks the imposter and tells nobody**, including the dealer,
  until reveal. No device in the room holds the answer. This replaced an earlier
  client-side design and is the point of the current architecture.
- **The dealer is never the imposter** — they typed both words. They get both
  words but not who drew which.
- **Reveal is dealer-only with no fallback**, enforced in the route handler.
  Because a dealer who closes their tab strands the round, **any member may
  clear a round**, revealed or not, so the room can always move on.
- **Minimum 2 players, but 2 is degenerate** — with the dealer excluded the one
  other player is always the imposter. Allowed only so two devices can test; the
  UI says so. 4+ plays well.
- **Mid-round joiners sit out.** Not in `participant_ids`, so no word.
- **Identity is a token, not a `player_key`.** 256 bits issued at join, SHA-256
  stored. `player_key` is a public handle that proves nothing. This is what
  makes "give me my word" safe.
- **Sessions are per-room** (`imposter:room:<CODE>` in localStorage). A stored
  token rejoins silently; a QR into a new room always prompts, prefilled. Do not
  reintroduce a single global name — that caused silent rejoins under stale
  names.
- **No accounts.** Room codes are 5 chars from
  `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` — no I, O, 0 or 1. Out-of-alphabet
  characters are *kept*, not stripped, so a bad paste fails loudly instead of
  silently becoming a different valid code.
- **Free tier only.** Vercel Hobby + Supabase free.

## Traps

- **`supabase-js` only maintains `presenceState()` if a presence listener is
  bound.** Without `channel.on("presence", …)`, `track()` returns `"ok"` and
  presence stays silently empty forever, with no error.
- **TypeScript must stay on 5.x.** `npm i -D typescript` resolves TS 7, and Next
  15.5's config loader dies on it with
  `Cannot read properties of undefined (reading 'fileExists')`.
- **The service-role client must be constructed lazily.** Next evaluates route
  modules while collecting page data at build time; a module-scope throw on a
  missing key fails the *build*, not the request. See `src/lib/server/admin.ts`.
- **`server-only` is imported by every `src/lib/server/*` module** so importing
  one from a client component is a build error rather than a leaked key.
- **RLS with no policies returns zero rows on select, not an error**, and
  `42501` on write. Don't assert on a select error to prove a table is
  protected — count rows via the service role and compare.
- **`.env.example` is committed; `.env.local` is ignored.** Real secrets go only
  in the latter. If the service role key ever reaches a commit, rotate it in
  Supabase rather than rewriting history.
- **BSD `sed` has no `\b`.** Use `perl -pi -e` for word-boundary rewrites.
- **iOS suspends websockets on screen lock.** `useRoom` re-tracks presence and
  refires the signal on `visibilitychange`.
- **`useRoundState` serialises refetches** — a burst of signals (everyone
  unlocking at once) must not interleave into a stale result.
- **Inputs must be ≥16px** or iOS Safari zooms the page. Body is 20px because
  VT323 draws small.

## Known gaps

- No committed tests, no CI, not deployed.
- Test rows are in the live DB (2 rooms, 5 players, 1 round from the API suite).
- No rename control once you've joined a room; clearing the session means
  leaving via the logo link.
- `useWakeLock` and the reveal overlay are unverified on real iOS hardware.

## Aesthetic

Arcade/CRT, not SaaS. Black ground (`--color-void`), neon magenta + cyan,
`Press Start 2P` for chrome, `VT323` for body, fixed scanline and vignette
overlays, chunky hard-shadow buttons that depress on tap. The reveal is a 240ms
red/black strobe ×8 with a shake, settling on solid red.

`prefers-reduced-motion` collapses every strobe, shake and flicker to the static
end state — the imposter still learns they're the imposter. Strobing is a real
seizure risk; don't remove that guard.

## Layout

```
src/lib/server/  admin (lazy service-role client), auth (tokens), store, handler
src/app/api/     rooms, join, state, rounds, reveal, clear, history
src/lib/         api, session, types, roomCode, identity, constants, supabase
src/hooks/       useRoom, useRoundState, useWakeLock
src/components/  ui, RoomView, RoundSetup, WordCard, PlayerList,
                 HistoryPanel, SharePanel, RevealOverlay
supabase/        schema.sql
```

`src/app/api/rooms/[code]/state/route.ts` decides what one player may know and
is the first place to look when someone sees the wrong thing. `RoomView` is the
client orchestrator.

## Commands

```bash
npm run dev                 # localhost:3000
npm run dev -- -H 0.0.0.0   # test with real phones over LAN
npm run build
npm run typecheck
```
