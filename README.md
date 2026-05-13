# RealityShift

RealityShift is a browser-first action RPG about surviving a broken simulation by asking the Architect to reshape your loadout. The project is moving from a hackathon-era Python prototype to a safer browser architecture built around typed Architect input, validated loadout data, and low-cost deployment.

## Current Status

The repository now has its first browser implementation scaffold.

- The product direction is locked around a desktop-web vertical slice first.
- The old Python prototype is preserved in `legacy/` as reference material.
- The new implementation target is `packages/game-client/` plus `worker/`.
- A minimal Phaser client and Cloudflare Worker are now in place.

## Core Mechanic

RealityShift is built around a constrained "rewrite reality" loop:

1. The player reads the trial constraint.
2. The player asks the Architect for a shift using text.
3. The server validates the request and returns a legal loadout.
4. The client applies safe, authored gameplay behaviors.
5. The player adapts to the trial using limited charges.

The browser version will not execute arbitrary model-authored code.

## Planned Stack

- Phaser 3
- TypeScript
- Vite
- Cloudflare Workers
- Mistral for structured loadout generation
- Optional ElevenLabs transcription and TTS later

## Repository Structure

```text
RealityShift/
|- docs/
|- packages/
|  `- game-client/
|- worker/
`- legacy/
```

- `docs/` contains the planning, product, and architecture documents.
- `packages/game-client/` is the future browser game client.
- `worker/` is the future edge API and hosting layer.
- `legacy/` contains the original prototype and hackathon materials kept for reference.

## Documentation

- [PRD](docs/PRD.md)
- [User Stories](docs/USER_STORIES.md)
- [Game Design](docs/GAME_DESIGN.md)
- [Tech Architecture](docs/TECH_ARCHITECTURE.md)
- [API Contracts](docs/API_CONTRACTS.md)
- [Content Bible](docs/CONTENT_BIBLE.md)
- [Roadmap](docs/ROADMAP.md)
- [QA Plan](docs/QA_PLAN.md)
- [Budget and Risks](docs/BUDGET_AND_RISKS.md)
- [Production Plan](docs/PRODUCTION_PLAN.md)

## Local Development

Install workspace dependencies from the repo root:

```bash
npm install
```

Run the browser client:

```bash
npm run dev:client
```

Run the Worker:

```bash
npm run dev:worker
```

The Vite client proxies `/api/*` to the local Worker during development.

## Legacy Prototype

The original Python, Flask, FastAPI, and hackathon assets are intentionally retained in `legacy/` so the concept, mechanics, and content can still inform the browser rebuild without dictating the new production direction.

## Design Rules

- Text-first Architect interaction for the first release
- Desktop web first
- Free-first infrastructure wherever possible
- Structured loadout data instead of executable AI output
- One polished vertical slice before full-campaign expansion
