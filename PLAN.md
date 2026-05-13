# PLAN.md — RealityShift

> **Status**: Milestones 0 and 1 complete. Resume from Milestone 2.
>
> **Resume command**: `claude "Read PLAN.md, find the first incomplete task, and continue. Mark tasks done as you go. Commit when a milestone is complete."`

---

## Project Overview

**RealityShift** is a browser-based action RPG where the player negotiates with an AI entity called the Architect to reshape their abilities inside a broken simulation. The core fantasy: instead of picking from a skill tree, the player types natural-language intent and the game translates it into a safe, validated loadout that changes how the trial can be solved.

**Stack:**
- Client: Phaser 3 + TypeScript + Vite (`packages/game-client/`)
- Backend: Cloudflare Workers + Wrangler (`worker/`)
- AI: Mistral API (structured loadout generation via JSON schema)
- Monorepo: npm workspaces
- Hosting: Cloudflare Workers (`workers.dev`, free tier)

**Design rules (non-negotiable):**
- No model-authored code ever executes on the client — loadouts are enumerated tags only
- Invalid AI output must never corrupt run state; charge is only deducted on success
- Client-side session state only for v1 (no database, no accounts)

---

## ✅ Milestone 0 — Documentation and Repo Direction

**Complete.** Full planning doc set in `docs/`. Vertical-slice-first scope agreed. Legacy prototype preserved in `legacy/` as reference.

---

## ✅ Milestone 1 — Browser Scaffolding

**Complete.** Phaser + TypeScript + Vite client skeleton, Cloudflare Worker skeleton, health route, title scene, mock loadout selection via keyword matching, charge tracking, message log, loadout UI panel.

---

## Milestone 2 — Architect Loop Foundation

**Goal:** A real Mistral API call generates validated structured loadouts. The client applies them through a typed behavior registry. No arbitrary code runs.

**Tasks:**

- [ ] Add `MISTRAL_API_KEY` to Wrangler secrets and document the setup step in a dev README — Done when: `wrangler secret list` shows `MISTRAL_API_KEY` and local dev works without hardcoding the key.

- [ ] Implement real Mistral call in `worker/src/index.ts` replacing the keyword mock — call `mistral-small-latest` with a system prompt that enforces structured JSON output matching the loadout schema (movement/weapon/passive tags from the allowlist, chargesDelta, dialogue string). Done when: a POST to `/api/architect/shift` returns a real Mistral-generated loadout with valid tags.

- [ ] Define the trial allowlist and behavior registry in `worker/src/trials/trial_01.ts` — export: allowed movement tags, weapon tags, passive tags, and numeric modifiers for each. Done when: the file exports a typed `TrialDefinition` object that the shift endpoint can import and reference.

- [ ] Add strict schema validation in the Worker — after receiving Mistral output, validate that all tags exist in the trial allowlist; if not, return `ok: false` with a safe error and `chargesDelta: 0`. Done when: sending a prompt that produces an off-list tag returns an error response without consuming a charge, verified in a manual test.

- [ ] Implement the behavior registry in `packages/game-client/src/game/behaviors.ts` — a typed map from each allowed tag to its effect constants (speed multiplier, damage, cooldown, jump height, etc.). Done when: the file exports a `BehaviorRegistry` object with at least 6 entries covering the movement/weapon/passive tags defined in the Worker trial definition.

- [ ] Wire the client to apply behavior registry values when a shift response arrives — in `main.ts`, after receiving `loadout` from the Worker, look up each tag in `BehaviorRegistry` and store the resolved numeric modifiers in run state. Done when: the browser console logs the resolved numeric values for a loadout shift.

- [ ] Add loading state to the Architect panel — disable submit button and show a spinner or "Architect is calculating..." message while the request is in-flight; restore on response. Done when: submitting a request visually disables the form until the response arrives.

---

## Milestone 3 — Vertical Slice Gameplay

**Goal:** One fully playable trial (`trial_01_denied_ascent`) with real Phaser mechanics, the constraint card, charge economy, win/fail states, and retry flow. A player can start, play, succeed or fail, and retry in one sitting.

**Tasks:**

- [ ] Implement the intro/title flow in Phaser — TitleScene shows game name, a "Begin Run" button, and the trial brief; clicking transitions to the gameplay scene. Done when: the player lands on a title, reads the trial premise, and presses a button to enter the trial.

- [ ] Create `TrialScene.ts` as a new Phaser scene — scaffold the scene with a static tilemap or basic platform geometry representing `trial_01_denied_ascent` (a platformer level where vertical height is restricted). Done when: the scene loads, the player character spawns, and the level is visible.

- [ ] Implement the player character with Phaser Arcade Physics — movement (left/right) and a weapon (projectile arc); movement speed and projectile behavior read from the behavior registry using the current run state tags. Done when: the player moves left/right, fires a projectile, and the values match the registered behavior for the starting loadout.

- [ ] Implement the trial constraint — jumping is disabled by default (the `denied_ascent` constraint); the behavior registry entry for `kinetic_stride` enables a horizontal dash instead of vertical jump. Done when: the player cannot jump with the default loadout but can dash after receiving a Kinetic Stride shift.

- [ ] Add a trial obstacle — place an enemy or barrier that cannot be bypassed by the default loadout but can be cleared with at least one legal loadout combination. Done when: the player dies or is blocked with the default build, and the obstacle is passable after a correct Architect shift.

- [ ] Implement win and fail states — win: player reaches the end of the trial; fail: player health reaches zero or a time limit expires. Both states show a result screen with the run summary (shifts used, charges remaining, loadout at end). Done when: both outcomes are reachable and display the result screen.

- [ ] Implement the retry flow — the result screen has a "Try Again" button that resets run state (charges back to 3, loadout back to default) and restarts `TrialScene`. Done when: clicking retry fully resets the run without a page reload.

- [ ] Surface the constraint card during the trial — display a persistent UI overlay showing the trial rule (e.g. "Height is denied. Horizontal momentum is permitted."). Done when: the constraint card is visible while playing and matches the trial definition.

- [ ] Connect the Architect console to live gameplay — submitting an Architect request during the trial calls the Worker, receives the loadout, updates behavior registry values, and the player character's properties change immediately (no restart required). Done when: the player can shift their loadout mid-trial and the character behaves differently within the same run.

---

## Milestone 4 — Stabilization and Polish

**Goal:** The vertical slice is stable enough for public sharing — reliable error handling, smooth UX, and no obvious crashes or security issues.

**Tasks:**

- [ ] Add Worker rate limiting — reject more than N requests per IP per minute (use Cloudflare's built-in rate limiting or a simple in-memory counter in the Worker). Done when: hammering the endpoint from a single IP returns a 429 after the limit is reached.

- [ ] Graceful AI failure UX — if the Mistral call times out or returns an error, show a short Architect error message in the console ("The signal is disrupted. Try again.") without consuming a charge. Done when: killing the Mistral API key temporarily and submitting a request shows the error message and charge count is unchanged.

- [ ] Browser compatibility pass — test and fix the game in Chrome, Edge, and Firefox (latest stable). Done when: the full play loop (title → trial → win or fail → retry) works in all three browsers without console errors.

- [ ] Input validation on the Worker — sanitize `userText` input: strip HTML, enforce a 500-character max, reject empty strings. Done when: sending `<script>alert(1)</script>` as userText returns a 400 and is not echoed in the response.

- [ ] Balance pass on charges and loadout allowlist — play through the trial 5 times; adjust starting charges, shift costs, and allowed tags so the trial is solvable with good play but not trivial. Done when: the trial can be beaten in 1-2 charges with a good strategy and is not beatable with no shifts at all.

- [ ] Add basic analytics or logging — log each Architect request (trial ID, prompt length, response tag, success/fail) to Cloudflare Worker logs or a free logging endpoint. Done when: Worker logs show per-request data after a play session.

- [ ] Performance and asset pass — ensure the game loads in under 5 seconds on a standard broadband connection; compress any image assets; check for memory leaks in Phaser scene transitions. Done when: Lighthouse performance score is above 80 on the deployed URL.

---

## Milestone 5 — Expanded v1 Run

**Goal:** A full start-to-finish v1 run: trial hub, three trials, gate transitions, and a final boss encounter.

**Tasks:**

- [ ] Design and document two additional trials in `docs/GAME_DESIGN.md` — each trial must have a distinct constraint that requires a different legal loadout strategy. Done when: docs describe the rule, obstacle, and intended solution for Trial 2 and Trial 3.

- [ ] Implement a Trial Hub scene — a screen between trials that shows completed trials, the player's current charges (if carrying over), and the path to the next trial. Done when: completing Trial 1 routes the player to the hub, and the hub links to Trial 2.

- [ ] Implement Trial 2 with its constraint — build the Phaser level, add it to the Worker trial definitions and allowlist, wire the full Architect loop. Done when: Trial 2 is fully playable with win/fail/retry.

- [ ] Implement Trial 3 with its constraint — same as Trial 2 tasks. Done when: Trial 3 is fully playable.

- [ ] Implement the gate transition — after Trial 3, show a narrative cutscene or text screen that leads into the final boss encounter. Done when: completing Trial 3 transitions to the boss intro.

- [ ] Implement the final boss encounter — a Phaser level or encounter where the player must use the full range of Architect shifts learned across the run. Done when: the boss has a win condition and the player reaches a game-complete screen on success.

- [ ] Implement run persistence across trials using `sessionStorage` — store charges, shifts used, and current trial progress so a page refresh within a session does not reset the run. Done when: refreshing mid-trial restores run state from `sessionStorage`.

---

## Milestone 6 — Optional Enhancements (Post-Launch)

**Rule:** Do not start these until the typed desktop slice is stable and clearly worth expanding.

**Candidates:**
- Voice transcription via ElevenLabs or Whisper (mic input → `userText`)
- TTS narration of Architect dialogue (ElevenLabs)
- Cloud save / persistent progression (Cloudflare KV or Turso)
- Mobile layout and touch controls
- Additional trial archetypes
- Custom domain and branding

---

## Viability Summary

```
Idea:            RealityShift — AI-loadout browser RPG
Market:          Niche but growing — AI chat games at $3.4B (18.5% CAGR).
                 No direct competitor: AI Dungeon is pure text, RPGGO is open-world sandbox.
                 RealityShift's constrained-loadout + real-platformer loop is a clear gap.
Feasibility:     Medium — Phaser + Cloudflare Worker + Mistral is well-trodden stack.
                 Hardest part: making AI output feel meaningful, not cosmetic.
Free to build:   Mostly — Cloudflare free tier + Mistral pay-per-request.
                 Expect <$5/month for light testing; cost scales only with real players.
Monetization:    Portfolio/demo first. If traction exists:
                 Option A — $5 one-time "unlock full campaign" (post Milestone 5)
                 Option B — Patreon / itch.io "pay what you want"
                 Option C — Sponsorship from AI tooling companies (Mistral, ElevenLabs)
Recommended      Phaser 3, TypeScript, Vite, Cloudflare Workers, Mistral API,
stack:           npm workspaces (already in place)
Estimated        6 milestones (M0–M1 complete, M2–M5 remaining + M6 optional)
milestones:
Verdict:         Build it. The vertical slice is the right bet — prove the mechanic is fun
                 before expanding. The tech is in place; the gap is execution of M2 and M3.
```

---

## Claude Code Session Commands

**Start the next session (Milestone 2):**
```
claude "Read PLAN.md and complete Milestone 2. Mark tasks done as you go. Stop after Milestone 2 and commit."
```

**Resume from any session:**
```
claude "Read PLAN.md, find the first incomplete task, and continue. Mark tasks done as you go. Commit when a milestone is complete."
```

**Jump to a specific milestone:**
```
claude "Read PLAN.md and complete Milestone 3. Mark tasks done as you go. Stop after Milestone 3 and commit."
```
