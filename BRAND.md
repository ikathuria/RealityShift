# RealityShift Brand Guidelines: "Arcade Fork"

> Source of truth for tokens: [`src/brand-tokens.css`](src/brand-tokens.css). If this doc and the tokens disagree, fix one.
> Rendered reference: [`design/options/option-5-arcade-fork.html`](design/options/option-5-arcade-fork.html).

## Essence
- **One line:** an always-on AI wargame where you take over a country and the world forks into a parallel universe you can watch, read and share.
- **Personality:** playful, mischievous, legible. Never sterile, never grimdark, never "enterprise dashboard".
- **Reference:** a board-game map (Ticket to Ride, Risk box art) crossed with a split-screen "what if" comic panel. Ink-outlined cartoon cartography.
- **Energy level:** 4 of 5 · **Density:** balanced. Panels are compact, but each screen has one big moment.

### The rule that carries the brand
**Teal = reality. Coral = your fork. Sun-yellow = something you can do.** Every chart, pin, chip and comparison uses this mapping. Never use teal or coral for anything else, and never use yellow for decoration.

## Voice & copy
- **Tone:** a wry game-show host who knows geopolitics. Short, concrete, a little cheeky. The stakes are real, so jokes never punch at real people or tragedies.
- **Do:**
  - "Take over the United States!"
  - "One world is real. The other one is yours."
  - "Drift from reality: 62%"
  - "No real-world data enters your universe again."
- **Don't:** "Unlock", "Seamless", "Elevate", "Revolutionary", "AI-powered" as a selling point, ALL-CAPS sentences, emoji as icons, exclamation marks on anything except the main call to action.
- **Casing:** sentence case for all UI. Uppercase only for chip labels and eyebrows, set in `--rs-text-2xs`/`--rs-text-xs` with `--rs-tracking-label`.
- **Numbers:** always specific ("$82.5K", "3.6%"), with units. Changes carry an arrow (▲/▼) plus the amount.

## Logo
- **Wordmark:** "Reality/Shift" in Fredoka 700, sun-yellow fill, 1.5px ink stroke, a 3px ink offset shadow, and the slash in coral. The slash *is* the fork.
- **Clear space:** the height of the "R" on all sides. **Minimum size:** 18px cap height.
- **Don't:** recolour the slash, drop the ink outline, or set it on photos without an ink or paper backing.

## Color
| Token | Hex | Use |
|---|---|---|
| `--rs-ink` | #0B0F19 | Outlines, offset shadows, text on light surfaces |
| `--rs-paper` | #FFFDF6 | Floating panels, cards, secondary buttons |
| `--rs-sun` | #FFD60A | Primary action buttons, wordmark, focus ring, "newest" ring |
| `--rs-real` | #21B8A6 | Reality fills, pins, chips, the left of drift bars |
| `--rs-real-tint` | #C9F2EC | Reality value pills on paper |
| `--rs-real-deep` | #123B49 | Reality half of split backgrounds |
| `--rs-fork` | #FF6B3D | Fork fills, pins, chips, hero accent words |
| `--rs-fork-tint` | #FFD9CB | Fork value pills on paper |
| `--rs-fork-deep` | #4A1F2A | Fork half of split backgrounds |
| `--rs-space` | #070913 | Page background behind the globe |
| `--rs-hud` | #151B2E | Dense dark surfaces (dashboard tables) |
| `--rs-text-on-dark` / `--rs-muted-on-dark` | #E9ECF2 / #A3ABBD | Text on dark surfaces |
| `--rs-muted-on-paper` | #5B6170 | Secondary text on paper |
| `--rs-good` / `--rs-bad` | #0F7A3A / #C2362B | Change arrows on paper (always paired with ▲/▼) |
| `--rs-good-on-dark` / `--rs-bad-on-dark` | #5CD98A / #FF7B7B | Change arrows on dark surfaces |

**Government branches** use a separate categorical set (`--rs-branch-*`: yellow, blue, green, lilac, pink, sand, grey) that deliberately avoids teal and coral. They're for the power-map graph only, always as fills with ink outlines and text labels.

The product is dark-first: the globe always sits on `--rs-space`, and paper panels float above it. There is no separate light theme.

## Typography
| Role | Font | Size / line-height | Weight | Tracking |
|---|---|---|---|---|
| Hero | Fredoka | `--rs-text-hero` / 1.0, ink stroke + 4px ink shadow | 700 | 0 |
| Page title (H1) | Fredoka | `--rs-text-2xl` / 1.05 | 700 | 0 |
| Panel title (H2) | Fredoka | `--rs-text-xl` / 1.0 | 700 | 0 |
| Button | Fredoka | `--rs-text-lg` / 1 (primary), `--rs-text-md` (secondary) | 700 | 0 |
| Body | Plus Jakarta Sans | `--rs-text-md` / 1.45 | 500 | 0 |
| Panel body / stats | Plus Jakarta Sans | `--rs-text-sm` / 1.4 | 700 | 0 |
| Eyebrow / chip | Plus Jakarta Sans or JetBrains Mono | `--rs-text-2xs`–`xs` | 800 / 700 | `--rs-tracking-label` |
| Numbers in pills and tables | JetBrains Mono | `--rs-text-sm` | 700 | 0, tabular |

Fonts load from Google Fonts with `display=swap`: three families and six weights in total.

## Layout & spacing
- **Base unit:** 4px. Use only `--rs-space-1` to `--rs-space-7`.
- **Globe screens:** the globe fills the viewport. Header across the top, dossier panel top-right (a bottom sheet on phones), event feed bottom-left.
- **Content pages** (Hall, Wall, Dashboard): max width 1200px, 16px gutters on phones and 24px on desktop.
- **Rhythm:** one hero moment per screen. Everything else stays compact.

## Shape & depth
- **Borders:** every floating surface gets `--rs-border` (3px ink). Inner elements get `--rs-border-thin`.
- **Radius:** `--rs-radius-sm` for pills, flags and tiles; `--rs-radius-md` for buttons, chips and inputs; `--rs-radius-lg` for panels and dialogs.
- **Elevation:** hard offset ink shadows only, never blurred. Chips and toasts use `sm`, cards `md`, hero panels and the globe `lg`.
- **No glassmorphism, no glows, no gradients** except the teal-to-coral drift bar, which is data.

## Signature moves
1. **The fork split:** reality on the left in teal, your fork on the right in coral, with a zig-zag "torn map" seam between them. Used on the landing intro and in forked worlds (`/play/:id`).
2. **Real-versus-fork pills:** any stat that exists in both worlds shows two side-by-side pills (teal tint for real, coral tint for fork), followed by a drift meter.
3. **Press-down buttons:** chunky buttons with an ink drop shadow that physically sink when pressed.
4. **Cartoon cartography:** the illustrated globe gets a thick ink outline and an offset shadow, and event pins are ink-outlined tiles.

## Imagery & iconography
- **Imagery:** the illustrated Earth texture (`public/earth-cartoon.*`) is the hero image. Forked worlds show the same texture hue-shifted toward coral. Never use stock photos.
- **Icons:** the hand-drawn set in `src/lib/gameArt.ts`. Each is a 32px tile with a 3px ink outline, a flat fill and a 2.5px ink glyph stroke. Add new icons in the same style. **No emoji in UI.**
- **Flags:** from `flag-icons` with a 2px ink border and an `sm` shadow.

## Motion
- **Durations and easing:** `--rs-dur-fast` (button press), `--rs-dur-med` (hovers, tabs), `--rs-dur-slow` with `--rs-ease-pop` (toasts popping in, bars filling).
- **Signature interactions:** the button press, toasts popping in, and the newest event's pin pulsing.
- **Reduced motion:** `prefers-reduced-motion` zeroes every duration token, and components must use the tokens so this works.

## Components
- **Buttons:**
  - Primary: sun fill, ink border, press shadow. At most one per view.
  - Secondary: paper fill with the same border and shadow.
  - Text links: ink or sun with an underline on hover.
  - Minimum height 44px.
- **Chips:** an ink border, an `sm` shadow and an uppercase mono label. Teal chips are for reality, coral for the fork, ink for neutral tags.
- **Panels:** paper, `--rs-border`, `--rs-radius-lg`, `--rs-shadow-lg`, 16px padding.
- **Stat rows:** label on the left; value plus change arrow on the right; an ink-outlined meter below, with a sun tick marking last turn.
- **Tables (dashboard):** on `--rs-hud`, with `--rs-hud-line` dividers and mono numbers. Column headers are uppercase `2xs`.
- **States:**
  - Loading: describe what's loading ("Loading indicators…"). No bare spinners.
  - Empty: say what will appear and how ("No events yet. The world moves every turn.").
  - Error: plain words plus a way out.

## Do / Don't
| Do | Don't |
|---|---|
| Teal for real, coral for fork, everywhere | Use teal or coral as generic decoration |
| One sun-yellow primary action per view | Put yellow on several buttons at once |
| Hard ink shadows (offset 3, 5 or 8px) | Blurred drop shadows, glows, glass |
| Hand-drawn SVG icons | Emoji or generic outline icon packs |
| "Take over the United States!" | "🎮 TAKE OVER UNITED STATES" |
| Ink text on teal or coral fills | Teal or coral text on paper (fails contrast) |

## Accessibility
- **Contrast:** 4.5:1 for body text, 3:1 for large text and UI parts. Visible focus is `--rs-focus` (3px sun) with a 3px offset. Touch targets are at least 44px. Colour is never the only signal: changes use ▲/▼ and pills carry a REAL or FORK header.
- **Contrast matrix (WCAG 2.1):**

| Pair | Ratio | Result |
|---|---|---|
| ink on paper | 18.8 | ✅ |
| muted-on-paper on paper | 6.1 | ✅ |
| ink on sun | 13.6 | ✅ |
| ink on real | 7.7 | ✅ |
| ink on fork | 6.8 | ✅ |
| ink on real-tint / fork-tint | 15.9 / 14.6 | ✅ |
| paper on real-deep / fork-deep | 11.8 / 13.6 | ✅ |
| real on real-deep, fork on fork-deep | 4.9 / 4.9 | ✅ |
| text-on-dark on hud | 14.5 | ✅ |
| muted-on-dark on hud | 7.4 | ✅ |
| sun / fork / real on hud | 12.1 / 6.0 / 6.9 | ✅ |
| good / bad on paper | ≥5.3 | ✅ |
| good-on-dark / bad-on-dark on hud | 9.6 / 6.8 | ✅ |
| fork on paper | 2.8 | ❌ fills only, never text |
| real on paper | 2.4 | ❌ fills only, never text |

## SEO & metadata
- **Title format:** `<Page> · RealityShift` (30–60 chars). The home page is "RealityShift · Take over a country, fork the world".
- **Description:** in the brand voice, specific to the page, 70–160 chars.
- **Social image:** 1200×630 in the split-globe composition with the wordmark, at `public/og-image.png`.
- **Favicon:** the wordmark's coral slash on a sun tile with an ink outline.
- **Headings:** one H1 per page, with no skipped levels. The globe screen's H1 is the visually hidden product name, and the dossier title is an H2.
