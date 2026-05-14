-- Migration 002: Add player_country_code to worlds, add fork agent_decisions RLS
-- Run this in the Supabase SQL editor if you already have the schema from migration 001.

-- Add the column if it doesn't already exist
alter table worlds
  add column if not exists player_country_code text;

-- Players can read agent_decisions in their own forks
create policy if not exists "players read own fork decisions" on agent_decisions
  for select using (
    world_id in (select id from worlds where player_id = auth.uid())
  );

-- Players can also insert/update agent_decisions in their own forks
-- (needed for the simulate-year worker endpoint which uses service role, but
--  good to have for direct client writes too)
create policy if not exists "players write own fork decisions" on agent_decisions
  for insert with check (
    world_id in (select id from worlds where player_id = auth.uid())
  );
