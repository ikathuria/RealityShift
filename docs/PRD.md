# RealityShift - Product Requirements Document

## Product summary

RealityShift is a browser-based action RPG where the player negotiates with an AI entity called the Architect to reshape their abilities inside a broken simulation. The core fantasy is not "the AI writes code live" but "the world bends to player intent within authored rules."

The first release target is a desktop-web vertical slice that proves the mechanic is fun, readable, and affordable to run.

## Product vision

Build an experimental browser game where players feel clever for describing solutions in natural language, but the game remains fair because the underlying mechanics are constrained, validated, and authored by design.

## Problem statement

The prototype proves the novelty of AI-driven reality shifts, but it currently relies on unsafe code injection patterns and prototype-era technology choices. The product needs a browser-first design that:

- preserves the strongest part of the fantasy
- removes unsafe arbitrary code execution
- keeps hosting and operations inexpensive
- scopes the first release tightly enough to actually ship

## Goals

- Deliver a browser experience that captures the "Architect rewrites reality" fantasy.
- Make typed Architect input the default interaction for the first release.
- Ship one polished trial with a complete start, play, fail or win, and retry loop.
- Build a production direction that can later grow into a three-trial run and final boss.
- Keep infrastructure costs as low as possible outside of optional AI usage.

## Non-goals

- Shipping the full three-trial campaign in the first browser release
- User accounts, cloud saves, or progression across devices
- Multiplayer or social systems
- Open-ended sandbox world generation
- Arbitrary AI-authored code execution on the client
- Requiring voice input to play

## Target audience

### Primary audience

- Players who like experimental indie games
- Players interested in AI-assisted mechanics
- Desktop browser players comfortable with action or puzzle-combat hybrids

### Secondary audience

- Hackathon or demo audiences
- Stream or showcase viewers attracted to a strong mechanic hook
- Developers and designers interested in AI-native game interactions

## Value proposition

RealityShift offers a distinct gameplay fantasy: instead of picking from a standard skill tree, the player tells the Architect what kind of power they want, and the game translates that desire into a legal, balanced loadout that changes how the trial can be solved.

## Player fantasy

- I am trapped inside a controlled simulation.
- An entity called the Architect has the power to rewrite reality.
- I can persuade or direct that entity to reshape my movement and combat tools.
- I still need to solve authored challenges; I cannot simply wish the game away.

## Design pillars

### 1. Constrained imagination

The player can express creative intent, but the game turns it into safe, authored mechanics.

### 2. Readable stakes

Every Architect request has a cost through limited charges, so every change matters.

### 3. Fair authored challenge

Trials are real game levels with real constraints, not pure prompt toys.

### 4. Strong presence

The Architect should feel like a real force in the world through UI, tone, and response copy.

## First release scope

### In scope

- Title and intro flow
- One authored trial
- Typed Architect input
- Constraint card visible before and during the trial
- Charge economy
- Structured loadout generation and application
- One clear success condition
- One clear failure condition
- Retry flow

### Out of scope for the first release

- Full campaign
- Voice transcription by default
- TTS narration
- Overworld or Act 2 content
- Persistent progression

## Core loop

1. Start a run.
2. Receive the trial brief and constraint card.
3. Enter the trial and discover the obstacle.
4. Ask the Architect for a loadout shift using text.
5. Receive a validated loadout and Architect response line.
6. Test the new loadout against the trial.
7. Spend charges carefully until the player solves or fails the trial.
8. Retry and experiment.

## Core feature requirements

### Trial system

- The first release contains one polished trial.
- The trial must have a distinct rule that blocks naive play.
- The player must benefit materially from one or more legal loadout shifts.

### Architect interaction

- The player can submit typed intent at any time the design allows.
- The response must include short flavor dialogue and a safe loadout.
- Invalid AI output must never corrupt the run state.

### Loadout system

- Loadouts must be structured and validated.
- Loadouts can affect movement, weapon behavior, and passives.
- All allowed modifications must come from authored tags and ranges.

### Charge economy

- Charges are limited per run.
- Successful Architect shifts consume charges.
- Failed or invalid AI responses should not consume charges.

### UX requirements

- The game must be playable without a microphone.
- Trial rules must be easy to reread.
- Players must understand why a shift succeeded, failed, or was adjusted.

## Free-first constraints

- Hosting should run on free or very low-cost infrastructure.
- No required paid persistence layer for the first release.
- AI usage should be minimized by making text the default and delaying voice or TTS.
- The game should remain demonstrable even with AI usage capped or temporarily disabled.

## Success metrics

### Product metrics

- A new player can start a run and understand the premise without external explanation.
- A player can complete or fail the vertical slice in one sitting.
- The Architect mechanic feels useful rather than cosmetic.
- Players can identify at least one memorable loadout change from the session.

### Engineering metrics

- No model-authored code is executed on the client.
- Invalid model output is handled gracefully.
- The slice runs reliably in current desktop Chrome and Edge.

## Release criteria

- One browser-hosted vertical slice is fully playable.
- Core docs, architecture, and API contracts stay aligned.
- The typed Architect loop is stable and understandable.
- Charges, validation, and failure handling are implemented.
- The game can be shown publicly without obvious security hazards.

## Future expansion

- Three-trial campaign
- Final boss encounter
- Voice transcription
- TTS narration
- More trial archetypes
- Broader world restoration or Act 2 structure

