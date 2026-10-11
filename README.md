# RealityShift

**A persistent multi-agent world simulation that publishes broadcasts from worlds that don't exist.**

Every month the simulation is graded against reality: it self-corrects against real news and
publishes a public record of where its alternate history drifted — "here's what the AI
predicted, here's what actually happened". One AI agent runs each seeded country, grounded in
real World Bank indicators and, for 20 countries, a curated 20-year history.

Take over any country and the world **forks**. From that moment no new real-world data enters
your universe. Each simulated year, the countries most connected to you (allies, rivals,
event partners, then the largest economies — up to 12) react, and the game tells you
exactly which ones did. The fork is a true parallel
universe, and the media layer turns it into news segments and newspaper front pages that
report events which never happened.

> **Status:** the simulation (Milestones 1–10) is complete. Deployment and the generative
> media layer are in active development — see [`PLAN.md`](PLAN.md) for the current milestone
> board and [`PHASE0_AUDIT.md`](PHASE0_AUDIT.md) for the media-layer architecture audit.

---

## Why this exists

Institutions run policy wargames constantly. They are slow, expensive, and limited by how many
experts you can put in a room for a week. RealityShift runs the wargame continuously, forks it
on demand, and publishes each branch as consumable media with verifiable provenance.

The design property that makes it more than a toy: **once a world forks, no real-world data
enters it again.** That claim is invisible in plain text, so every generated asset carries it
inside a cryptographically hash-bound manifest — `simulation.real_world_data_cutoff`, verifiable
with a single command against the downloaded file.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 SIMULATION LAYER (always on)                 │
│                                                              │
│   Country Agent × N  ──→  Supabase (world state, history)   │
│        ↑ monthly                   ↓                         │
│    News API / web            Divergence Reports              │
│                                    ↓                         │
│                          Public Dashboard (read-only)        │
└─────────────────────────────────────────────────────────────┘
                    ↓  fork on player join
┌─────────────────────────────────────────────────────────────┐
│                    GAME LAYER (per fork)                     │
│                                                              │
│   Human Player ──→ Policy changes ──→ Agent reactions       │
│                    (no new real-world data injected)         │
└─────────────────────────────────────────────────────────────┘
                    ↓  divergence briefs
┌─────────────────────────────────────────────────────────────┐
│              MEDIA LAYER (batch, Python)                     │
│                                                              │
│   DivergenceBrief ──→ Genblaze Pipeline ──→ Backblaze B2    │
│                       (script → TTS → b-roll →              │
│                        video → ffmpeg mux)                   │
│                       manifests hash-bound with fork lineage │
└─────────────────────────────────────────────────────────────┘
```

The media layer is a **separate Python process that only reads Supabase.** It cannot reach
simulation internals — the sim is TypeScript on Cloudflare Workers and Genblaze is a Python
SDK, so the isolation is enforced by the architecture rather than by convention.

### Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React 19 + TypeScript, Zustand |
| 3D Globe | CesiumJS |
| Agent backend | Cloudflare Workers |
| Database | Supabase (Postgres + pgvector) — simulation transactional state |
| Auth | Supabase Auth |
| Media pipeline | Genblaze (Python) — provenance manifests, B2 storage |
| Media generation | Local SDXL-Turbo (diffusers, on-device) — no cloud provider |
| Media storage | Backblaze B2 — assets, manifests, presigned/private serving |
| Simulation LLM | Groq (Llama 3.3 70B), OpenAI-compatible |
| Scheduler | GitHub Actions (monthly cron) |
| Country data | World Bank API + REST Countries |
| News | NewsAPI.org |

---

## Local setup

### Prerequisites

- **Node.js 20+** and npm
- **Python 3.11+** — media layer only
- **ffmpeg** on PATH — media layer only, used for audio/video compositing
  (`brew install ffmpeg` on macOS)

### 1. Simulation (frontend + worker)

```bash
git clone https://github.com/ikathuria/RealityShift.git
cd RealityShift
npm install
```

Create a [Supabase](https://supabase.com) project and run [`supabase/schema.sql`](supabase/schema.sql)
in its SQL editor. This creates `worlds`, `country_states`, `agent_decisions`, `divergences`,
`world_events`, `region_states`, `game_sessions` and `api_calls`, the `latest_country_states`
view, the `publish_world()` RPC, and row-level security policies. It is safe to re-run.

**Upgrading an existing database?** Apply [`supabase/migrations/`](supabase/migrations) in
order instead (002 → 006). Every migration is idempotent.

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

| Variable | Where to get it |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Supabase project settings |
| `VITE_CESIUM_ION_TOKEN` | [ion.cesium.com](https://ion.cesium.com) (free) |
| `VITE_AI_PROXY_URL` | your deployed Worker URL |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) (free, no card) |
| `SUPABASE_SERVICE_KEY` | Supabase — **worker only, never the frontend** |
| `NEWS_API_KEY` | [newsapi.org/register](https://newsapi.org/register) (free tier) |

**The Worker does not read `.env`.** `wrangler dev` loads its secrets from
`workers/.dev.vars`, so the worker-side variables need to be copied there as well
or every protected endpoint returns 401 and every database call fails:

```bash
cat > workers/.dev.vars <<'EOF'
GROQ_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
NEWS_API_KEY=
WORKER_SECRET=
EOF
```

`WORKER_SECRET` is any long random string — it just has to match between
`.env` and `workers/.dev.vars`. Generate one with:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

`.dev.vars` is gitignored. Never commit it.

Start the frontend (http://localhost:5173):

```bash
npm run dev
```

Start the Worker in a second terminal (http://localhost:8787):

```bash
npm --prefix workers install && npm --prefix workers run dev
```

Seed the live world with real World Bank data — one time, takes about 5 seconds
and loads ~210 countries:

```bash
curl -X POST http://localhost:8787/api/seed -H "x-worker-secret: $(grep '^WORKER_SECRET=' .env | cut -d= -f2-)"
```

Advance one country by a simulated year (this is the agent loop):

```bash
curl -X POST http://localhost:8787/api/agents/run \
  -H "x-worker-secret: $(grep '^WORKER_SECRET=' .env | cut -d= -f2-)" \
  -H 'Content-Type: application/json' \
  -d '{"world_id":"live","country_code":"IND"}'
```

Note the globe takes 15–25 seconds on first load — it fetches country geometry
from a CDN. Without `VITE_CESIUM_ION_TOKEN` there is no base imagery, so the
globe renders as dark country polygons over the starfield rather than as Earth.

### Troubleshooting

**`wrangler dev` dies with `table _cf_ALARM has 3 columns but 2 values were supplied`**

Miniflare's local state was written by a newer wrangler than the one now
running, and the schemas are incompatible. Delete the state and restart:

```bash
rm -rf workers/.wrangler
```

Nothing is lost — no KV, Durable Object, D1, or R2 bindings are declared, so
that directory holds only local cache. All real state lives in Supabase.

The usual cause is running `npx wrangler` from the repo root, where npx cannot
see `workers/node_modules` and downloads a different version instead. Always
start the Worker via `npm --prefix workers run dev` so the pinned version in
`workers/package.json` is the one that runs.

### 2. Media layer

Generation runs **locally** — a diffusion model on-device, no cloud provider, no
API key, no per-image cost. Only Backblaze B2 (storage) needs an account.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e 'media/[local,cli]'   # [local] = torch + diffusers; [cli] = genblaze-cli
```

`[local]` pulls ~2 GB of wheels; the first generation downloads the SDXL-Turbo
model (~7 GB) once. Exercise the whole chain without generating (no torch,
no B2):

```bash
rs-media front-page --nation IND --year 2027 --dry-run
```

Verify provenance on any generated asset:

```bash
genblaze verify frontpage.png      # re-derives the manifest hash; shows the simulation.* fields
genblaze extract frontpage.png
```

See [`B2_AND_GENBLAZE.md`](B2_AND_GENBLAZE.md) and [`PROVIDERS.md`](PROVIDERS.md)
for how storage and generation fit together.

---

## Going live (credentials + deploy)

Everything is built and verified end to end against a real bucket. One account
(Backblaze B2) for media, then the deploy.

### A. Backblaze B2 → populate the front-page wall

1. **Create a bucket** (private is fine — see the note on expiry below) and an
   application key scoped to it. Put in `media/.env` (or the root `.env`):
   `B2_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET`, `B2_REGION` (e.g. `us-east-005`),
   plus `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` so the adapter can read.
2. **Allow the browser to read the bucket** (once per bucket):
   ```bash
   rs-media setup-cors
   ```
3. **Generate a batch** — one loaded model, all the front pages, a broadcast,
   index published:
   ```bash
   rs-media batch --nations IND,USA --from-year 2026 --to-year 2027 --broadcast IND
   ```
   This generates each page locally, a ~45-75s divergence broadcast (video) for
   each `--broadcast` nation, uploads to B2, presigns the URLs (private bucket),
   and writes the media index. It prints the index URL. (`rs-media broadcast
   --nation IND --year 2027` makes just a broadcast.)
   It closes the M12/M13 checkpoint: images in B2 whose manifest hash carries
   `simulation.fork_id` and `simulation.real_world_data_cutoff`.
4. **Point the frontend at the index.** The frontend asks the Worker first —
   `GET /api/media/index/:worldId` — and falls back to B2 directly:
   - **Private bucket:** give the Worker read access (`B2_KEY_ID`, `B2_APP_KEY`,
     `B2_BUCKET`, `B2_REGION` as Worker secrets; a read-only key is enough). It
     re-presigns the index and every asset URL on each request, so nothing
     expires.
   - **Public bucket:** set `MEDIA_PUBLIC_BASE` on the Worker and/or
     `VITE_B2_PUBLIC_BASE` in the root `.env`, and add `--public` to the batch.

> Re-running a batch **merges** into the world's index (same kind + nation +
> date replaces; everything else is kept). `VITE_MEDIA_INDEX_URL` (a baked-in
> presigned URL) still works as a last-resort fallback but expires after B2's
> 7-day ceiling.

> Only **IND** and **USA** have simulated data past 2026 in the seeded world
> (they were advanced during testing). Wider `--nations` / year ranges skip and
> report missing sim-years without failing the batch.

### B. Deploy the Worker (Cloudflare) — optional

```bash
npm --prefix workers exec wrangler login      # interactive, one time
npm --prefix workers run deploy               # wrangler deploy
# production secrets (values, not the local .dev.vars):
for k in GROQ_API_KEY SUPABASE_URL SUPABASE_SERVICE_KEY NEWS_API_KEY WORKER_SECRET; do
  npm --prefix workers exec wrangler secret put "$k"
done
# optional — private-bucket media serving (see workers/wrangler.toml)
for k in B2_KEY_ID B2_APP_KEY B2_BUCKET B2_REGION; do
  npm --prefix workers exec wrangler secret put "$k"
done
```

The Worker only answers browser requests from `SITE_URL`'s origin,
`https://ishani.kathuria.net` and `http://localhost:5173` (CORS). Set `SITE_URL` in
`wrangler.toml` to your frontend's URL.

Set `VITE_AI_PROXY_URL` in the root `.env` to the deployed `workers.dev` URL.

### C. Deploy the frontend (GitHub Pages)

1. Repo **Settings → Pages → Source: GitHub Actions** (enables the workflow at
   `.github/workflows/deploy-pages.yml`, which already builds green).
2. Repo **Settings → Secrets and variables → Actions**, add: `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `VITE_AI_PROXY_URL`, optionally `VITE_B2_PUBLIC_BASE`
   (public bucket) and `VITE_CESIUM_ION_TOKEN`.
3. For the monthly-sync workflow, also add `WORKER_URL` and `WORKER_SECRET`.
4. Push to `main` (or re-run the workflow) → site publishes at
   `https://<user>.github.io/RealityShift/`.

> **If you skip the Worker deploy:** the site still works read-only (globe,
> dashboard, front-page wall all read Supabase/B2 directly). Only fork
> creation and "Simulate Year" need the Worker, since those make server-side
> LLM calls.

---

## How the simulation runs

There is no automatic clock. One agent step is one simulated **year**. Two triggers move
the live world:

- **`POST /api/agents/run`** — a country's agent reads its state, finds its closest
  historical parallels, decides, and writes the next year to `agent_decisions` +
  `country_states`. On the live world it never runs past the current calendar year (it
  returns `skipped`), so the live sim year always equals the real year.
- **Monthly sync** (GitHub Actions, 1st of each month) — each country fetches real news,
  compares simulated state to reality, self-corrects **in place** on the current year, and
  publishes a divergence report (one per country per month; re-runs are idempotent).

In a fork, **Simulate Year** runs the reacting countries in batches of 3 per request
(Cloudflare's free-plan subrequest limit) and then advances your country. Players are
rate-limited to 5 new forks per hour and 20 simulated years per day.

Forks are excluded from the monthly sync by a hard `is_live` check. That is the enforcement
point for the no-new-data property.

### Worker API

```
GET  /api/health              GET  /api/countries          POST /api/seed
POST /api/agents/run          POST /api/sync/country       POST /api/fork/create
POST /api/fork/simulate-year  GET  /api/world/feed.xml       GET  /api/media/index/:worldId
GET  /share/:worldId          GET  /api/datacommons/*
```

---

## Synthetic media policy

Every generated artifact is marked as synthetic twice: a **visible** watermark or spoken
disclaimer, and a **machine-readable** embedded Genblaze manifest.

- **No photorealistic synthetic media of real, identifiable people.** Anchors and
  spokespeople are fictional and the aesthetic is deliberately stylized. Real countries,
  institutions, and policies are depicted; real faces and voices are not.
- **No graphic violence, atrocity, or persecution imagery**, even where a simulation branch
  implies it — such branches are summarized in neutral text instead.
- **Genblaze manifests are not C2PA.** They provide *integrity* — proof the manifest was not
  altered — not *authentication* of who produced it. We do not claim otherwise.

Agents and players may pursue any political direction. The simulation shows consequences,
not judgments; the historical parallel card is informational and never a blocker.

---

## Contributing

The highest-value contributions need no code. Both
[`workers/src/data/history/periods.json`](workers/src/data/history/periods.json) (historical
policy periods) and
[`country_histories.json`](workers/src/data/history/country_histories.json) (per-country
20-year timelines) are plain JSON, and better data directly improves agent reasoning.

`CONTRIBUTING.md` is pending — see [`PLAN.md`](PLAN.md) Milestone 11.

---

## Documentation

| Document | Contents |
|---|---|
| [`PLAN.md`](PLAN.md) | Milestone board, architecture decisions, day allocation |
| [`PHASE0_AUDIT.md`](PHASE0_AUDIT.md) | Media-layer audit: interface boundary, Genblaze findings, cost model |
| [`GENBLAZE_FEEDBACK.md`](GENBLAZE_FEEDBACK.md) | SDK friction log from a real integration |
