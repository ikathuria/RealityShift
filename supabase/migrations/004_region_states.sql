-- Migration 004: Region states for sub-national drill-down (Milestone 10)

CREATE TABLE IF NOT EXISTS region_states (
  id            bigserial PRIMARY KEY,
  world_id      text        NOT NULL DEFAULT 'live',
  country_code  text        NOT NULL,
  region_code   text        NOT NULL,
  region_name   text        NOT NULL,
  year          integer     NOT NULL DEFAULT 2024,
  population    bigint,
  policies      jsonb       NOT NULL DEFAULT '{}',
  last_updated  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world_id, region_code, year)
);

-- Policies JSONB schema (defaults):
-- {
--   "housing":    5,   -- 0–10: rent control / zoning strictness
--   "transport":  5,   -- 0–10: transit / infrastructure funding
--   "local_tax":  20   -- 5–40: municipal tax rate %
-- }

CREATE INDEX IF NOT EXISTS idx_region_states_world_country
  ON region_states (world_id, country_code);

CREATE INDEX IF NOT EXISTS idx_region_states_world_region
  ON region_states (world_id, region_code);

-- RLS: public read on live world; players read/write their own fork's regions.
-- Policy names match schema.sql exactly so running both never creates duplicates.
-- (Earlier revisions of this file used capitalised names; drop those too.)
ALTER TABLE region_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read live regions"        ON region_states;
DROP POLICY IF EXISTS "Players read own fork regions"   ON region_states;
DROP POLICY IF EXISTS "Players upsert own fork regions" ON region_states;
DROP POLICY IF EXISTS "Players update own fork regions" ON region_states;

DROP POLICY IF EXISTS "public read live regions" ON region_states;
CREATE POLICY "public read live regions"
  ON region_states FOR SELECT
  USING (world_id = 'live');

DROP POLICY IF EXISTS "players read own fork regions" ON region_states;
CREATE POLICY "players read own fork regions"
  ON region_states FOR SELECT
  USING (world_id IN (SELECT id FROM worlds WHERE player_id = auth.uid()));

DROP POLICY IF EXISTS "players insert own fork regions" ON region_states;
CREATE POLICY "players insert own fork regions"
  ON region_states FOR INSERT
  WITH CHECK (world_id IN (SELECT id FROM worlds WHERE player_id = auth.uid()));

DROP POLICY IF EXISTS "players update own fork regions" ON region_states;
CREATE POLICY "players update own fork regions"
  ON region_states FOR UPDATE
  USING (world_id IN (SELECT id FROM worlds WHERE player_id = auth.uid()));

-- Service role (Workers) has full access via service key (bypasses RLS)
