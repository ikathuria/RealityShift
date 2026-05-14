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

-- RLS: public read on live world
ALTER TABLE region_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read live regions"
  ON region_states FOR SELECT
  USING (world_id = 'live');

-- Players can read their own fork's region states
CREATE POLICY "Players read own fork regions"
  ON region_states FOR SELECT
  USING (
    world_id IN (
      SELECT id FROM worlds
      WHERE player_id = auth.uid()
    )
  );

-- Players can upsert region policies in their own fork
CREATE POLICY "Players upsert own fork regions"
  ON region_states FOR INSERT
  WITH CHECK (
    world_id IN (
      SELECT id FROM worlds WHERE player_id = auth.uid()
    )
  );

CREATE POLICY "Players update own fork regions"
  ON region_states FOR UPDATE
  USING (
    world_id IN (
      SELECT id FROM worlds WHERE player_id = auth.uid()
    )
  );

-- Service role (Workers) has full access via service key (bypasses RLS)
