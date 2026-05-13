# RealityShift - User Stories

This document captures the player-facing and developer-facing stories for the browser version of RealityShift. Stories are written around the desktop-web vertical slice first, then future expansion.

## Onboarding stories

### US-01: Start a run

As a first-time player, I want to start a new run from a clear title screen so that I understand how to begin without needing outside instructions.

Acceptance criteria:

- The title screen explains the fantasy in one short readable block.
- Starting a run moves the player into the intro flow.
- The game is playable with keyboard and text input only.

### US-02: Understand the premise

As a new player, I want the intro to explain who the Architect is and why the world has rules so that the mechanic feels intentional instead of random.

Acceptance criteria:

- The intro names the Architect and the concept of charges.
- The player knows they will alter their loadout, not enter freeform cheat codes.
- The player can continue quickly without a long cutscene.

## Trial comprehension stories

### US-03: Read the trial rules

As a player, I want to see a constraint card before the trial starts so that I know what kind of challenge I am solving.

Acceptance criteria:

- The card appears before the player is expected to act.
- The card is available again from the HUD.
- The rules are written in plain, readable language.

### US-04: Understand what is blocked

As a player, I want the game to make the trial limitation obvious so that I do not waste time assuming something is broken.

Acceptance criteria:

- The trial rule is visible in gameplay and UI.
- Attempting the blocked behavior communicates the limitation clearly.
- The player can infer why an Architect shift might help.

## Architect interaction stories

### US-05: Ask for a shift using text

As a player, I want to type a request to the Architect so that I can reshape my loadout without needing a microphone.

Acceptance criteria:

- A text field and send action are always available when intended by the design.
- The game shows a loading state while the shift is being processed.
- The request response returns both dialogue and gameplay changes.

### US-06: Receive a legal loadout

As a player, I want the Architect to return a usable loadout that respects the trial rules so that the mechanic feels powerful but fair.

Acceptance criteria:

- Returned loadouts never break authored trial constraints.
- The UI shows the resulting loadout in understandable terms.
- The player can immediately feel the effect in gameplay.

### US-07: Recover from AI failure

As a player, I want failed Architect requests to fail gracefully so that a model issue does not ruin the run.

Acceptance criteria:

- The run state remains valid after malformed or timed-out AI output.
- The player receives an understandable message.
- Charges are not consumed on invalid or failed responses.

## Gameplay stories

### US-08: Experiment within limits

As a player, I want to try a few different build ideas so that the core fun comes from creative problem solving under pressure.

Acceptance criteria:

- Charges are limited but not so scarce that the player is afraid to experiment once.
- At least two distinct legal build directions are viable in the slice.
- The trial can be solved through the loadout system rather than pure dexterity alone.

### US-09: Succeed through adaptation

As a player, I want to beat the trial by choosing or evolving the right loadout so that success feels earned and expressive.

Acceptance criteria:

- Success depends on trial mastery plus loadout choice.
- The win condition is clear.
- A player can explain why their build worked.

### US-10: Fail in a readable way

As a player, I want to understand when and why I failed so that retrying feels fair.

Acceptance criteria:

- Running out of charges is clearly communicated.
- Health or other fail states are clearly communicated if present.
- The retry option is fast and obvious.

## Replay and progression stories

### US-11: Retry quickly

As a player, I want to restart the slice quickly so that experimentation stays fun.

Acceptance criteria:

- Retry returns the player to a clean run state.
- The player does not need to refresh the page manually.
- The first-time explanation is skippable on replay.

### US-12: Remember what changed

As a player, I want to review my current build so that I can connect my request to the resulting gameplay.

Acceptance criteria:

- The current loadout is visible from the HUD or Architect panel.
- Major movement, weapon, and passive changes are summarized.
- The player does not need to infer core stats from feel alone.

## Future expansion stories

### US-13: Progress through multiple trials

As a returning player, I want multiple distinct trial themes so that the Architect system feels deeper than a one-level gimmick.

Acceptance criteria:

- Each future trial has a different authored constraint.
- Charges carry meaningful tension across the run.
- Loadout rules and allowlists differ by trial.

### US-14: Prepare for a final boss

As a player, I want the final confrontation to pay off what I learned in the trials so that the campaign has escalation.

Acceptance criteria:

- The boss uses the same systemic language as the trials.
- The player can make one meaningful preparation decision before the fight.
- The encounter tests adaptation, not only raw stats.

## Developer and operations stories

### DS-01: Validate all loadouts safely

As a developer, I want all model output validated against a schema so that the client never receives unsafe or unusable runtime instructions.

Acceptance criteria:

- Unknown tags are rejected or normalized deterministically.
- Numeric values are clamped to allowed ranges.
- Invalid payloads never reach behavior application code.

### DS-02: Author trials as data

As a designer or developer, I want to define trials using structured data so that new trial content can be added without rewriting engine code.

Acceptance criteria:

- Trials have named IDs and authored constraints.
- Shift cost and allowlists live in authored data.
- Success and failure conditions are configurable.

### DS-03: Keep the game cheap to operate

As the maintainer, I want the game to run on mostly free infrastructure so that public testing is financially realistic.

Acceptance criteria:

- Static hosting and API hosting use free-tier friendly services.
- Voice and TTS are optional, not mandatory.
- Rate limits and graceful fallbacks are defined before broad sharing.

