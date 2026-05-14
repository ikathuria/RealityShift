-- Migration 003: World events table for inter-agent coordination
-- Run this in the Supabase SQL editor.

create table if not exists world_events (
  id           bigserial primary key,
  world_id     text not null references worlds(id) on delete cascade,
  from_country text not null,           -- ISO3 of the emitting country
  to_country   text,                    -- ISO3 target (null = global announcement)
  event_type   text not null,           -- see EventType enum
  details      text not null,           -- human-readable description
  sim_year     int  not null,
  created_at   timestamptz not null default now()
);

-- Fast lookups: recent events for a world, events targeting a country
create index if not exists world_events_world_year
  on world_events (world_id, sim_year desc, created_at desc);

create index if not exists world_events_target
  on world_events (world_id, to_country, sim_year desc);

-- RLS: live world events are public; fork events visible to fork owner
alter table world_events enable row level security;

create policy if not exists "public read live world events" on world_events
  for select using (world_id = 'live');

create policy if not exists "players read own fork events" on world_events
  for select using (
    world_id in (select id from worlds where player_id = auth.uid())
  );
