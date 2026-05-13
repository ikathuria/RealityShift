# RealityShift - Roadmap

This roadmap sequences the browser rebuild around a vertical slice first. The goal is to ship proof of fun before expanding scope.

## Milestone 0 - Documentation and repo direction

### Goals

- Align the project around one browser-first plan
- Preserve the prototype as reference material
- Remove ambiguity around release scope

### Deliverables

- Complete planning doc set in `docs/`
- Updated `PRODUCTION_PLAN.md`
- Agreed vertical-slice-first scope

### Exit criteria

- Product, design, architecture, and QA docs no longer conflict
- A future implementer can start scaffolding without new product decisions

## Milestone 1 - Browser scaffolding

### Goals

- Establish the new client and Worker structure
- Prove local and deployed app boot works

### Deliverables

- Phaser + TypeScript + Vite client skeleton
- Cloudflare Worker skeleton
- Health route
- Basic title or placeholder scene

### Exit criteria

- Local dev workflow is documented and repeatable
- Static hosting and API hosting work together

## Milestone 2 - Architect loop foundation

### Goals

- Replace unsafe prototype behavior with validated data-driven shifts

### Deliverables

- `POST /api/architect/shift`
- Loadout schema validation
- Trial definition data model
- Architect UI panel and loading state
- Safe client behavior registry

### Exit criteria

- A player request can change the build without arbitrary code execution
- Invalid model output is handled safely

## Milestone 3 - Vertical slice gameplay

### Goals

- Deliver one polished playable trial

### Deliverables

- Intro flow
- One authored trial with constraint card
- Charges system
- Win and fail states
- Retry loop
- Loadout summary UI

### Exit criteria

- The slice is fun, understandable, and replayable
- A player can complete the slice in one sitting

## Milestone 4 - Stabilization and polish

### Goals

- Make the vertical slice strong enough for public sharing

### Deliverables

- Error UX improvements
- Browser compatibility pass
- Basic analytics or logging
- Balance adjustments for charges and allowed builds

### Exit criteria

- Public demo risk is acceptable
- Core runtime and API flows feel stable

## Milestone 5 - Expanded v1 run

### Goals

- Grow from one trial into the intended campaign loop

### Deliverables

- Trial hub
- Trial 2
- Trial 3
- Gate transition
- Final boss

### Exit criteria

- The game has a start-to-finish v1 run
- Progression pacing works across multiple trials

## Milestone 6 - Optional enhancements

### Candidate features

- Voice transcription
- TTS narration
- Persistence
- Mobile improvements
- Additional trial archetypes

### Rule

These features should only start after the typed desktop slice is stable and clearly worth expanding.

