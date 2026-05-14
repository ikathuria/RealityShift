# RealityShift — Living World Policy Simulator

> A persistent multi-agent world simulation where AI agents run every country based on real history. Players can fork the simulation, take over any country, and watch the rest of the world react — creating a true parallel universe with no new real-world data injected.

---

## Concept

**Two modes, one shared world state:**

**Simulation mode (always on):** One AI agent per country runs continuously. Each agent is trained on 10–20 years of their country's real history and makes decisions autonomously. Once a month, agents receive the latest real-world news, compare their simulated state to reality, self-correct where needed, and publish divergence reports publicly — a living record of alternate history.

**Game mode (player-triggered):** A player picks any country, takes over from its agent, and the world forks. From that moment, no new real-world data enters the fork. The player makes decisions manually; every other country's agent reacts to those decisions in real time. The fork is a true parallel universe.

---

## Viability Summary

| | |
|---|---|
| **Market** | Nothing like this exists. Democracy 4, Power & Revolution, NationStates — all are either single-player sandboxes with no real persistence, no AI agents, or no multi-country simulation. The "living world + fork to play" concept is entirely novel. |
| **Feasibility** | Very hard — persistent multi-agent coordination, monthly news injection, divergence tracking, and a real-time game layer are each substantial systems. Correct phasing (simulation first, game layer second) makes it tractable. |
| **Free to build** | Mostly — Supabase free tier (Postgres + pgvector), Cloudflare Workers free tier (cron + agent proxy), World Bank API (free), NewsAPI (free tier: 100 requests/day). Claude API is the main cost (~$20–50/month for background agents). |
| **Monetization** | Open source — community-built. No revenue goal. |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SIMULATION LAYER (always on)              │
│                                                             │
│  Country Agent × N  ──→  Supabase (world state, history)   │
│       ↑ monthly                  ↓                          │
│   News API / web             Divergence Reports             │
│                                  ↓                          │
│                          Public Dashboard (read-only)        │
└─────────────────────────────────────────────────────────────┘
                              ↓  fork on player join
┌─────────────────────────────────────────────────────────────┐
│                      GAME LAYER (per fork)                   │
│                                                             │
│  Human Player ──→ Policy changes ──→ Agent reactions        │
│                         (no new real-world data injected)   │
│                         (fork lives in Supabase as          │
│                          a separate world_id branch)        │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Vite + React + TypeScript | Browser game, fast HMR, CesiumJS compatible |
| 3D Globe | CesiumJS (Apache 2.0) | WebGL globe, GeoJSON country support, real geo tiles |
| State (client) | Zustand | Lightweight real-time game state |
| Agent Backend | Cloudflare Workers | Free tier, proxies Claude API; individual invocations stay within the 10ms CPU / 30s wall-clock limits |
| Monthly Sync Scheduler | GitHub Actions (scheduled workflow) | Completely free, generous execution time — orchestrates the monthly sync by calling the Worker once per country in sequence |
| Database | Supabase (Postgres + pgvector) | Persistent world state, agent memory, divergence logs, fork branching |
| Auth | Supabase Auth | Players need accounts to save forks and game sessions |
| Country Data | World Bank API + REST Countries API | Free, 200+ countries, 1400+ indicators — seeds initial agent state |
| News (monthly sync) | NewsAPI.org free tier | Real-world news injection for monthly agent self-correction |
| Historical Knowledge | Curated `periods.json` + pgvector embeddings | RAG source for historical grounding in agent decisions |
| AI Model | Groq — Llama 4 Maverick | Free forever, no credit card; 1k req/day free tier; OpenAI-compatible API so swapping to Claude is a one-line config change if needed |
| Hosting | GitHub Pages (frontend) + Cloudflare Workers (agents + API) | Both free |
| Public Dashboard | Same frontend, read-only route `/world` | Shows live simulation state and divergence reports |

---

## Data Model (Supabase)

```sql
-- The canonical world state, branched per fork
worlds          { id, fork_of, created_at, is_live, player_id, forked_at_year }

-- Each country's state within a world
country_states  { world_id, country_code, year, indicators{}, policies{},
                  agent_memory_summary, last_updated }

-- Agent decisions log (what each agent decided and why)
agent_decisions { world_id, country_code, year, decision{}, reasoning,
                  historical_parallel, created_at }

-- Monthly divergence reports (live world only)
divergences     { country_code, sim_year, real_date, sim_state{},
                  real_state{}, delta{}, narrative, published_at }

-- Player game sessions
game_sessions   { id, player_id, world_id, country_code, started_at,
                  ended_at, summary }
```

---

## Environment Variables

```
# Cloudflare Worker (never in frontend)
GROQ_API_KEY=               # Groq API — console.groq.com (free, no credit card)
# Optional upgrade: set this to swap all LLM calls to Claude instead
ANTHROPIC_API_KEY=          # Claude API — console.anthropic.com
SUPABASE_SERVICE_KEY=       # Supabase service role key (full DB access)
NEWS_API_KEY=               # NewsAPI.org — newsapi.org/register (free)

# Frontend (public)
VITE_CESIUM_ION_TOKEN=      # ion.cesium.com free account
VITE_SUPABASE_URL=          # your Supabase project URL
VITE_SUPABASE_ANON_KEY=     # Supabase anon key (safe to expose)
VITE_AI_PROXY_URL=          # deployed Cloudflare Worker URL
```

---

## Milestones

### Milestone 1: Scaffold
**Goal:** Dev server runs, Supabase connected, CesiumJS globe renders, all dependencies in place.

Tasks:
- [x] Initialize Vite + React + TypeScript: `npm create vite@latest realityshift -- --template react-ts` — Done when: `npm run dev` opens without errors
- [x] Install dependencies: `cesium vite-plugin-cesium zustand @supabase/supabase-js` — Done when: all in package.json, no import errors
- [x] Create Supabase project and run the schema from `supabase/schema.sql` (worlds, country_states, agent_decisions, divergences, game_sessions tables) — Done when: tables visible in Supabase dashboard
- [x] Set up Cloudflare Worker project in `workers/` with Wrangler — Done when: `wrangler dev` runs a hello-world endpoint
- [x] Render a bare CesiumJS globe in `src/components/Globe.tsx` — Done when: 3D Earth spins in browser
- [x] Create `.env.example` with all vars listed above — Done when: committed
- [x] Create `workers/src/ai/llm.ts` — a thin wrapper around the Groq API (OpenAI-compatible) that exports a single `chat(messages, model?)` function; model defaults to `llama-4-maverick-17b-128e-instruct` — Done when: a test call returns a text response and swapping to Claude requires only changing the base URL and API key

---

### Milestone 2: World State + Country Data
**Goal:** The live world (`world_id = 'live'`) is seeded with real data for all countries. Clicking a country shows its current simulated state.

Tasks:
- [ ] Write `workers/src/seed.ts` — fetches World Bank indicators for all 195 countries and inserts into `country_states` for `world_id = 'live'`, `year = current` — Done when: running the seed script populates Supabase with real GDP, population, tax rate, military spend, education spend, healthcare, unemployment for all countries
- [ ] Create `src/data/worldbank.ts` — typed fetch functions for all 7 indicators — Done when: each returns typed data for any country code
- [ ] Load GeoJSON country boundaries in Globe as CesiumJS entities — Done when: country outlines visible
- [ ] Country click → fetch `country_states` for that country from Supabase → show in `src/components/CountryPanel.tsx` sidebar — Done when: clicking India shows real seeded data
- [ ] Choropleth: color globe by GDP per capita from live world state — Done when: visible color variation across all countries

---

### Milestone 3: Country AI Agents
**Goal:** Each country has an AI agent that can make autonomous decisions for its country. Agents are grounded in the country's last 10–20 years of history.

Tasks:
- [ ] Create `src/data/history/country_histories.json` — for the 20 most common starting countries, a structured summary of the last 20 years: major policy changes, economic events, political shifts, international relations, with year tags. Sourced from Wikipedia and public records — Done when: each entry has at least 15 dated events covering 2005–2025
- [ ] Write `workers/src/agents/countryAgent.ts` — the core agent function: given `(world_id, country_code)`, reads the country's current state from Supabase, loads its historical summary, finds the 3 closest historical parallels (from `periods.json`), builds a Claude prompt, and returns a structured decision: `{ policies_adjusted{}, reasoning, historical_parallel, projected_indicators{} }` — Done when: calling the agent for India returns a plausible autonomous decision
- [ ] Agent prompt design in `workers/src/agents/prompt.ts`: the agent plays the role of the current government (matching real political leaning of the country), grounds decisions in documented history, reasons about neighboring countries' states, and explicitly flags if its decision resembles a historical pattern — Done when: India's agent makes decisions consistent with a center-left coalition government
- [ ] Write `workers/src/agents/runAgents.ts` — iterates over all countries in a world, calls `countryAgent` for each, writes decisions to `agent_decisions` and updates `country_states` — Done when: running manually advances the world by one simulated month for all countries
- [ ] Expose a Worker endpoint `POST /api/agents/run` (protected by a secret header) that triggers `runAgents` for the live world — Done when: calling the endpoint updates Supabase

---

### Milestone 4: Historical Grounding (RAG)
**Goal:** Agent decisions are grounded in real historical precedents. When a country's trajectory resembles a historical period, the agent explicitly reasons from that precedent while accounting for how today's world differs.

Tasks:
- [ ] Create `src/data/history/periods.json` — 50+ historical policy periods with: `{ id, name, country, yearRange, tags[], policyProfile{}, outcomes{}, internationalReaction, summary }`. Cover: Weimar hyperinflation, Nazi Germany, FDR New Deal, Thatcher privatizations, Mao's Great Leap Forward, Pinochet shock therapy, Nordic social democracy, Soviet collapse, Asian financial crisis, etc. — Done when: at least 30 well-structured entries
- [ ] Write `workers/src/history/embed.ts` — computes TF-IDF vectors over `tags` + `policyProfile` keys for each period, exports as a static lookup table — Done when: returns a numeric vector for any period ID
- [ ] Write `workers/src/history/match.ts` — given a country's current policy state, returns the top 3 closest historical periods by cosine similarity with scores — Done when: a country with rising `military_spend`, `nationalist_rhetoric`, `press_restrictions` tags surfaces 1930s Germany as top match
- [ ] Inject matched context into agent prompts: "Closest historical parallel: [period]. What happened then: [outcomes]. International reaction then: [internationalReaction]. Today's world is different — reason through: current nuclear deterrence, international institutions (UN/WTO/EU/ICC), economic interdependence, social media, and this country's current diplomatic relations. The outcome may be similar, harsher, milder, or entirely different." — Done when: authoritarian policy shifts produce historically-informed but contextually-adjusted predictions
- [ ] Store matched historical parallel in `agent_decisions.historical_parallel` — Done when: every decision row in Supabase includes the top match and similarity score

---

### Milestone 5: Monthly Sync + Divergence Tracking
**Goal:** Once a month, each country agent fetches real news, compares the simulated state to reality, self-corrects, and publishes a divergence report.

Tasks:
- [ ] Add a GitHub Actions workflow at `.github/workflows/monthly-sync.yml` with `schedule: cron('0 0 1 * *')` (runs 1st of each month) — the Action loops through all country codes and calls `POST /api/sync/country` on the Worker once per country, sequentially — Done when: workflow file exists and a manual trigger (`workflow_dispatch`) successfully processes one test country
- [ ] Write `workers/src/sync/fetchNews.ts` — for each country, calls NewsAPI.org with `q=[country name] economy policy government` and returns the top 5 most relevant headlines + summaries — Done when: returns real headlines for India, USA, Germany
- [ ] Write `workers/src/sync/compareState.ts` — builds a Claude prompt comparing `country_states.indicators` to a summary of real news, returns: `{ diverged: bool, delta{}, explanation, self_correction{} }` — Done when: if the simulation has India's GDP growing at 8% but news reports a recession, Claude flags the divergence with an explanation
- [ ] Write `workers/src/sync/publishDivergence.ts` — if `diverged = true`, inserts a row into `divergences` with the full delta and narrative; then applies `self_correction` to `country_states` to bring the live world back toward reality — Done when: divergences table gains a row after a mismatch is detected
- [ ] Write `workers/src/sync/syncCountry.ts` — handles a single country: fetchNews → compareState → publishDivergence, exposed as `POST /api/sync/country` with `{ country_code }` body — Done when: calling the endpoint for `"IND"` fetches real India news, compares to simulated state, and writes to Supabase

---

### Milestone 6: Public Divergence Dashboard
**Goal:** A read-only public page at `/world` shows the live simulation state and all divergence reports — the "alternate history" tracker.

Tasks:
- [ ] Build `src/pages/WorldDashboard.tsx` — a public page at `/world` that fetches and displays: current simulated year, world GDP, top 5 divergences by magnitude, and a timeline of recent divergence events — Done when: page loads without auth and shows live Supabase data
- [ ] Build `src/components/DivergenceCard.tsx` — shows per-country divergence: simulated state vs. real state, the delta, and Claude's narrative explanation — Done when: clicking a country in the dashboard shows its divergence history
- [ ] Add globe view to the dashboard: countries colored by divergence magnitude (green = tracking reality closely, red = highly diverged) — Done when: the globe shows visible variation based on `divergences` table data
- [ ] Add divergence RSS feed at `/world/feed.xml` — lists the 20 most recent divergence reports as RSS items so people can subscribe — Done when: feed validates and loads in an RSS reader
- [ ] Add "Agent Decision Log" per country — a public timeline of every autonomous decision an agent has made, with its reasoning — Done when: clicking India shows a chronological log of agent decisions going back to simulation start

---

### Milestone 7: Player Takeover + World Forking
**Goal:** A logged-in player can take over any country from its agent and fork the world. The fork is a true parallel universe — no new real-world data enters it. Other country agents react to the player's decisions.

Tasks:
- [ ] Add Supabase Auth: email/password signup and login — Done when: player can create account and session persists across page refreshes
- [ ] "Take Over" button on any CountryPanel — creates a new row in `worlds` (`fork_of = 'live'`, `forked_at_year = current`, `player_id = auth.uid`) and copies all `country_states` from the live world into the new `world_id` — Done when: clicking Take Over for India creates a fork world in Supabase with all 195 countries' states copied
- [ ] Player policy editor: when playing a fork, the player can adjust policies, pass laws, and change budgets — same UI as before but writes to the forked `world_id` not the live world — Done when: player changes India's military budget in their fork without affecting the live world
- [ ] "Simulate Year" button: when player confirms changes, runs `countryAgent` for all other countries in the fork (reacting to India's new state), updates their `country_states`, advances year — Done when: India cuts taxes → other country agents receive the updated India state and respond (trade partners adjust, adversaries react, etc.)
- [ ] No news injection in forks: `runMonthlySync` only runs on `world_id = 'live'`; forks never receive real-world data — Done when: confirmed by code review that sync functions check `is_live` before running
- [ ] Fork dashboard: player can see their fork's state vs. the live world on the same globe — a toggle between "Your Universe" and "Real World Simulation" — Done when: toggle switches globe data source between fork and live world states

---

### Milestone 8: Multi-Agent Coordination
**Goal:** Country agents are aware of each other and react to neighboring decisions. Diplomatic events, trade responses, and military posturing emerge from agent interactions.

Tasks:
- [ ] Extend `countryAgent` prompt context: before deciding, each agent receives a summary of the last 3 decisions made by its top 5 trade partners and neighbors — Done when: India's agent prompt includes summaries of China, Pakistan, USA, and EU recent decisions
- [ ] Add inter-agent event system: agents can emit events (`{ type: 'sanction' | 'trade_deal' | 'military_posture' | 'diplomatic_protest', from, to, details }`) that are stored in `agent_decisions` and picked up by the target country's agent on its next run — Done when: if India imposes tariffs on China, China's next decision includes the tariff event as context
- [ ] Add a global "World Events" feed in the UI — a scrolling ticker of recent inter-agent events (sanctions, alliances, trade deals, conflicts) — Done when: the globe UI shows a live feed of AI-generated world events
- [ ] Conflict detection: if two agents' military posture scores exceed a threshold against each other, Claude generates a conflict scenario with resolution options — Done when: two countries with high mutual military hostility produce a diplomatic crisis event
- [ ] Alliance tracking: agents can form and break alliances stored in `country_states.relations{}` — Done when: an agent that forms an alliance routes trade through that ally and cites it in subsequent decisions

---

### Milestone 9: Globe Visualization
**Goal:** The globe is the primary game surface — it reacts to simulation events, policy changes, and divergences in real time.

Tasks:
- [ ] Choropleth overlays: GDP, Happiness Index, Military Spend, Divergence from Reality — Done when: each overlay re-colors the globe within 500ms
- [ ] Animated events: when an agent emits a diplomatic/military/trade event, draw an animated arc between the two countries — Done when: trade deals show a brief gold arc, sanctions show a red arc
- [ ] Country pulse on player action: when player confirms a policy change, their country glows briefly — Done when: visible animation triggers within 200ms of confirmation
- [ ] Camera fly-to: selecting a country smoothly flies the globe to center it — Done when: transitions complete in ~1.5 seconds
- [ ] Country hover tooltip: flag, name, current simulated GDP, approval rating, top historical parallel — Done when: 300ms hover shows tooltip

---

### Milestone 10: Regional Drill-Down
**Goal:** Players can zoom into a country and make sub-national policy decisions at the state/province level.

Tasks:
- [ ] Load state/province GeoJSON (Natural Earth admin-1) for India, USA, UK, Germany, Brazil, China, France, Australia, Canada, Japan — Done when: zooming into India shows state outlines
- [ ] Switch from country to state boundaries below camera altitude 2000km — Done when: smooth zoom transition
- [ ] Region click opens `src/components/RegionPanel.tsx` with region-level stats (World Bank sub-national or AI-estimated) — Done when: clicking Maharashtra shows population and basic stats
- [ ] 3 local policy types: Housing (rent control/zoning), Transport (transit funding), Local Tax (municipal rates) — Done when: sliders exist and write to region-level state in Supabase
- [ ] Include active regional changes in agent simulation prompts — Done when: a Mumbai housing policy affects Claude's national narrative

---

### Milestone 11: Deploy + Open Source
**Goal:** Live at GitHub Pages, all Workers deployed, repo ready for community contributions.

Tasks:
- [ ] Deploy Cloudflare Worker with all production secrets: `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_KEY`, `NEWS_API_KEY` — Done when: worker endpoints respond correctly in production
- [ ] Confirm the monthly sync GitHub Actions workflow runs correctly in production — add `WORKER_SECRET` and `WORKER_URL` as GitHub Actions secrets — Done when: manually triggering the workflow processes all countries without errors
- [ ] GitHub Actions workflow to auto-deploy frontend to GitHub Pages on push to `main` — Done when: push deploys automatically
- [ ] Set `base` in `vite.config.ts` to GitHub Pages repo path — Done when: assets load correctly at Pages URL
- [ ] Write `README.md`: what it is, architecture diagram, local setup under 10 minutes, all API key setup steps — Done when: new contributor can run locally without asking questions
- [ ] Write `CONTRIBUTING.md`: how to add a historical period to `periods.json`, how to add a country history to `country_histories.json`, how to improve agent prompts, code style — Done when: clearly structured with examples

---

## Claude Code Commands

**Start fresh (Milestone 1):**
```
claude "Read PLAN.md and complete Milestone 1. Mark tasks done as you go. Stop after Milestone 1 and commit."
```

**Resume from any point:**
```
claude "Read PLAN.md, find the first incomplete task, and continue. Mark tasks done as you go. Commit when a milestone is complete."
```

**Test current state:**
```
claude "Read PLAN.md. Without building anything new, test everything marked done. Report what works and what's broken."
```

---

## Notes & Decisions

- **Simulation-first, game-second**: Build and validate the always-on simulation (M1–M6) before the game layer (M7+). If the agents aren't making coherent decisions, the game won't work. Milestone 5 (monthly sync + divergence) is the validation point — if divergences look realistic, the agents are working.

- **World forking via Supabase rows**: Forking the world is just copying `country_states` to a new `world_id`. This is cheap (195 rows) and clean. The fork never touches the live world again. Players can have multiple forks.

- **No new data in forks**: Once a player takes over, their universe is frozen from real-world input. This is the philosophical core — it's a true parallel universe. Implementing this means the monthly sync Worker checks `worlds.is_live` before running.

- **Agent political alignment**: Each country agent should reflect the actual current government's political leaning (sourced from the country history data). India's agent behaves like the BJP government; Germany's like the current coalition. This is critical for realism. The political alignment is part of `country_states` and can drift over time if the simulation runs long enough.

- **History as analogy, not determinism**: Historical matches ground the agent's reasoning but don't determine it. The prompt explicitly tells Claude to reason through how today's world differs — nuclear deterrence, international institutions, economic interdependence, social media. A 1930s Germany trajectory in modern Germany would face the EU, NATO, the ICC, and instant global scrutiny.

- **No moralizing, no blocking**: Agents and players can pursue any political direction — authoritarian, libertarian, theocratic, communist. The simulation shows consequences, not judgments. The historical parallel card is informational, never a blocker.

- **Monthly sync scheduler — GitHub Actions, not Cloudflare Cron**: Cloudflare Workers free tier has a 10ms CPU time limit per invocation and a wall-clock duration limit — nowhere near enough to process 195 countries in one go. The paid Bundled plan ($5/month) removes this limit for cron triggers, but it's avoidable. Instead, a GitHub Actions scheduled workflow runs on the 1st of each month and calls the Worker once per country in sequence. Each Worker invocation handles one country (short, well within limits), and GitHub Actions execution time is free and generous.
- **LLM — Groq by default, Claude as optional upgrade**: Groq's free tier (1k req/day, 30 rpm, Llama 4 Maverick) covers the monthly 195-country sync (~7 minutes at 30 rpm) and casual gameplay at zero cost. Because Groq uses an OpenAI-compatible API, all LLM calls go through a single `src/ai/llm.ts` wrapper — swapping to Claude is a one-line config change. If the game grows and free tier limits become an issue, Claude Haiku for minor countries and Sonnet for G20 is the upgrade path (~$10–30/month).

- **Community knowledge base**: `periods.json` and `country_histories.json` are the most valuable community contribution targets. These are plain JSON — no code needed to add a historical period or improve a country's 20-year history. `CONTRIBUTING.md` should make this the easiest possible first PR.

- **Divergence as content**: The public divergence dashboard is not just a debugging tool — it's the product's most interesting public-facing feature. "Here's what AI predicted India would do, and here's what actually happened" is genuinely compelling. Consider a social share button on each divergence card.
