# AgentOS — Brand Rule Set

> **The world is the product.** We don't sell "AI agents." We show a living company
> that builds itself — and let people watch value being made.
>
> Source concept: `agent-platform/design/living-world-concept.html`.
> Direction: **Apple × LEGO × Tiny Glade × Monument Valley.**
> This file is the single source of truth. If something on the site or in the product
> fights these rules, the rules win.

---

## 1. The one-line north star

**Build a company that builds itself.**

Warm, hand-made, alive, calm, confident. A cozy little world you want to reach into —
not a dashboard, not a cockpit, not a neural-net light show.

---

## 2. What we are moving AWAY from (hard bans)

These are the "traditional AI meh" clichés. **Never ship them.**

- ❌ **Purple-on-black.** No dark "space canvas," no near-black (#070810) surfaces, no
  iris/violet neon gradients as the dominant look. (A single soft-lavender *department*
  accent is fine; a purple *brand* is not.)
- ❌ Neon glows, cyber grids, glassmorphism-on-black, "AI" gradient meshes.
- ❌ Robots, circuit boards, brains, "neural" nodes, sci-fi HUDs.
- ❌ Cold grays, pure `#000`, harsh pure-white cards, techy monospace everywhere.
- ❌ Frantic, gamey motion; particle bursts; anything that reads "loading a mech."
- ❌ Jargon on the surface: "LLM," "tokens," "agentic," "vector DB." We say people,
  teams, an economy, work, growth.

If a screen could belong to any other AI startup, it is wrong.

---

## 3. The world & materials

A miniature, sunlit diorama built from soft, matte, toy-like pieces.

- **Materials:** rounded, soft-edged solids (like painted wood / LEGO / clay). Floor-to-
  ceiling **glass** so you can see the people inside, level to level. Warm key light, soft
  contact shadows, gentle ambient occlusion. Filmic (ACES) tone, never blown-out.
- **Inhabitants:** little "citizen" figures (a pawn/person hybrid) in their department
  color, doing real work — sitting, typing, standing, glancing around. Calm, not busy.
- **Scale mechanic:** taller building = bigger team (floors encode headcount). Growth is
  shown by the world *growing*: one worker → a team → a company → a small city.
- **Ground:** grass, soil, a few clean trees. Warmth over detail. No visual noise.

---

## 4. Palette (roles + hexes)

Warm paper world first. Color identifies *who* (departments) and rewards *value* (gold).

### Surfaces & ink — LIGHT (default)
| Role | Hex |
|---|---|
| Canvas / sky | `#E9F0EF` → `#F7F2EA` (soft gradient) |
| Paper / card | `#FFFFFF`, warm cream `#F0E6D4`, `#EFE4D0` |
| Ink (primary) | `#241F18` (warm near-black-brown, **not** pure black) |
| Ink (muted / subtle) | `#5C554A` / `#8C8474` |
| Hairline | `rgba(36,31,24,.10)` |

### Surfaces & ink — DARK MODE (dusk, **not** cyber)
Deep warm **blue-slate**, never black, never purple.
| Role | Hex |
|---|---|
| Canvas | `#20273f` → `#171c2e` |
| Panel | `#212840` |
| Ink | `#F3EFE6` / `#B7B1A4` |

### Ground
Grass `#93C489` `#8FBE79` `#9FCB88` `#7FB06B` · Soil/wood `#C7A278` `#9C7A50`

### Accents (use sparingly, with meaning)
| Role | Hex | Meaning |
|---|---|---|
| **Coral** (primary CTA / energy) | `#ED7150` (deep `#CE5330`) | action, "go", the moving task |
| **Gold** (reward) | `#F0BE4D` `#EDBE5E` `#FFCF6E` | revenue, value made, level-up |

### Department colors (the teams / citizens)
| Dept | Hex |
|---|---|
| Sales | `#5A97D6` (blue) |
| Support | `#4FB0AA` (teal) |
| Finance | `#E6AE3C` (amber) |
| Operations | `#E08A5B` (orange) |
| Engineering | `#8B79D4` (soft lavender — the *only* purple, and only here) |
| Marketing | `#E06A9A` (pink) |

**Rule:** color follows the entity (a department keeps its hue everywhere). Coral and gold
are reserved for action and reward — never used as a seventh department color.

---

## 5. Typography

- **Family:** humanist system sans — `-apple-system, BlinkMacSystemFont, "SF Pro Display",
  "Segoe UI", system-ui, …`. Friendly, not techy.
- **Headlines:** large, tight, confident. `font-weight: 800`, `letter-spacing: -.03em`,
  balanced wrapping. They should feel spoken, not shouted.
- **Eyebrows / labels:** mono, uppercase, wide tracking (`.14em`–`.22em`), small, muted.
- **Body:** relaxed line-height (~1.5–1.6), muted warm ink. Plain language.

---

## 6. Motion

Calm, physical, ambient — the world breathes; it never performs.

- **Signature ease:** `cubic-bezier(.18,1.25,.4,1)` — a gentle overshoot "settle."
- Build-ins land like a real object: drop + slight overshoot, a quick settling turn, a
  roof that spins once into place. Then stillness.
- Idle life is subtle: a soft bob, a head-turn, a task token drifting between teams, a coin
  popping when revenue lands. Loop lengths are slow (10–20s).
- Respect `prefers-reduced-motion`: freeze to a composed still frame.
- **Never:** springy UI everywhere, flashing, parallax overload, spinner theater.

---

## 7. Voice

Plain, human, warm, quietly confident. Short sentences. Concrete nouns.

- Say: *workers, teams, an economy, work, hand-offs, growth, value, revenue.*
- Avoid: *LLM, agentic, tokens, inference, vector store, orchestration* (in surface copy).
- Examples that are on-brand:
  - "Build a company that builds itself."
  - "You don't have workers. You have an economy."
  - "Every worker has a job."
  - "See how work actually flows."

---

## 8. Product UI language (dashboards, panels, app screens)

The app is part of the world — it must feel like the **same warm brand**, not a separate
dark "SaaS product."

- **Warm paper surfaces** (cream/white cards on the soft canvas), warm ink, soft shadows,
  generously rounded corners. Dusk **blue-slate** in dark mode.
- Data color uses the **department hues + gold**; coral for primary actions. No iris/violet
  system, no black chrome, no neon.
- Charts and metrics are calm and legible (see the `dataviz` rules): thin marks, one hue per
  measure, direct labels, no rainbow, no glow.
- Avatars, status, and accents stay in the department palette. Status: active = a warm green,
  thinking = gold, idle = muted warm gray, error = coral-red.
- The same soft-toy, sunlit feeling as the 3D world — a cozy tool, not a cockpit.

---

## 9. Quick test before shipping any screen

1. Could this belong to any other AI startup? → if yes, it's off-brand.
2. Is the dominant feel **warm paper + sunlight**, or dark/purple/neon? → must be the former.
3. Does color mean something (who / action / reward), or is it decoration?
4. Is the motion calm and physical, or busy and gamey?
5. Is the copy plain and human, or full of AI jargon?
