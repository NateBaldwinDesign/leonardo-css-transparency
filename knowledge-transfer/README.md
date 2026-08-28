# Knowledge Transfer — Dynamic Color System

This directory is a **portable, framework-agnostic knowledge pack** describing a working
prototype ("Leonardo CSS Transparency" / "Dynamic color system"). It exists so that **another AI
agent** can either (a) plan and build a **net-new project** on arbitrary frameworks, or (b) plan a
**set of revisions to an existing tool**, reusing these concepts accurately.

The source prototype is a single-page tool: `index.html` (markup), `app.js` (all logic),
`style.css` (layout). No build step, no dependencies, no framework. Serve over HTTP and open.

---

## How to use this pack (instructions for the consuming agent)

1. **Read in order.** Files are numbered by *specificity*, from goals → strategy → architecture →
   implementation specifics. Read `01`→`12` before proposing a plan.
2. **Honor the criticality tags** (legend below). They tell you what must be preserved to keep the
   concept intact versus what you may redesign to fit the target stack.
3. **Do not assume the target framework.** The prototype is vanilla JS/CSS. Everything marked
   🟢 ADAPTABLE (state storage, DOM rendering, component structure, styling) should be re-expressed
   idiomatically in the target framework. Everything marked 🔴 CRITICAL is math/CSS-semantics that
   must be reproduced *exactly* or the output will be visibly wrong (contrasts will miss target).
4. **The exported CSS is the product.** The tool is an authoring UI around a **pure-CSS output**.
   If the target is a runtime library, the generator (`07-css-export.md`) is the heart of it. If the
   target is a design tool, the whole pack applies.
5. **When a formula appears, treat it as a spec.** Reproduce it verbatim; verify with the
   acceptance tests in each file (they state expected numeric results).
6. **`12-open-directions.md` is NOT implemented.** It records in-flight design intent. Treat it as
   direction, not fact.

---

## Installing into a target project (for the human)

Agents read what's in the repo they're working in. So **copy this pack into the target project** —
don't reference it from another repo.

1. Copy the whole **`knowledge-transfer/`** folder into the target repo (root, or `docs/`).
2. Copy the harness pointer file so every session auto-loads this pack:
   - **Claude Code** → copy `CLAUDE.md` (it `@import`s `knowledge-transfer/README.md`).
   - **Cursor / other tools** → copy `AGENTS.md` (same guidance, cross-tool convention).
   - If the target already has one of these, append its "read `knowledge-transfer/` first" section.
3. Keep `knowledge-transfer/` at the repo root, or update the `@` import path in `CLAUDE.md`.
4. Commit them so they're versioned with the project.
5. First session: still say explicitly *"Read `knowledge-transfer/README.md` then `01`–`12`, honor
   the criticality tags,"* since large auto-loaded context can be summarized.

**Self-contained:** the exact default data is inlined in `11-state-management.md`, so this pack does
**not** require the reference `app.js` to reimplement. (Bringing `app.js` is still nice as a
runnable reference, but not required.)

## Criticality legend

Every non-obvious decision in this pack is tagged. Apply the tag, not your own priors.

- 🔴 **CRITICAL** — Core to the concept. Must be retained/reproduced exactly. Changing it breaks
  the value proposition (colors won't hit target contrast, output won't be pure CSS, etc.).
- 🟡 **RECOMMENDED** — Strong default with a real rationale. Keep unless the target has a specific
  reason to differ; document any deviation and its behavioral cost.
- 🟢 **ADAPTABLE** — Implementation choice (framework, storage, DOM, styling, layout, naming). Free
  to redesign to fit the target project. The *behavior* may need to survive; the *mechanism* need not.

---

## Reading order / file map

| # | File | Layer | What it answers |
|---|---|---|---|
| — | `README.md` (this) | Meta | How to consume the pack; legend; glossary |
| 01 | `01-goals.md` | **Goals** | Primary purpose, problem, who it's for, non-goals |
| 02 | `02-strategy.md` | **Strategy** | High-level objectives, strategic decisions + rationale, invariants |
| 03 | `03-architecture.md` | **Execution** | Module map, data flow, the shared generation path, dogfooding |
| 04 | `04-color-math.md` | **Specifics** | Color spaces, conversions, contrast, gamut, ΔE (exact formulas) |
| 05 | `05-scales.md` | **Specifics** | Scale model, ramp, anchors, neutral detection |
| 06 | `06-dynamic-generation.md` | **Specifics** | `genColors`: the core algorithm (Dynamic/Opaque/Transparent) |
| 07 | `07-css-export.md` | **Specifics** | The pure-CSS generation technique (the product) |
| 08 | `08-surfaces.md` | **Specifics** | Surfaces: tint × reference × contrast; composition; export |
| 09 | `09-contextual-evaluation.md` | **Specifics** | The usage-shaped preview tree (roles, depth) |
| 10 | `10-ui-components.md` | **Specifics** | Each UI component + its criticality |
| 11 | `11-state-management.md` | **Specifics** | DEFAULTS, hydration, ui state, refresh loop, dogfood injection |
| 12 | `12-open-directions.md` | **Direction** | In-flight proposals + deferred items (NOT implemented) |

---

## Glossary (used throughout)

- **Scale** — a color family defined by *key stops* of hue/chroma across lightness; interpolated
  into a 33-step **ramp**. Analogous to a Leonardo/Radix color scale, but authored as functions of
  lightness. NOT a fixed list of tokens.
- **Ramp** — the sampled 33-step realization of a scale (linear-sRGB + luminance + hex per step),
  sorted by luminance.
- **Anchors** — a compressed 8-point piecewise-linear approximation of a ramp (black + 6 samples +
  white), keyed by luminance. This is what the exported CSS bakes in. 🔴
- **Dynamic color** — the shipped method: a saturated scale *source* faded over a background in
  **linear light** to hit a target WCAG contrast **exactly**, computed at paint time in pure CSS.
- **Opaque** — comparison method: the plain scale color at the target luminance (a classic token pick).
- **Transparent** — comparison method: the same source applied with real CSS `opacity` (gamma
  compositing) — demonstrates how naive opacity misses target.
- **Contrast swatch / token** — a target WCAG ratio, exported as `--contrast-100`, `-200`, …
- **Surface** — a named background derived by a target contrast vs a *reference* (its parent, or the
  base), tinted from a *source* (the base color, or a scale). "Elevation" = a surface + shadow (future).
- **Extremity curve** — how far toward the light/dark extreme the faded *source* is chosen, per
  contrast. Controls chroma retention. Governed by `extOffset` + `extSteep`.
- **`--_luma` text-token trick** — a CSS technique where custom properties hold *unresolved
  expressions* referencing `r`/`g`/`b`, which only resolve inside a `color(from … srgb-linear …)`
  context. This is what makes the whole system pure-CSS. 🔴 See `07-css-export.md`.
- **Dogfooding** — the tool injects its own exported CSS live and renders its previews *through*
  that CSS, so what you see is what ships.
