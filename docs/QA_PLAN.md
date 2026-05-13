# RealityShift - QA Plan

## Purpose

This plan defines how RealityShift should be tested as it moves from prototype ideas into a browser product. The focus is on gameplay clarity, safe AI integration, and browser reliability.

## QA priorities

### 1. Safe AI integration

- The client never executes arbitrary model-authored code
- Invalid AI payloads do not break the run
- Trial allowlists are actually enforced

### 2. Gameplay fairness

- Trials communicate their constraints clearly
- At least one legal shift materially helps
- Charges and fail states feel understandable

### 3. Browser stability

- Core flows work in supported desktop browsers
- UI overlays remain readable and usable
- Performance is acceptable for a small action game slice

## Test scope

### Functional tests

- Start run
- Continue past intro
- Open and reopen constraint card
- Submit Architect request
- Apply successful loadout
- Handle failed loadout request
- Win trial
- Lose trial
- Retry run

### API tests

- Health endpoint returns expected shape
- Shift endpoint rejects malformed request payloads
- Shift endpoint rejects unknown trial IDs
- Shift endpoint handles invalid model output safely
- Shift endpoint returns no charge loss on recoverable failure

### Gameplay tests

- Trial constraint is active and visible
- Multiple legal loadout paths remain valid
- Current loadout summary matches applied gameplay behavior
- Charges decrement only on successful shifts

### UX tests

- A new player can understand the premise from the title and intro flow
- The Architect panel is understandable without external documentation
- Error messages are readable and actionable
- Retry flow is fast

### Browser tests

Primary support:

- Current Chrome on desktop
- Current Edge on desktop

Secondary check:

- Current Firefox on desktop if feasible

### Accessibility checks

- Text input path works without microphone access
- Constraint text is legible
- Major controls are keyboard reachable where practical
- Color and status information are not conveyed only by subtle visual cues

## Test environments

- Local development build
- Local Worker development server
- Deployed preview on Cloudflare

## Regression checklist

- Trial still enforces its authored limitation
- Charges still behave correctly
- Invalid AI responses still fail safely
- Current loadout summary still matches actual gameplay behavior
- Retry returns the run to a clean initial state

## Exit criteria for the vertical slice

- Core flow works start to finish in supported browsers
- The AI safety boundary is intact
- The trial is understandable to a fresh tester
- No critical bug prevents completion or retry

