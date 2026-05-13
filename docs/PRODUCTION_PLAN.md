# RealityShift - Production Plan

This document is the technical implementation backbone for rebuilding RealityShift as a browser-first game. It complements the broader planning set in `docs/`:

- `PRD.md` for product goals and release criteria
- `GAME_DESIGN.md` for gameplay rules and tuning targets
- `TECH_ARCHITECTURE.md` for system boundaries and stack choices
- `API_CONTRACTS.md` for request and response shapes
- `ROADMAP.md` for milestone sequencing
- `QA_PLAN.md` for test coverage
- `BUDGET_AND_RISKS.md` for free-tier assumptions and operational constraints

The first release target remains a desktop-web vertical slice: one polished trial, typed Architect input as the default interaction, validated loadout changes, and a complete win or fail loop. Voice input and TTS remain optional follow-on work.

## Production goals

- Ship a browser-based prototype that captures the fantasy of "rewriting reality through the Architect."
- Use free hosting and low-cost infrastructure wherever possible.
- Treat model output as structured data, never executable code.
- Keep the system simple enough for solo development and iteration.

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Client | Phaser 3 + TypeScript | Real-time gameplay, combat, movement, and effects |
| Build | Vite | Fast iteration and simple static build output |
| Overlay UI | HTML/CSS + lightweight app state | Menus, Architect panel, constraint card, and HUD |
| Host + API | Cloudflare Workers | Single origin for static assets and `/api/*` routes |
| Persistence | Session storage first | Add KV or D1 only when persistence is worth the complexity |
| AI | Mistral via Worker fetch | Returns dialogue plus structured loadout JSON |
| Voice | Optional ElevenLabs STT | Feature-flagged after text-first slice is stable |

## Non-negotiable architecture rules

- No arbitrary JavaScript or Python execution from model output.
- No `eval`, `new Function`, or code-patching in the browser version.
- All gameplay changes must map to a fixed behavior registry and validated schema.
- Secrets live only in the Worker environment.
- The text input path must always work without microphone access.

## Target repository shape

```text
RealityShift/
|- docs/
|- packages/
|  |- game-client/
|  |  |- src/
|  |  |  |- scenes/
|  |  |  |- game/
|  |  |  |- ui/
|  |  |  `- api/
|  |  |- index.html
|  |  `- package.json
|- worker/
|  |- src/
|  |  |- routes/
|  |  |- ai/
|  |  `- validation/
|  |- wrangler.jsonc
|  `- package.json
`- legacy/
   |- engine.py
   |- app/
   |- backend/
   |- game/
   `- utils/
```

The current Python prototype remains the design and reference source until the browser stack is in place.

## Runtime flow

```text
Browser
  |- static assets from Cloudflare
  |- POST /api/architect/shift
  `- POST /api/transcribe (optional)

Worker
  |- validates incoming request
  |- loads trial constraints and allowlist
  |- calls AI provider
  |- validates or normalizes loadout JSON
  `- returns safe response payload

Client
  |- applies loadout through a registry
  |- updates trial state, charges, and UI
  `- never executes model-authored code
```

## Core production decisions

### Release scope

- First deliverable is one vertical slice trial, not the full campaign.
- The slice includes title flow, intro, one trial, Architect interaction, charges, success or failure, and replay.
- The full three-trial run and final boss are milestone expansions, not prerequisites for the first playable browser release.

### Interaction model

- Typed prompt is the default Architect input.
- Voice transcription is a later layer that feeds the same text-based shift flow.
- TTS is polish work and should not block shipping.

### Gameplay data model

- Trials are data-driven through `TrialDefinition`.
- Loadouts are data-driven through a validated `Loadout` schema.
- Behavior modules implement movement, weapon, and passive tags.
- Constraints are enforced by authored allowlists, not by prompt wording alone.

## Production phases

### Phase 0 - Planning and repo preparation

- Finalize the documentation set in `docs/`.
- Keep the prototype intact as reference material.
- Decide whether to move prototype files into `legacy/` immediately or after browser parity begins.

### Phase 1 - Browser scaffolding

- Create Phaser client shell with one boot flow and placeholder scene.
- Create Worker with health route and local development workflow.
- Confirm static asset serving and local proxying between Vite and Worker.

### Phase 2 - Architect loop

- Implement `/api/architect/shift`.
- Add trial constraint card and Architect panel.
- Validate all model output against the agreed schema.
- Apply safe loadout changes through the client registry.

### Phase 3 - Vertical slice gameplay

- Build one trial end-to-end with authored constraints and authored win or fail states.
- Add charge consumption, retry loop, and result state.
- Add friendly error handling for AI failures or invalid output.

### Phase 4 - Expansion to full run

- Add trial hub, remaining trials, and the final boss sequence.
- Rebalance charges, loadout affordances, and challenge pacing.
- Introduce optional voice input once the typed flow is reliable.

### Phase 5 - Hardening and launch prep

- Add rate limiting and abuse protection.
- Improve analytics and operational visibility.
- Test desktop browsers and document any mobile limitations.

## Hosting and environments

### Local development

- Run Vite for the browser client.
- Run Wrangler for Worker routes.
- Proxy `/api/*` calls from the Vite dev server to the Worker dev server.

### Deployment

- Use Cloudflare Workers and static asset hosting on a free subdomain first.
- Store API secrets with Wrangler secrets.
- Add CI only after the local workflow is stable.

## Security and cost controls

- Validate all AI responses before client use.
- Reject unknown tags and clamp numeric values.
- Do not spend charges when the AI response is unusable.
- Start without a database to minimize cost and maintenance.
- Delay voice and TTS until the text-first loop proves fun and stable.
- Add rate limits on `/api/*` before wider public testing.

## Exit criteria for the first browser release

- One full trial can be played start to finish in the browser.
- The Architect can safely transform the player's loadout using typed input.
- The client never executes model-authored code.
- Charges, failure states, and retry flow all work.
- The project can be hosted on low-cost or free infrastructure other than AI usage itself.

