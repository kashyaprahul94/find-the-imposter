# Imposter Party Game — Working Notes

## What this is

A phone-first web app for the "Imposter" word game with a friend group in the
same room. Someone creates a room, others join by QR or code, rounds are dealt
in real time — everyone sees the same word except the imposter. The dealer
reveals with a full-screen strobe.

Target: **~20 players max**, friends physically together, playing casually.

## Current state

Built and working. **Fully client-side** — no API routes, no server code of our
own. Verified live against the real Supabase project: broadcast reaches peers in
~31ms, imposter selection passes 11 statistical assertions, and the client-only
data path passes 17.

Not deployed. **Nothing is committed** — the whole app is untracked on `main`
over the initial commit.

## Architecture

```
browser ──WebSocket──> Supabase Realtime  (all live play: presence + rounds)
browser ──HTTPS──────> Supabase Postgres  (room codes + history, via RLS)
```

Next.js serves two pages and nothing else. `src/app/api/` and `src/lib/server/`
existed and were deleted deliberately.

### The trade this encodes

The broadcast payload contains the imposter's identity, and the publishable key
in the bundle can read and write `rooms` and `rounds`. Anyone inspecting their
own traffic can see who the imposter is.

**This was measured, not assumed.** A server-authoritative version was built and
working — it hid the imposter from every device including the dealer's — but put
two sequential round-trips in front of every deal and reveal: ~370ms–1.4s
against ~31ms for a broadcast. The owner chose speed, on the grounds that this
is played on phones by friends in one room. Do not reintroduce a server without
being asked.

One thing that *is* protected: a round is written to the database **only at
reveal**. A live round exists nowhere but the broadcast, so the table can never
hand out an answer that is still in play.

## Data model

`supabase/schema.sql` — **running it drops both tables.**

```
rooms  (id, code unique, creator_key, created_at)
rounds (id, room_id→rooms on delete cascade, round_key, others_word,
        imposter_word, imposter_keys text[], imposter_names text[],
        dealer_name, started_at, created_at, unique (room_id, round_key))
```

`imposter_keys` are client-generated player keys, not foreign keys — there is
no players table. They exist so imposter weighting still works on a device that
joined late, and they are arrays because a round can have several imposters.
`creator_key` is written when the room is opened and marks the one player
nobody can remove. The unique constraint makes two people racing to hit Reveal a
no-op rather than a duplicate row.

RLS allows anon insert and select, with **no update or delete policies**, so
history is append-only from the client. Those policies are the only access
control that exists.

## Realtime protocol

Channel `room:<CODE>`, with `broadcast: { self: true }` and
`presence: { key: playerKey }`.

| Event | Payload |
|---|---|
| `presence` | `{ key, name, joinedAt }` |
| `round-start` | full `Round`, including `imposterKey` |
| `reveal` | `{ roundId }` |
| `round-reset` | `{ roundId, byKey, byName }` |
| `kick` | `{ targetKey, byName }` — cooperative removal |
| `state-request` / `state-sync` | reconnect resync |

## Imposter selection — `src/lib/imposter.ts`

Uniform random is why the same person kept drawing: with four candidates there's
a 25% chance of a repeat, and a table reads that as broken. The pick is
deliberately **less** random than uniform:

- The most recent imposter is excluded outright, but only with ≥3 candidates —
  with two, excluding them would make it perfectly predictable.
- Everyone else is weighted by rounds since they last drew; never-drawn players
  get maximum weight, so newcomers are picked early.
- A round can have **several imposters** (1 to the whole candidate pool). The
  no-repeat rule applies to the previous round's whole set, and relaxes when
  excluding them would starve the pool.
- The dealer can **nominate** specific players, overriding the draw. The picker
  is collapsed behind a summary line — at twenty players an open list is ten
  rows of chrome for a feature most rounds skip — and gains a filter box past
  eight candidates. Pinning fewer than the count fills the rest at random. The
  count is derived as `max(stepper, pinned)`, so clearing the selection drops
  back instead of leaving it stuck high. A nominee who has left is dropped
  rather than failing the deal.

Measured over 4000 simulated rounds with 4 players: 1017/986/989/1008, zero
back-to-back repeats. History (and therefore the weighting) is read from the
database on join, so a fresh device still weights correctly.

## Presence vs. the roster — `src/lib/roster.ts`

Locking a phone or switching apps suspends the page within seconds. Timers stop,
the websocket heartbeat stops, and Supabase drops the player from presence.
**No web page can prevent this** — iOS gives a suspended tab no execution.

So presence is not the roster. `useRoom` keeps its own roster and folds presence
into it:

- Connected → `present: true`, `lastSeen` refreshed.
- Dropped → kept as `present: false` ("AWAY" in the UI) for `AWAY_GRACE_MS`
  (120s). **Still dealt into new rounds** — they're at the table, their screen
  just went dark.
- Absent past the grace → removed.
- The dealer only loses the reveal after `DEALER_ABSENT_MS` (45s), longer than a
  glance at another app but short enough that a closed tab doesn't strand a
  round.

`reconcileRoster` refreshes `lastSeen` for everyone connected, not just on
presence events. Presence only fires on *change*, so without that a player
sitting quietly connected for over the grace period carried a stale `lastSeen`
and got evicted the instant their phone locked, with no grace at all. That bug
was caught by `roster-test.ts`, not by reading the code.

## Removing players

Any player can remove any other, except the room creator (`rooms.creator_key`,
written when the room is opened). It takes two taps — the ✕ arms, a second
confirms — because a misfire on a phone is one tap away otherwise.

Removal is **cooperative**: the `kick` broadcast tells the target's own client
to leave, and everyone else drops them from the roster. A player who ignored the
message, or who rescans the QR, is back in. That is fine for friends at a table
and is the same trust assumption the whole app rests on — don't "harden" it
without being asked.

## Locked decisions — do not re-litigate

- **No audio, no vibration.** iOS has no Vibration API and won't play sound
  without a gesture. Anything that differs across phones ruins the reveal.
- **No server.** See the trade above.
- **The dealer is never the imposter** — they typed both words.
- **Minimum 2 players, but 2 is degenerate**: the one other player is always the
  imposter. Allowed only so two devices can test; the UI says so.
- **Mid-round joiners sit out.** Not in `participantKeys`, so no word.
- **Rounds are written only at reveal**, never at deal.
- **Identity is a client-generated key in localStorage.** No auth, no players
  table; both went with the server.
- **Sessions are per-room** (`imposter:room:<CODE>`). A stored entry rejoins
  silently; a QR into a new room always prompts, prefilled. Never reintroduce a
  single global name — it caused silent rejoins under stale names.
- **The name field belongs to neither Create nor Join**; it sits above both,
  which gate on it. It used to live inside the Create panel and read as though
  Join didn't need it.
- **`?name=` is stripped from the URL** with `replaceState` once read, or a
  player copying their address bar hands the next person a link that joins as
  *them*.
- **Room codes** are 5 chars from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` — no I, O,
  0 or 1. Out-of-alphabet characters are *kept*, not stripped, so a bad paste
  fails loudly instead of becoming a different valid code.

## Traps

- **Never run two Next processes against the same `.next`.** A second dev server
  or a `next build` while `next dev` runs serves the browser chunks from another
  compilation — the symptom is a room that provably exists reporting "was never
  created". There is one build directory, so stop the dev server before
  building, or check against the running one.
- **`supabase-js` only maintains `presenceState()` if a presence listener is
  bound.** Without `channel.on("presence", …)`, `track()` returns `"ok"` and
  presence stays silently empty forever, with no error.
- **Presence takes ~2.2s to converge with three clients**, and one client can
  sit at a stale count for two seconds before jumping. Dealing inside that
  window leaves a present player out of `participantKeys` and they wrongly sit
  out. `RoundSetup` warns for 1.5s after any roster change.
- **TypeScript must stay on 5.x.** `npm i -D typescript` resolves TS 7 and Next
  15.5's config loader dies with
  `Cannot read properties of undefined (reading 'fileExists')`.
- **Deleting routes leaves stale generated types.** `tsc` fails on
  `.next/types/**` referencing files that no longer exist. `rm -rf .next` and
  re-run.
- **RLS returns zero rows on select rather than an error** when a policy denies
  it (and `42501` on write). To prove a table is protected, count rows with a
  privileged key and compare — don't assert on a select error.
- **`.env.example` is committed; `.env.local` is ignored.** Real values only
  ever go in the latter.
- **BSD `sed` has no `\b`.** Use `perl -pi -e` for word-boundary rewrites.
- **Heredocs break under this shell wrapper.** Write scripts with the file tools
  instead of `cat <<EOF`.
- **iOS suspends websockets on screen lock.** `useRoom` re-tracks presence and
  re-requests state on `visibilitychange`.
- **Inputs must be ≥16px** or iOS Safari zooms the page. Body is 20px because
  VT323 draws small.

## Known gaps

- No committed tests, no CI, not deployed.
- Test rooms are in the live DB from verification runs.
- No rename control once joined; clearing the session means leaving via the logo.
- `useWakeLock` and the reveal strobe are unverified on real iOS hardware.
- A round revealed while offline never reaches history — the write is
  fire-and-forget and isn't retried.

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
src/lib/         imposter (who draws), roster (who's in the room), rooms
                 (Supabase queries), session, types, roomCode, identity,
                 constants, supabase
src/hooks/       useRoom (all live state), useRoundHistory, useWakeLock
src/components/  ui, RoomView, RoundSetup, WordCard, PlayerList,
                 HistoryPanel, SharePanel, RevealOverlay
src/app/         / (create or join), /room/[code], not-found, layout, globals.css
supabase/        schema.sql
```

`useRoom` holds everything the room sees during play; `src/lib/imposter.ts` is
pure and is where selection behaviour lives. Those are the first two places to
look when round behaviour is wrong.

## Commands

```bash
npm run dev
npm run dev -- -H 0.0.0.0                 # real phones over LAN
npm run typecheck
```
