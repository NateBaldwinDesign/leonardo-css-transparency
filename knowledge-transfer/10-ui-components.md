# 10 · UI components

The authoring UI. **All UI here is 🟢 ADAPTABLE** — reimplement idiomatically in the target
framework. What's tagged 🔴/🟡 is *behavior that must survive* if the target keeps that component.
Layout is a two-column grid: left **controls** · right **stage** (main previews).

## Left panel: three tabs (Contrast swatches · Color scales · Surfaces) 🟢
Tab state in `ui.tab`; only one pane visible. A **Background** color input sits above the tabs and
drives the base surface color (and, in the `12` proposal, the background scale's key color).

### Contrast swatches tab 🟡
- A sorted list of target ratios; each row: label `--contrast-N`, value, delete, and a range slider
  (`min 1, max 21, step 0.01`).
- **Behavior that must survive (🔴):** tokens are named `--contrast-<(i+1)*100>` by **ascending
  sorted position** (so editing/adding renumbers); step `0.01` preserves 2-decimal ratios; there's
  always ≥1 swatch.
- Selecting/dragging a swatch sets it "active" (drives the eval preview's default contrast). 🟢

### Color scales tab 🟢
- Global settings block: **Contrast side** (auto/light/dark), **Extremity offset**, **Extremity ×
  contrast (steepness)** — these feed `settings` and thus `genColors`. 🟡 (behavior)
- A list of scales (add/remove/select). New scale = a single chroma-0 gray stop. Deleting the last
  scale resets it to one gray stop (name kept). 🟡
- **Selected-scale editor:**
  - Editable **name** (sanitized to `[a-z0-9-]`, becomes the CSS class/var). 🟡
  - A **gradient bar** of the ramp; **stops** are draggable handles (drag = change lightness;
    click = select; double-click bar = add stop). 🟢
  - **Stop controls (all views of one stop's L/h/c):** an sRGB **color picker** (input type=color)
    *and* three OKLCh sliders (hue 0–360, chroma 0–100, lightness 2–99). They are **interdependent**:
    editing the picker updates the sliders (via `linToOklch`) and vice-versa; the picker is sRGB-
    clamped while sliders are not. 🟡 (this two-way binding is a nice authoring affordance).
  - Add/delete stop.
- **Performance (🟡):** slider/picker/drag inputs go through `scheduleRefresh()` (rAF-throttled) so a
  drag doesn't rebuild the whole CSS+palette every event.

### Surfaces tab 🟢
Per surface row (non-base): a color chip, editable name, delete, and controls:
- **Tint** select: `Base color` or a scale name → `surf.source`.
- **vs** select: `parent` / `base` → `surf.reference`.
- **preview** select: `auto (<derived>)` / nests-in-itself / applied-on-each / once-on-base / hidden
  → `surf.previewRole` (see `09`).
- **Contrast** slider (`step 0.01`, max 3, or 12 when "expanded contrast range" is checked).
- **show in preview** checkbox → `surf.showInPreview`.
- **force darker** checkbox → `surf.forceDark`.
- The base surface row just shows "base".

## Main area (stage): two independent tabs 🟢

### Color ramps (palette) 🟢
A grid: per scale, a **Dynamic** row always, plus optional **Opaque** / **Transparent** rows
(toggles), one swatch per contrast column (columns labeled `--contrast-N`). Toggles:
- **Opaque scale comparison**, **CSS Opacity scale comparison** — show the comparison rows.
- **Show contrast values** — label every swatch with measured contrast.
- **Show opacity** — on Transparent swatches only, show the per-swatch opacity %.
- **Surface** picker — which surface the ramps evaluate against (sets the palette `--bg`).
- **Behavior that must survive (🔴 if kept):** Dynamic swatches are painted via the injected CSS API
  (`class="<scale> tint-bg"` with `--bg`/`--contrast`), **not** hardcoded hex — this validates the
  export. Transparent swatches render the **source color at its alpha** (`rgb(r g b / a%)`), not a
  pre-composited hex, so the DOM shows what's referenced + its transparency.

### Contextual evaluation 🟡
The surface tree (see `09`) + a "Where the color comes from" detail strip (each scale as a read-only
ramp with `▾ intended` / `▲ source` markers for the selected contrast). 🟢

## Export panel 🔴 (behavior) / 🟢 (UI)
A "Show CSS" toggle reveals a textarea with the full generated library (`buildLibrary`, see `07`).
The same string is what's injected live for dogfooding.
