# RealityShift - README Guide

This is an internal guide for the future root `README.md`. It is not the public README itself. Its job is to make sure the eventual README supports the browser-first direction instead of the old prototype framing.

## Purpose of the future README

The root README should help a new visitor quickly understand:

- what RealityShift is
- what stack it uses now
- how to run it locally
- how the Architect mechanic works at a high level
- where to find deeper planning and architecture docs

## Recommended README sections

### 1. Project summary

Short pitch for RealityShift as a browser-based action RPG about reshaping loadouts through the Architect.

### 2. Current status

Explain whether the repo is still in planning, vertical slice implementation, or broader v1 development.

### 3. Core mechanic

Describe the text-first Architect loop:

- player reads trial constraint
- player requests a shift
- server validates a structured loadout
- client applies safe authored behavior

### 4. Tech stack

- Phaser 3
- TypeScript
- Vite
- Cloudflare Workers
- optional AI providers

### 5. Local development

Explain how to run:

- client dev server
- Worker dev server
- any required environment variables

### 6. Repo structure

Show the browser client, Worker, docs, and legacy reference areas.

### 7. Safety note

Explicitly state that the browser version does not execute arbitrary model-authored code.

### 8. Documentation links

Link to:

- `docs/PRD.md`
- `docs/GAME_DESIGN.md`
- `docs/TECH_ARCHITECTURE.md`
- `docs/PRODUCTION_PLAN.md`
- `docs/ROADMAP.md`

## README tone

- clear
- product-oriented
- honest about current status
- not hackathon-only unless the project status truly still is hackathon prototype

## What the README should avoid

- presenting the unsafe prototype implementation as the production direction
- overpromising full campaign scope if only the slice exists
- implying voice is required if text-first remains the default path

