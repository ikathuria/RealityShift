# RealityShift - Budget and Risks

## Cost strategy

RealityShift should stay as free as possible to host and test. The first browser release is intentionally designed around static hosting, edge APIs, and client-side session state to reduce both infrastructure cost and maintenance overhead.

## Free-first assumptions

### Hosting

- Cloudflare Workers and static asset hosting should cover early public testing
- `workers.dev` is sufficient until branding or custom domain needs matter

### Data storage

- No database is required for the first vertical slice
- Client-side session state is enough for initial runs and replay

### Tooling

- Phaser, TypeScript, Vite, and Wrangler are all suitable for low-cost development

## Paid cost areas

### AI requests

- Mistral is the main paid runtime dependency for the Architect
- AI usage cost grows with request volume and prompt size

### Voice services

- ElevenLabs transcription and TTS increase both cost and integration complexity
- Voice should remain optional until the typed loop is proven

## Cost controls

- Text-first default interaction
- Short prompts and short response payloads
- No TTS in the first browser release
- No voice requirement in the first browser release
- Rate limiting before broad sharing
- Friendly fallback path for AI failures where possible

## Major product risks

### Risk: The mechanic is novel but not fun

Why it matters:

- The game could feel like a prompt toy rather than a strong game loop

Mitigation:

- Ship one polished trial first
- Tune for readable cause and effect
- Validate the slice before expanding scope

### Risk: AI output feels arbitrary or weak

Why it matters:

- The player's fantasy collapses if the Architect feels unreliable or cosmetic

Mitigation:

- Use authored allowlists and strong schema validation
- Return readable loadout summaries
- Add deterministic fallback behavior if needed

### Risk: Cost grows too quickly

Why it matters:

- Public demos can become expensive if every interaction requires paid AI

Mitigation:

- Delay voice and TTS
- Keep text first
- Add rate limits
- Consider fallback presets if testing volume spikes

### Risk: Scope creep

Why it matters:

- The concept naturally invites expansion into worldbuilding, more trials, and richer AI features

Mitigation:

- Keep the first release to one trial
- Treat the full campaign as later milestones
- Avoid building accounts, persistence, or mobile polish too early

### Risk: Unsafe runtime behavior

Why it matters:

- The prototype used dynamic code execution patterns that are not suitable for a public browser release

Mitigation:

- Enforce structured data contracts
- Keep all runtime effects mapped to known behavior modules
- Never execute model-authored code in the client

## Operational risks

- Upstream AI timeout or outage
- Malformed model output
- Abuse of public API routes
- Browser-specific rendering or input issues

Mitigations:

- Timeouts and clear error responses
- Input validation and schema checks
- Rate limiting
- Basic browser compatibility testing before sharing

## Decision rule

When cost, complexity, and product ambition conflict, prioritize:

1. a stable typed desktop slice
2. safe AI integration
3. low-cost hosting
4. optional voice and polish later

