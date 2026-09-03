# Find the Imposter

A phone-first party game for a group in the same room. Everyone gets the same
word except one person. Talk around it, work out who's bluffing, then the dealer
hits **Reveal** and the imposter's screen strobes red.

Nobody's phone knows who the imposter is — not even the dealer's. The server
picks, and tells each player only their own word.

Next.js on Vercel, Supabase Postgres behind a small API, Supabase Realtime for
presence and signalling.

## Setup

1. **Create the tables.** Supabase dashboard → SQL Editor → paste
   [`supabase/schema.sql`](supabase/schema.sql) → Run. Three tables: `rooms`,
   `players`, `rounds`. Re-running the file **drops all three**.

   Every table has RLS enabled with **no policies at all**. That is deliberate:
   the browser's key can't read or write any of them. All access goes through
   server route handlers using the service role key.

2. **Environment.** Copy `.env.example` to `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
   ```

   The two `NEXT_PUBLIC_` values ship in the JS bundle by design — the browser
   needs them to open the Realtime socket. They grant nothing else.

   `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely and must never carry the
   `NEXT_PUBLIC_` prefix. `.env.local` is gitignored; `.env.example` is
   committed and takes empty placeholders only.

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

Tick Production, Preview and Development for all three. Vercel may offer to
store the two `NEXT_PUBLIC_` values as **Config** rather than secrets; that's
correct, they're public by design. `SUPABASE_SERVICE_ROLE_KEY` stays a secret
Environment Variable.

`NEXT_PUBLIC_*` values are inlined at build time, so changing one takes effect
only after a redeploy.

Hobby tier covers this comfortably: route handlers are serverless functions, and
ten players generate a few dozen invocations per round.

## How a round works

1. Anyone can **deal**: two words, one for the group and a different one for the
   imposter.
2. The **server** picks the imposter from the players present, excluding the
   dealer, and stores it. It is not returned to anyone — the deal response
   contains only a round key.
3. Each phone asks the server for its own state. A player gets a single word and
   nothing else: not the other word, not who the imposter is, not even whether
   it's them. The dealer gets both words (they typed them) but is **not** told
   who drew which.
4. Anyone joining mid-round sits it out and is dealt in next round.
5. The **dealer** reveals — enforced server-side, so hiding the button is a
   convenience, not the control. The imposter's screen strobes; everyone else
   sees the name, and the dealer finds out at the same moment.
6. The round's words and imposter join the room's **played** list, and **Begin
   new round** appears for everyone. Whoever taps it deals next.

If a dealer closes their tab mid-round, that round can never be revealed — so
any member can clear it and deal a fresh one. The room is never stuck.

## What this design does and doesn't protect

The interesting property: **no device in the room holds the answer.** Opening
devtools, reading the WebSocket frames, or inspecting localStorage tells you
nothing, because the imposter's identity only ever exists in the database and in
the one response sent to the player it concerns.

Player identity is a 256-bit token issued at join; the database stores only its
SHA-256. `player_key` is a public handle that proves nothing, so there is no
request shape in which one player can ask for another player's word.

What it does not protect against: the dealer knows both words, because they
typed them. That's inherent to the game.

## Deliberate non-goals

- **No audio, no vibration.** iOS won't play sound without a user gesture and
  has no Vibration API. Anything that behaves differently on half the phones
  ruins the reveal, so the moment is purely visual.
- **No accounts.** A name per room, remembered per room.
- **No round history beyond the room.** Deleting a room cascades to its players
  and rounds.

## Layout

```
src/lib/server/  admin (service-role client), auth (tokens), store (queries), handler
src/app/api/     rooms, join, state, rounds, reveal, clear, history
src/lib/         api (client fetch), session, types, roomCode, identity, constants
src/hooks/       useRoom (presence + signals), useRoundState (fetch), useWakeLock
src/components/  ui, RoomView, RoundSetup, WordCard, PlayerList,
                 HistoryPanel, SharePanel, RevealOverlay
supabase/        schema.sql
```

`src/app/api/rooms/[code]/state/route.ts` is the security model in one file: it
decides what a single player may know, and every screen renders from what it
returns.

## Commands

```bash
npm run dev
npm run build
npm run typecheck
```
