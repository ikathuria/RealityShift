# RealityShift - Technical Architecture

## Overview

RealityShift will be rebuilt as a browser-first game with a clean separation between gameplay runtime, UI, and AI-backed services. The architecture must preserve the prototype fantasy while removing unsafe code execution patterns and keeping operational cost low.

## Stack decisions

### Client

- Phaser 3 for gameplay scenes and real-time mechanics
- TypeScript for client code quality and maintainability
- Vite for development and production builds
- HTML and CSS overlay for menus, HUD, Architect panel, and constraint cards

### Server and hosting

- Cloudflare Workers for API routes and static hosting integration
- `workers.dev` deployment first
- Wrangler for local development, secrets, and deployment

### Persistence

- Session state stored client-side for the first slice
- No database required for initial release
- KV or D1 only if later needs justify the added complexity

### AI integrations

- Mistral for structured loadout generation
- Optional ElevenLabs transcription later
- Optional TTS later

## Architecture goals

- Keep the browser client deterministic and safe
- Minimize backend complexity
- Keep the first release cheap to host
- Allow trials and loadouts to grow through authored data, not ad hoc logic

## High-level system split

### Browser client responsibilities

- Render gameplay and input handling
- Manage local run state
- Show current trial and constraint UI
- Submit Architect requests
- Apply validated loadouts to behavior modules

### Worker responsibilities

- Authenticate access to external AI providers
- Build prompts with trial constraints and schema expectations
- Validate and normalize AI responses
- Enforce safe API contracts
- Return only data the client already knows how to execute

## Safety boundary

The browser client must never execute model-authored code. This is the most important architecture boundary in the project.

Allowed:

- Enumerated tags
- Numeric modifiers inside approved ranges
- Dialogue text
- Validation warnings

Disallowed:

- JavaScript snippets
- Python snippets
- Dynamic function bodies
- Arbitrary scene mutations authored by the model

## State model

### RunState

- `runId` or local session identifier
- `currentTrialId`
- `remainingCharges`
- `currentLoadout`
- `trialStatus`
- `resultState`

### TrialDefinition

- `id`
- `name`
- `constraintCard`
- `mechanicsFlags`
- `allowlist`
- `shiftCost`
- `successCondition`
- `failureCondition`

### Loadout

- Movement section
- Weapon section
- Passive section
- Metadata or warnings as needed

## Client architecture

### Scenes

- Boot or title scene
- Intro scene
- Trial scene for the vertical slice
- Result scene for success or failure

### UI overlay

- Constraint card
- Architect panel
- Loadout summary
- Charges display
- Health or status display if health is in the slice

### Behavior registry

The client should apply loadouts through a behavior registry instead of one-off procedural mutation.

Examples:

- Movement tags map to known movement controllers
- Weapon tags map to known projectile or area behaviors
- Passive tags map to known resistance or shield systems

## Worker architecture

### Routes

- `GET /api/health`
- `POST /api/architect/shift`
- `POST /api/transcribe` only when voice work starts

### Modules

- Prompt builder
- AI client wrapper
- Schema validation
- Trial configuration loader

## Repository direction

Recommended structure:

```text
docs/
packages/game-client/
worker/
legacy/
```

The current Python, Flask, and FastAPI code remains reference material until the browser replacement exists.

## Local development

- Vite serves the client
- Wrangler serves the Worker
- Vite proxies `/api/*` to the Worker during development

## Deployment

- Build the client to static assets
- Deploy Worker routes plus assets through Cloudflare
- Keep one origin so browser CORS concerns stay minimal

## Observability

For the first release, keep observability light:

- Basic server-side error logging
- Health endpoint
- Optional Cloudflare analytics
- Structured logs around AI failures and validation failures

## Scaling assumptions

- Initial usage is small public testing or demos
- Free-tier infrastructure should be enough for client hosting and edge routing
- AI traffic is the primary marginal cost driver

