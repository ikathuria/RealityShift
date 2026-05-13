# RealityShift - Game Design

## High concept

RealityShift is a browser action RPG about surviving a broken simulation by persuading the Architect to change your build. The core design challenge is balancing creative expression with authored rules.

## Release structure

### First browser release

- One fully playable trial
- Typed Architect interaction
- Limited charges
- One complete win or fail loop

### Full v1 target after the slice

- Intro
- Three trials
- Gate transition
- Final boss
- Victory and defeat endings

## Narrative frame

The player wakes inside a fractured simulation. The Architect is both guide and jailer. It offers help, but always within designed boundaries. Each trial reveals a fault in reality that cannot be overcome through ordinary action alone. The player must ask for a loadout shift and then prove they can use it well.

## Core gameplay loop

1. Read the current trial constraint.
2. Enter the gameplay space and observe what is blocked.
3. Ask the Architect for a change to movement, offense, defense, or utility.
4. Receive a legal loadout interpretation.
5. Test the new build in the level.
6. Repeat until the player wins, dies, or exhausts charges.

## Design principles

### Authored, not chaotic

The game should feel expressive, but every meaningful effect is still hand-designed and bounded.

### Creativity under pressure

The player should feel rewarded for inventiveness, but limited enough by charges and trial rules that choices matter.

### Short and readable loops

The first slice should be finishable in one session and easy to replay.

### Mechanical honesty

The game should never imply the Architect can do anything. It should present bounded power clearly.

## Charge economy

- Charges are the main strategic resource.
- Each successful shift consumes a defined number of charges.
- Invalid or failed shifts do not consume charges.
- The first slice should start with enough charges to try multiple ideas while still creating tension.

Recommended vertical slice default:

- Starting charges: 3
- Cost per successful shift: 1

## Loadout categories

### Movement

- Ground speed changes
- Traction or friction changes
- Hover or bridge-like traversal tags when allowed
- Air control changes where legal

### Weapon

- Projectile pattern
- Element
- Damage profile
- Cooldown profile
- Area or damage-over-time traits where allowed

### Passive

- Hazard resistance
- Shielding
- Conditional survivability modifiers
- Trial-specific immunity or mitigation when allowed

## Vertical slice trial

### Trial theme

Trial 1 should be the "No Jump" trial because it is easy to understand and clearly demonstrates why the Architect matters.

### Constraint

- The player cannot use the normal jump solution.
- The space should visually suggest traversal problems that need another answer.

### Viable solution families

- Ground speed and dash-style movement
- Temporary bridge or platform-like utility if authored
- Ranged or indirect level interaction if authored
- Defensive solutions that let the player tank a hazard-based route if authored

### Success condition

The player reaches the exit or completes the final room objective after navigating the constraint with one or more legal shifts.

### Failure condition

- Charges reach zero before success
- Optional health-based death if included in the slice

## Future trials

### Trial 2 - Indirect damage

Enemies or targets resist direct projectile hits, forcing the player toward splash, damage-over-time, summons, or environmental tools.

### Trial 3 - Floor hazard

The floor or ground becomes unsafe, encouraging hover, resistance, temporary platforming, or positional tools.

## Boss design direction

The final boss should pay off the trial language rather than become a generic damage sponge.

- The boss represents the Architect's hardest test or a corrupted fragment of the system.
- The player brings a constrained build into the fight.
- The boss rewards understanding of movement, timing, and chosen tools.
- The fight can include one final high-stakes shift if balance supports it.

## Difficulty and balance rules

- The first legal shift should noticeably help, not feel cosmetic.
- No single prompt phrasing should be required to succeed.
- The player should not need insider prompt engineering knowledge.
- Trial allowlists must guarantee multiple viable approaches where possible.
- The Architect should feel intelligent, but the game should remain readable even when the AI interpretation is imperfect.

## UI and feedback rules

- Constraint cards must be readable and reopenable.
- Current loadout must be summarized clearly.
- The Architect response should explain what changed in short, flavorful language.
- Failure messages should explain whether the issue was charges, health, or invalid shift output.

## Act 2 direction

Act 2 is design-only for now. It can expand the concept from survival trials to reality restoration. The same loadout language can evolve into larger-scale world repair, but that is intentionally out of scope for the first browser release.

