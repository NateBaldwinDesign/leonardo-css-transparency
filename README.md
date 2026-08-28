# Dynamic color system — prototype

Authors **color scales** and **contrast swatches**, then generates a **CSS-only dynamic
color palette**: each color is produced from its scale to hit a target contrast against the
container's background, at paint time. Compares this "Dynamic" approach against the two old
ways (opaque scale pick, CSS opacity). Built per `ENHANCEMENT-PLAN.md`.

## The core idea

Instead of shipping fixed color tokens, ship a **scale + a pure-CSS function**. The engineer
writes `class="brand tint-fg" style="--contrast: var(--contrast-200)"` and sets `--bg` once on
a container; the CSS follows the scale to the color that hits that contrast — a translucent
**linear blend** composited in linear-light sRGB, so the WCAG contrast is exact. (Optical /
constant-hue is intentionally absent: it needs an iterative solve and can't be a pure-CSS
function, which would break the CSS-only purpose.)

## The tool

Three columns: **left controls · main (palette + preview) · right detail panel**.

**Left — two tabs under the Background input:**
- **Contrast swatches** — target-ratio sliders, auto-sorted low→high, exported as
  `--contrast-100/200/300…` (renumbered by position on delete; min 1). Default 1.4/3/4.5/7.
  Selecting/dragging one makes it the *active* contrast (drives the preview + detail panel).
- **Color scales** — a global settings block on top (**Contrast side**, **Extremity offset**,
  **Extremity × contrast**), then a stacked, named, add/removable scale list. Selecting a scale
  opens its gradient + stop editor (hue / chroma / lightness, add/delete stop). New scale =
  an empty grayscale (one chroma-0 stop) you then color; deleting the last scale resets it to
  one gray stop (name kept). *No
  intended/source markers in this editor.*
- **Surfaces** — named backgrounds. The **base** (`bg`, from the Background input above; not
  deletable) plus added surfaces, each defined by a **contrast relative to the previous layer**.
  Surfaces go **lighter by default**, automatically **swapping darker** when the lighter side
  caps (e.g. a white base), with a per-surface **force darker** override. They keep the theme
  hue (blend toward white/black). Each is renameable (rename sets its CSS var). Exported as a
  chained `:root` block (`--_s0…N` with the contrast/polarity logic in the CSS, plus public
  `--bg`, `--layer-1`, … aliases) so the surfaces self-compute — assign one to `--bg` on a
  container.

**Main — its own two tabs (independent of the left panel):**
- **Color ramps** — the palette grid, with **Opaque** / **CSS Opacity** comparison toggles, a
  **Show contrast values** toggle, and a **Surface picker** (which surface the ramps evaluate
  against; default `bg`). Per scale: a **Dynamic** row (always) plus **Opaque** / **Transparent**
  rows (per toggle), one swatch per contrast. Rows for one color **touch (0-gap)** for direct
  comparison; contrast columns are labeled. ("Ramp" = the fixed value steps; a "scale" is the
  underlying fluid function.)
- **Contextual evaluation** — a **Color scale** picker + a **Contrast swatch** picker, then a
  **nested "doll" of `surfacePreview`s** — each surface renders its contents, with the next
  surface nested to the right *inside* it, so layers sit visually within their parent. Each card
  is on that surface's background and shows the generated fill, sample text, the
  **Dynamic / Opaque / Transparent** 3-up (measured contrast), and a per-surface ΔE readout, all
  evaluated against that surface. Both pickers
  **auto-sync** to your latest panel selection (editing `--contrast-300` or selecting `--color2`
  pre-selects them). Below, a **"Where the color comes from"** section shows every scale as a
  read-only gradient with **▾ intended** / **▲ source** markers for the selected contrast (against
  the base surface).

The layout is two columns (controls · main); there is no separate right panel.

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
- **Surface tokens** — a chained `:root` block: private `--_s0…N` carrying the contrast/polarity
  logic (each lighter than the previous to hit its target contrast, swapping darker at caps),
  plus public `--bg` / `--layer-1` / … aliases. Assign one to `--bg` on a container.
- **`--contrast-100/200/…`** tokens (the swatch values).
- **One function class per named scale** (`.brand`, `.accent`, …), each baking that scale's
  ramp anchors; the function reads `--bg` + `--contrast`, picks a source via the (global)
  extremity curve, and fades it to hit the contrast — pure CSS, exact.
- A reference hex palette per scale (`--brand-50…950`) for eyeballing.

Usage:
```html
<div style="--bg: var(--bg)">   <!-- or any surface: var(--layer-1) -->
  <span class="brand tint-fg" style="--contrast: var(--contrast-200)">…</span>
</div>
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
| `ENHANCEMENT-PLAN.md` | The plan this was built to. |
| `build/compile.mjs` | Legacy static single-scale exporter (superseded by the in-tool export). |

## Run

```bash
cd transparent-color-proto
python3 -m http.server 8712   # open http://localhost:8712
```

Serve over HTTP (opening the file directly blocks the linked CSS). Needs a browser with
relative color syntax `color(from …)` and `contrast-color()`.
