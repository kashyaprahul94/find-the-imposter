-- Run this in the Supabase SQL editor.
--
-- WARNING: the drops below destroy all existing rooms, players and history.
-- Rooms are ephemeral by design, so this is safe between game nights.

drop table if exists public.rounds;
drop table if exists public.players;
drop table if exists public.rooms;

create table public.rooms (
  id         bigint generated always as identity primary key,
  code       text not null unique,
  created_at timestamptz not null default now()
);

-- One row per person per room. `token_hash` is what makes the server able to
-- answer "what is *my* word" safely: the browser holds the raw token, the
-- database only ever sees its SHA-256.
--
-- `player_key` is the public handle (realtime presence key, participant lists).
-- It is deliberately NOT an identity: knowing someone's player_key proves
-- nothing, because every privileged call is authorised by the token instead.
create table public.players (
  id         bigint generated always as identity primary key,
  room_id    bigint not null references public.rooms(id) on delete cascade,
  player_key text not null,
  name       text not null,
  token_hash text not null,
  created_at timestamptz not null default now(),
  unique (room_id, player_key)
);

create index players_token_idx on public.players (token_hash);

-- Rounds are now written at deal time, which is only safe because no anon
-- client can read this table at all (see the RLS note below). The imposter's
-- identity lives here and nowhere else until the dealer reveals it — not in a
-- broadcast payload, and not on any player's device, including the dealer's.
create table public.rounds (
  id                  bigint generated always as identity primary key,
  room_id             bigint not null references public.rooms(id) on delete cascade,
  round_key           text not null,
  dealer_player_id    bigint not null references public.players(id) on delete cascade,
  imposter_player_id  bigint not null references public.players(id) on delete cascade,
  others_word         text not null,
  imposter_word       text not null,
  -- Who was dealt in. Anyone joining later sits the round out.
  participant_ids     bigint[] not null default '{}',
  started_at          bigint not null,
  -- Set when the dealer reveals. Until then the answer is server-side only.
  revealed_at         timestamptz,
  -- Set when someone starts the next round, so a refresh doesn't resurrect a
  -- round the room has already moved on from.
  cleared_at          timestamptz,
  created_at          timestamptz not null default now(),
  unique (room_id, round_key)
);

create index rounds_room_idx on public.rounds (room_id, started_at desc);
create index rooms_created_at_idx on public.rooms (created_at);

-- RLS is enabled with NO POLICIES on every table. That is intentional and is
-- the whole point of this design: the anon/publishable key can read and write
-- nothing. All database access goes through server route handlers using the
-- service role key, which bypasses RLS and is never sent to the browser.
--
-- The publishable key still ships in the bundle, but it now only authenticates
-- Realtime presence and signalling, neither of which carries a secret.
alter table public.rooms   enable row level security;
alter table public.players enable row level security;
alter table public.rounds  enable row level security;

-- Optional housekeeping; cascades to players and rounds. Requires pg_cron.
--
-- select cron.schedule(
--   'purge-old-rooms',
--   '0 4 * * *',
--   $$ delete from public.rooms where created_at < now() - interval '1 day' $$
-- );
