-- Migration 005: opt-in public forks (the "Hall of Worlds")
--
-- Forks stay private by default. A player can publish one — setting is_public
-- and an optional title — which lists it in the public Hall of Worlds and makes
-- that fork's media/state publicly readable. Nothing is exposed without the
-- owner explicitly publishing it.

alter table worlds add column if not exists is_public   boolean not null default false;
alter table worlds add column if not exists title        text;
alter table worlds add column if not exists published_at timestamptz;

-- Fast listing of the Hall, newest first.
create index if not exists worlds_public_idx
  on worlds (published_at desc)
  where is_public = true;

-- ── Public read of published forks and their data ────────────────────────────
create policy if not exists "public read published forks" on worlds
  for select using (is_public = true);

create policy if not exists "public read published fork states" on country_states
  for select using (world_id in (select id from worlds where is_public = true));

create policy if not exists "public read published fork events" on world_events
  for select using (world_id in (select id from worlds where is_public = true));

create policy if not exists "public read published fork decisions" on agent_decisions
  for select using (world_id in (select id from worlds where is_public = true));

-- ── Owner can toggle publish state on their own forks ────────────────────────
-- (Insert is already covered by "players create forks"; this adds UPDATE.)
create policy if not exists "players update own forks" on worlds
  for update using (player_id = auth.uid())
  with check (player_id = auth.uid());
