# Find the Imposter

A phone-first party game for a group in the same room. Everyone gets the same
word except one person. Talk around it, work out who's bluffing, then the dealer
hits **Reveal** and the imposter's screen strobes red.

Fully client-side. Next.js on Vercel serves two static-ish pages; the browser
talks straight to Supabase — Realtime for play, Postgres for room codes and
history. There is no backend to run or pay for.

## Setup

1. **Create the tables.** Supabase dashboard → SQL Editor → paste
   [`supabase/schema.sql`](supabase/schema.sql) → Run. Two tables, `rooms` and
   `rounds`. Re-running the file **drops both**.

   RLS allows anonymous insert and select, with no update or delete policies —
   history is append-only. Those policies are the only access control the app
   has, which is fine: a room code and two already-revealed words are not
   secrets.

2. **Environment.** Copy `.env.example` to `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   Both ship in the JS bundle by design — the browser needs them to reach
   Supabase at all. There is no server-side secret. `.env.local` is gitignored;
   `.env.example` is committed and takes empty placeholders only.

3. **Run it.**

   ```bash
   npm install
   npm run dev
   ```

   To test with real phones: `npm run dev -- -H 0.0.0.0`, then open
   `http://<your-lan-ip>:3000` on each device. The QR encodes whatever origin
   the creator's browser is on, so it points at the LAN address too. (Clipboard
   copy needs HTTPS or localhost, so over LAN use the QR, not the link button.)

## Deploying to Vercel

Push to GitHub, import at [vercel.com/new](https://vercel.com/new), and add the
environment variables **on the import screen, before the first build** — a
missing `NEXT_PUBLIC_` value fails the build rather than degrading at runtime.

Tick Production, Preview and Development for both. Vercel may offer to store
them as **Config** rather than secrets; that's correct — they're public by
design. Do not strip the `NEXT_PUBLIC_` prefix, or Next won't inline them and
the app can't reach Supabase at all.

`NEXT_PUBLIC_*` values are inlined at build time, so changing one takes effect
only after a redeploy.

Hobby tier is more than enough — there are no serverless functions to invoke,
just static assets and a Supabase free tier that allows 200 concurrent Realtime
connections.

## How a round works

1. Anyone can **deal**: two words, one for the group and a different one for the
   imposter.
2. The dealer's device picks the imposter and broadcasts the round. Each phone
   shows itself the word that applies to it. One hop — about 30ms.
3. The dealer can **nominate** someone instead of leaving it to chance.
4. Anyone joining mid-round sits it out and is dealt in next round.
5. The **dealer** reveals. The imposter's screen strobes; everyone else sees the
   name. If the dealer has left the room, the button unlocks for everyone after
   five seconds, so a closed tab never strands a round.
6. The round's words and imposter join the room's **played** list, and **Begin
   new round** appears for everyone. Whoever taps it deals next.

### Who gets picked

Uniform random is why the same person kept drawing — with four candidates
there's a 25% chance of a repeat, and a table reads that as the app being
broken. So the draw is deliberately *less* random than uniform: the previous
imposter is skipped, and everyone else is weighted by how long they've waited,
with never-picked players weighted highest.

Over 4000 simulated rounds with four players: 1017/986/989/1008, and no
back-to-back repeats.

## What this design does and doesn't protect

The round is broadcast in full, so a player who reads their own network traffic
can see who the imposter is. That's a deliberate trade for speed, made after
measuring the alternative: an earlier server-authoritative version hid the
imposter from every device including the dealer's, but put two sequential
round-trips in front of each deal and reveal — ~370ms to 1.4s against 30ms for a
broadcast. For friends around one table, instant won.

The one thing that is protected: a round reaches the database **only when it's
revealed**. A live round exists nowhere but the broadcast, so the `rounds` table
— which anyone with the room code can read — can never hand out an answer that's
still in play. It only ever holds words the room has already seen.

## Deliberate non-goals

- **No audio, no vibration.** iOS won't play sound without a user gesture and
  has no Vibration API. Anything that behaves differently on half the phones
  ruins the reveal, so the moment is purely visual.
- **No accounts.** A name per room, remembered per room.
- **No backend.** No API routes, no server-side secret, nothing to operate.
- **No round history beyond the room.** Deleting a room cascades to its rounds.

## Layout

```
src/lib/         imposter (who draws), rooms (Supabase queries), session,
                 types, roomCode, identity, constants, supabase
src/hooks/       useRoom (all live state), useRoundHistory, useWakeLock
src/components/  ui, RoomView, RoundSetup, WordCard, PlayerList,
                 HistoryPanel, SharePanel, RevealOverlay
src/app/         / (create or join), /room/[code], not-found, layout
supabase/        schema.sql
```

`src/hooks/useRoom.ts` holds everything the room sees while playing, and
`src/lib/imposter.ts` is the pure module that decides who draws — the first two
places to look when round behaviour is wrong.

## Commands

```bash
npm run dev
npm run build
npm run typecheck

# Safe to run while a dev server is up. Two Next processes must never share one
# .next directory — they serve each other half-written chunks, and the symptom
# is a room that provably exists reporting "was never created".
NEXT_DIST_DIR=.next-verify npx next build
```
