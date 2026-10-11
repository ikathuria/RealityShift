-- RealityShift world state schema
-- Run this in the Supabase SQL editor to initialize all tables.
-- Safe to re-run; it is equivalent to applying migrations 002–006 on top of the
-- original schema. Existing databases should apply supabase/migrations/ in order.

-- Enable pgvector for historical period embeddings (Milestone 4)
create extension if not exists vector;

-- ────────────────────────────────────────────────────────────────────────────
-- Worlds: canonical world state, branched per player fork
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists worlds (
  id                   text primary key default gen_random_uuid()::text,
  fork_of              text references worlds(id),
  created_at           timestamptz not null default now(),
  is_live              boolean not null default false,
  player_id            uuid references auth.users(id),
  forked_at_year       int,
  player_country_code  text,  -- ISO3 code of the country the player took over
  -- Hall of Worlds (migration 005): opt-in publishing, set only via publish_world()
  is_public            boolean not null default false,
  title                text,
  published_at         timestamptz,
  -- Daily Instagram cron posts each published world once (migration 006)
  instagram_posted_at  timestamptz
);

-- The single live simulation world
insert into worlds (id, is_live) values ('live', true)
  on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────────────────────────
-- Country states: each country's simulated state within a world
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists country_states (
  world_id             text not null references worlds(id) on delete cascade,
  country_code         text not null,  -- ISO 3166-1 alpha-3 (e.g. "IND")
  year                 int  not null,
  indicators           jsonb not null default '{}',
  -- e.g. { gdp_per_capita, population, tax_rate, military_spend,
  --         education_spend, healthcare_spend, unemployment }
  policies             jsonb not null default '{}',
  -- e.g. { trade_openness, press_freedom, political_leaning, ... }
  relations            jsonb not null default '{}',
  -- e.g. { "USA": "ally", "CHN": "rival" }
  agent_memory_summary text,
  last_updated         timestamptz not null default now(),
  primary key (world_id, country_code, year)
);

-- ────────────────────────────────────────────────────────────────────────────
-- Agent decisions: what each AI agent decided and why
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists agent_decisions (
  id                 bigserial primary key,
  world_id           text not null references worlds(id) on delete cascade,
  country_code       text not null,
  year               int  not null,
  decision           jsonb not null default '{}',
  reasoning          text,
  historical_parallel jsonb,
  -- e.g. { period_id, name, similarity_score }
  projected_indicators jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists agent_decisions_world_country
  on agent_decisions (world_id, country_code, year desc);

-- ────────────────────────────────────────────────────────────────────────────
-- Divergences: monthly sim-vs-reality comparison (live world only)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists divergences (
  id           bigserial primary key,
  country_code text not null,
  sim_year     int  not null,
  real_date    date not null,
  sim_state    jsonb not null default '{}',
  real_state   jsonb not null default '{}',
  delta        jsonb not null default '{}',
  narrative    text,
  published_at timestamptz not null default now()
);

create index if not exists divergences_country_date
  on divergences (country_code, published_at desc);

-- ────────────────────────────────────────────────────────────────────────────
-- World events: inter-agent diplomatic/trade/military events (M8)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists world_events (
  id           bigserial primary key,
  world_id     text not null references worlds(id) on delete cascade,
  from_country text not null,
  to_country   text,
  event_type   text not null,
  details      text not null,
  sim_year     int  not null,
  created_at   timestamptz not null default now()
);

create index if not exists world_events_world_year
  on world_events (world_id, sim_year desc, created_at desc);

create index if not exists world_events_target
  on world_events (world_id, to_country, sim_year desc);

-- ────────────────────────────────────────────────────────────────────────────
-- Game sessions: player takeover sessions
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists game_sessions (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references auth.users(id),
  world_id     text not null references worlds(id) on delete cascade,
  country_code text not null,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  summary      text
);

-- ────────────────────────────────────────────────────────────────────────────
-- Row-level security
-- Players can only read/write their own forks; the live world is public read.
-- ────────────────────────────────────────────────────────────────────────────
alter table worlds         enable row level security;
alter table country_states enable row level security;
alter table agent_decisions enable row level security;
alter table divergences    enable row level security;
alter table game_sessions  enable row level security;

-- Public read on live world
drop policy if exists "public read live world" on worlds;
create policy "public read live world" on worlds
  for select using (is_live = true);

drop policy if exists "public read live country states" on country_states;
create policy "public read live country states" on country_states
  for select using (world_id = 'live');

drop policy if exists "public read agent decisions" on agent_decisions;
create policy "public read agent decisions" on agent_decisions
  for select using (world_id = 'live');

drop policy if exists "public read divergences" on divergences;
create policy "public read divergences" on divergences
  for select using (true);

-- Players read/write their own forks
drop policy if exists "players read own forks" on worlds;
create policy "players read own forks" on worlds
  for select using (player_id = auth.uid());

drop policy if exists "players create forks" on worlds;
create policy "players create forks" on worlds
  for insert with check (player_id = auth.uid() and is_live = false);

drop policy if exists "players read own fork states" on country_states;
create policy "players read own fork states" on country_states
  for select using (
    world_id in (select id from worlds where player_id = auth.uid())
  );

drop policy if exists "players write own fork states" on country_states;
create policy "players write own fork states" on country_states
  for all using (
    world_id in (select id from worlds where player_id = auth.uid())
  );

drop policy if exists "players read own sessions" on game_sessions;
create policy "players read own sessions" on game_sessions
  for select using (player_id = auth.uid());

drop policy if exists "players write own sessions" on game_sessions;
create policy "players write own sessions" on game_sessions
  for all using (player_id = auth.uid());

-- World events RLS
alter table world_events enable row level security;

drop policy if exists "public read live world events" on world_events;
create policy "public read live world events" on world_events
  for select using (world_id = 'live');

drop policy if exists "players read own fork events" on world_events;
create policy "players read own fork events" on world_events
  for select using (
    world_id in (select id from worlds where player_id = auth.uid())
  );

-- Players read/write agent_decisions in their forks
drop policy if exists "players read own fork decisions" on agent_decisions;
create policy "players read own fork decisions" on agent_decisions
  for select using (
    world_id in (select id from worlds where player_id = auth.uid())
  );

drop policy if exists "players write own fork decisions" on agent_decisions;
create policy "players write own fork decisions" on agent_decisions
  for insert with check (
    world_id in (select id from worlds where player_id = auth.uid())
  );

-- Service role bypasses RLS for background agents (set in Cloudflare Worker)

-- ────────────────────────────────────────────────────────────────────────────
-- Region states: sub-national policy drill-down (Milestone 10)
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists region_states (
  id            bigserial primary key,
  world_id      text        not null default 'live',
  country_code  text        not null,
  region_code   text        not null,
  region_name   text        not null,
  year          integer     not null default 2024,
  population    bigint,
  policies      jsonb       not null default '{}',
  last_updated  timestamptz not null default now(),
  unique (world_id, region_code, year)
);

-- policies JSONB: { "housing": 5, "transport": 5, "local_tax": 20 }

create index if not exists idx_region_states_world_country
  on region_states (world_id, country_code);

alter table region_states enable row level security;

drop policy if exists "public read live regions" on region_states;
create policy "public read live regions" on region_states
  for select using (world_id = 'live');

drop policy if exists "players read own fork regions" on region_states;
create policy "players read own fork regions" on region_states
  for select using (
    world_id in (select id from worlds where player_id = auth.uid())
  );

drop policy if exists "players insert own fork regions" on region_states;
create policy "players insert own fork regions" on region_states
  for insert with check (
    world_id in (select id from worlds where player_id = auth.uid())
  );

drop policy if exists "players update own fork regions" on region_states;
create policy "players update own fork regions" on region_states
  for update using (
    world_id in (select id from worlds where player_id = auth.uid())
  );

create index if not exists idx_region_states_world_region
  on region_states (world_id, region_code);

-- ────────────────────────────────────────────────────────────────────────────
-- Hall of Worlds: opt-in public forks (migration 005)
-- ────────────────────────────────────────────────────────────────────────────
create index if not exists worlds_public_idx
  on worlds (published_at desc)
  where is_public = true;

drop policy if exists "public read published forks" on worlds;
create policy "public read published forks" on worlds
  for select using (is_public = true);

drop policy if exists "public read published fork states" on country_states;
create policy "public read published fork states" on country_states
  for select using (world_id in (select id from worlds where is_public = true));

drop policy if exists "public read published fork events" on world_events;
create policy "public read published fork events" on world_events
  for select using (world_id in (select id from worlds where is_public = true));

drop policy if exists "public read published fork decisions" on agent_decisions;
create policy "public read published fork decisions" on agent_decisions
  for select using (world_id in (select id from worlds where is_public = true));

-- ────────────────────────────────────────────────────────────────────────────
-- Review fixes (migration 006)
-- ────────────────────────────────────────────────────────────────────────────
-- ── 1. Latest state per country ──────────────────────────────────────────────
create index if not exists country_states_latest_idx
  on country_states (world_id, country_code, year desc);

create or replace view latest_country_states
  with (security_invoker = true) as
  select distinct on (world_id, country_code) *
  from country_states
  order by world_id, country_code, year desc;

grant select on latest_country_states to anon, authenticated;

-- ── 2. Publishing via RPC only ───────────────────────────────────────────────
drop policy if exists "players update own forks" on worlds;

create or replace function publish_world(
  p_world_id text,
  p_publish  boolean,
  p_title    text default null
) returns setof worlds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := nullif(left(btrim(coalesce(p_title, '')), 80), '');
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  return query
    update worlds
       set is_public    = p_publish,
           title        = case when p_publish then v_title else title end,
           published_at = case when p_publish then now() else null end
     where id = p_world_id
       and player_id = auth.uid()
       and is_live = false
    returning *;

  if not found then
    raise exception 'world not found or not yours' using errcode = '42501';
  end if;
end;
$$;

revoke all on function publish_world(text, boolean, text) from public, anon;
grant execute on function publish_world(text, boolean, text) to authenticated;

-- ── 3. Instagram: post each published world at most once ─────────────────────
alter table worlds add column if not exists instagram_posted_at timestamptz;

-- ── 4. Rate-limit log (Worker / service role only) ──────────────────────────
create table if not exists api_calls (
  id          bigserial primary key,
  player_id   uuid not null,
  action      text not null,
  world_id    text,
  created_at  timestamptz not null default now()
);

create index if not exists api_calls_player_action_idx
  on api_calls (player_id, action, created_at desc);

-- RLS on with no policies: only the service role (which bypasses RLS) can touch it.
alter table api_calls enable row level security;

-- ── 5. Idempotent divergence rows ────────────────────────────────────────────
-- Remove duplicates from earlier re-runs (keep the newest) before adding the key.
delete from divergences d
  using divergences newer
 where d.country_code = newer.country_code
   and d.sim_year     = newer.sim_year
   and d.real_date    = newer.real_date
   and d.id < newer.id;

create unique index if not exists divergences_country_year_date_key
  on divergences (country_code, sim_year, real_date);
