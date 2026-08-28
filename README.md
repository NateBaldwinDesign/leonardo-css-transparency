# Dynamic color system — prototype

Authors **color scales** and **contrast swatches**, then generates a **CSS-only dynamic
color palette**: each color is produced from its scale to hit a target contrast against the
container's background, at paint time. Compares this "Dynamic" approach against the two old
ways (opaque scale pick, CSS opacity). Surface design is documented in `SURFACES-PLAN.md`; a
full, portable spec for reimplementing these concepts lives in `knowledge-transfer/` (start at
`AGENTS.md`).

## The core idea

Instead of shipping fixed color tokens, ship a **scale + a pure-CSS function**. The engineer
writes `class="brand tint-fg" style="--contrast: var(--contrast-200)"` and sets `--bg` once on
a container; the CSS follows the scale to the color that hits that contrast — a translucent
**linear blend** composited in linear-light sRGB, so the WCAG contrast is exact. (Optical /
constant-hue is intentionally absent: it needs an iterative solve and can't be a pure-CSS
function, which would break the CSS-only purpose.)

## The tool

Two columns: **left controls · main stage (palette + preview)**. There is no separate right panel;
the detail strip lives inside the Contextual-evaluation tab.

**Left — three tabs under the Background input:**
- **Contrast swatches** — target-ratio sliders (step 0.01), auto-sorted low→high, exported as
  `--contrast-100/200/300…` (renumbered by position on delete; min 1). Default ladder:
  `1.06, 1.15, 1.32, 1.6, 2, 2.6, 3.22, 3.95, 4.79, 6.29, 7.9, 10, 12.3, 14.8, 17, 19.5`.
  Selecting/dragging one makes it the *active* contrast (drives the preview + detail strip).
- **Color scales** — a global settings block on top (**Contrast side**, **Extremity offset**,
  **Extremity × contrast**), then a stacked, named, add/removable scale list. Selecting a scale
  opens its gradient + stop editor (hue / chroma / lightness, add/delete stop). New scale =
  an empty grayscale (one chroma-0 stop) you then color; deleting the last scale resets it to
  one gray stop (name kept). *No
  intended/source markers in this editor.*
- **Surfaces** — named backgrounds (the "Surfaces v2" model; see `SURFACES-PLAN.md`). The **base**
  (`bg`, from the Background input; not deletable) plus surface **types**, each defined by
  **tint × reference × contrast**: a **source** (the base color, or a scale for a hue), a
  **reference** (`parent` = the surface it sits on, or `base` = the root, for overlays), and a
  target **contrast** vs that reference. Lighter by default, auto-**swapping darker** at caps, with
  a per-surface **force darker** override. Each row also has a preview **role** and a **show in
  preview** toggle. Exported as one `.surface-<name>` class per type (+ a `.s-content` wrapper for
  parent-relative types); surfaces compose by nesting.

**Main — its own two tabs (independent of the left panel):**
- **Color ramps** — the palette grid, with **Opaque** / **CSS Opacity** comparison toggles, a
  **Show contrast values** toggle, and a **Surface picker** (which surface the ramps evaluate
  against; default `bg`). Per scale: a **Dynamic** row (always) plus **Opaque** / **Transparent**
  rows (per toggle), one swatch per contrast. Rows for one color **touch (0-gap)** for direct
  comparison; contrast columns are labeled. ("Ramp" = the fixed value steps; a "scale" is the
  underlying fluid function.)
- **Contextual evaluation** — a **Color scale** picker, a **Contrast swatch** picker, a **Nest
  depth** slider (default 2, max 4), and a **Method detail** toggle (off by default). Renders a
  **usage-shaped surface tree**: a recursive spine of nesting surfaces (each level shows a
  "Generated color" swatch), with "applied" surfaces (e.g. info/error) rendered on *every* level
  and "once" surfaces (overlays) rendered a single time on the base. Turning on **Method detail**
  reveals the **Dynamic / Opaque / Transparent** 3-up (measured contrast) under each swatch. Below,
  a **"Where the color comes from"** strip shows every scale as a read-only gradient with
  **▾ intended** / **▲ source** markers for the selected contrast (against the base surface).

## The three comparison methods

For a scale, the `--bg`, and a target contrast T:
- **Dynamic** — a saturated scale source (chosen via the extremity curve) faded over `--bg` in
  linear light to hit T exactly. Background-dependent, keeps chroma. *This is what exports.*
- **Opaque** — the plain scale color at T's luminance (exact; the classic "pick a color at the
  ratio").
- **Transparent** — the exact same source + alpha as Dynamic, but applied with **real CSS
  `opacity`** over `--bg` (gamma-composited) — shows how naive opacity misses the target.

**Chroma-guard** is a readout only: ΔE_OK (OKLab distance) between Dynamic and Opaque, with a
threshold warning when the tint has drifted far.

## Export ("Show CSS")

Adds to a minimal base (`--level-ui/aa/aaa`, `.tint-fg`/`.tint-bg`):
- **Surfaces** — `:root { --bg; --surface-base }` plus one **`.surface-<name>`** class per type
  (contrast/polarity/tint logic baked into the CSS) and a **`.s-content`** wrapper for
  parent-relative types. Nest surfaces to compose.
- **`--contrast-100/200/…`** tokens (the swatch values).
- **One function class per named scale** (`.silver`, `.blue`, …), each baking that scale's ramp
  anchors; the function reads `--bg` + `--contrast`, picks a source via the (global) extremity
  curve, and fades it to hit the contrast — pure CSS, exact.
- A reference hex palette per scale (`--blue-50…950`) for eyeballing.

Usage:
```html
<div class="surface-raised"><div class="s-content">
  <span class="blue tint-fg" style="--contrast: var(--contrast-200)">…</span>
</div></div>
```

Verified: every scale × every `--contrast-*` token resolves to the target contrast exactly,
on light and dark backgrounds. Tool preview and export share one code path, so what you see
matches what ships.

## Files

| File | Role |
|---|---|
| `index.html` | Markup only — panels/tabs, and a `<script src="./app.js">`. |
| `app.js` | All tool logic: state model, color math, generation, panels, export. |
| `style.css` | Layout (two-column grid), tabs, lists, gradient/stop editor, palette, preview, detail. |
| `SURFACES-PLAN.md` | Design + rationale for the Surfaces model (and the preview tree). |
| `knowledge-transfer/` | Portable, framework-agnostic spec for reimplementing these concepts. |
| `AGENTS.md` | Entry point for AI agents → points at `knowledge-transfer/`. |
| `build/compile.mjs` | Legacy static single-scale exporter (superseded by the in-tool export). |

## Run

```bash
cd transparent-color-proto
python3 -m http.server 8712   # open http://localhost:8712
```

Serve over HTTP (opening the file directly blocks the linked CSS). Needs a browser with
relative color syntax `color(from …)` and `contrast-color()`.
