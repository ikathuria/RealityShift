-- Migration 006: fixes from the code review
--
--   1. latest_country_states view — one row per (world, country), so readers no
--      longer pull every year and hit PostgREST's 1000-row cap.
--   2. Owners can no longer UPDATE worlds directly (they could rewrite any
--      column, e.g. pin published_at in the future). Publishing goes through
--      the publish_world() RPC, which sets published_at server-side.
--   3. worlds.instagram_posted_at — the daily Instagram cron posts each world once.
--   4. api_calls — service-role-only log used by the Worker for rate limiting.
--   5. divergences unique key — the monthly sync upserts instead of duplicating.
--
-- Safe to re-run.

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
