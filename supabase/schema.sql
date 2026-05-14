-- RealityShift world state schema
-- Run this in the Supabase SQL editor to initialize all tables.

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
  player_country_code  text  -- ISO3 code of the country the player took over
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
create policy "public read live world" on worlds
  for select using (is_live = true);

create policy "public read live country states" on country_states
  for select using (world_id = 'live');

create policy "public read agent decisions" on agent_decisions
  for select using (world_id = 'live');

create policy "public read divergences" on divergences
  for select using (true);

-- Players read/write their own forks
create policy "players read own forks" on worlds
  for select using (player_id = auth.uid());

create policy "players create forks" on worlds
  for insert with check (player_id = auth.uid() and is_live = false);

create policy "players read own fork states" on country_states
  for select using (
    world_id in (select id from worlds where player_id = auth.uid())
  );

create policy "players write own fork states" on country_states
  for all using (
    world_id in (select id from worlds where player_id = auth.uid())
  );

create policy "players read own sessions" on game_sessions
  for select using (player_id = auth.uid());

create policy "players write own sessions" on game_sessions
  for all using (player_id = auth.uid());

-- World events RLS
alter table world_events enable row level security;

create policy "public read live world events" on world_events
  for select using (world_id = 'live');

create policy "players read own fork events" on world_events
  for select using (
    world_id in (select id from worlds where player_id = auth.uid())
  );

-- Players read/write agent_decisions in their forks
create policy "players read own fork decisions" on agent_decisions
  for select using (
    world_id in (select id from worlds where player_id = auth.uid())
  );

create policy "players write own fork decisions" on agent_decisions
  for insert with check (
    world_id in (select id from worlds where player_id = auth.uid())
  );

-- Service role bypasses RLS for background agents (set in Cloudflare Worker)
