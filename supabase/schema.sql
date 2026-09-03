-- Run this in the Supabase SQL editor.
--
-- WARNING: the drops below destroy all existing rooms and history.
-- Rooms are ephemeral by design, so this is safe between game nights.

drop table if exists public.rounds;
drop table if exists public.players;
drop table if exists public.rooms;

-- A room is just a code. It exists so joining a mistyped code can say "no such
-- room" instead of dropping the player into a silent empty broadcast channel.
create table public.rooms (
  id         bigint generated always as identity primary key,
  code       text not null unique,
  created_at timestamptz not null default now()
);

-- One row per *concluded* round: the words already played, so nobody re-uses a
-- pair, and so the imposter weighting has history to read on a device that just
-- joined.
--
-- Nothing is written until the imposter has been revealed to the room. A live
-- round exists only in the realtime broadcast, so this table can never hand out
-- an answer that is still in play.
create table public.rounds (
  id            bigint generated always as identity primary key,
  room_id       bigint not null references public.rooms(id) on delete cascade,
  round_key     text not null,
  others_word   text not null,
  imposter_word text not null,
  -- The player's client-generated key, not a foreign key: there is no players
  -- table. Used to weight who draws next.
  imposter_key  text not null,
  imposter_name text not null,
  dealer_name   text not null,
  started_at    bigint not null,
  created_at    timestamptz not null default now(),
  -- Two people racing to hit Reveal must not double-insert the round.
  unique (room_id, round_key)
);

create index rounds_room_idx on public.rounds (room_id, started_at desc);
create index rooms_created_at_idx on public.rooms (created_at);

alter table public.rooms  enable row level security;
alter table public.rounds enable row level security;

-- The app is fully client-side: the browser talks to Postgres directly with the
-- publishable key, so these policies are the only access control there is.
-- Deliberately permissive — a room code and two words are not secrets, and the
-- players are friends in one room. There is no update or delete policy, so
-- history is append-only from the client.
create policy "anon can create rooms" on public.rooms  for insert to anon with check (true);
create policy "anon can read rooms"   on public.rooms  for select to anon using (true);
create policy "anon can log rounds"   on public.rounds for insert to anon with check (true);
create policy "anon can read rounds"  on public.rounds for select to anon using (true);

-- Optional housekeeping; cascades to rounds. Requires pg_cron.
--
-- select cron.schedule(
--   'purge-old-rooms',
--   '0 4 * * *',
--   $$ delete from public.rooms where created_at < now() - interval '1 day' $$
-- );
