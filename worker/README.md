# Worker

This directory contains the browser API and hosting scaffold for RealityShift.

Current responsibilities:

- expose `GET /api/health`
- expose a placeholder `POST /api/architect/shift`
- establish the Cloudflare Worker entrypoint and config

Planned next responsibilities:

- validate structured Architect shift requests
- return safe loadout responses
- add optional transcription support later
- integrate static asset hosting when the client build is ready

Source areas:

- `src/routes/`
- `src/ai/`
- `src/validation/`
