# 03 · Architecture (Execution)

How the pieces fit together and how data flows. The prototype is ~730 lines of vanilla JS in one
IIFE (`app.js`), plus `index.html` (markup) and `style.css` (layout).

## Module map (by section, in `app.js`)

| Section | Responsibility | Criticality |
|---|---|---|
| Color conversions | sRGB↔linear, OKLab/OKLCh, luminance, contrast, gamut clamp, ΔE | 🔴 math |
| Scale ramp + anchors | stops→ramp (33 steps)→anchors (8 pts); neutral test | 🔴 math |
| Generation (`genColors`) | the Dynamic/Opaque/Transparent algorithm; **shared by preview + export** | 🔴 |
| DEFAULTS | single data object: background, scales, contrasts, surfaces, extremity | 🟡 data |
| State | hydrate DEFAULTS → live arrays w/ ids; `ui` object; derived getters | 🟢 |
| Elements + tabs | DOM refs; left tabs; main tabs | 🟢 |
| Contrast swatches | list UI + `--contrast-N` labeling | 🟢 UI / 🔴 tokens |
| Scales UI | scale list, gradient + stop editor (sliders + color picker) | 🟢 UI |
| Surfaces UI | per-surface controls (source, reference, contrast, role, …) | 🟢 UI |
| Palette (ramps) | grid of Dynamic/Opaque/Transparent swatches per scale×contrast | 🟢 UI |
| Preview (eval) | usage-shaped surface tree | 🟢 UI / 🟡 model |
| Detail panel | "where the color comes from" ramp markers | 🟢 UI |
| Export (`buildLibrary`) | assemble the pure-CSS library string | 🔴 |
| Refresh + init | rebuild genStyle, re-render everything | 🟡 |

## The central data flow 🔴

```
DEFAULTS ──hydrate──► live state (scales/contrasts/surfaces + ui)
                              │
                    user edits (sliders, pickers, tabs)
                              │
                          refresh()
                    ┌─────────┴───────────────────────────┐
                    │                                       │
             buildLibrary()  ── injects ──► <style> (genStyle, in <head>)
                    │                                       │
             (same math via genColors / scaleData)          │  the page's own previews
                    │                                       │  are painted BY this CSS
             renderPalette(), renderPreview(),  ◄───────────┘  (dogfooding)
             renderDetail(), refresh*Chips/Labels
```

Key point: **`refresh()` rebuilds the entire exported CSS string on every change and injects it**,
then re-renders the previews which *use* that CSS (via `class="<scale> tint-bg"` etc.). The tool is
therefore always showing its own output. 🔴 (principle) / 🟢 (mechanism).

## The single source of truth for color math 🔴

Two functions are shared between the live tool and the export so previews can never drift from
shipped CSS:

- **`scaleData(scale)`** → `{ ramp, anchors, neutral, gradient }` (cached per render).
- **`genColors(scale, bgHex, T, data, sideOverride?)`** → `{ Lov, Lsrc, dark, alpha, dynamic,
  opaque, transparent, dE }`. The tool uses the returned linear/hex values; the exporter uses the
  **same anchors + same formulas** re-expressed as CSS `calc()` (see `07`). If you change one, change
  both, and re-run the acceptance tests.

## Performance model 🟡

- High-frequency inputs (stop sliders, color picker, surface sliders, gradient drag) call
  **`scheduleRefresh()`**, a `requestAnimationFrame` throttle that coalesces bursts to **one full
  render per frame**. Cheap immediate feedback (label text, the input's own value) is synchronous;
  the heavy work (rebuild CSS + re-render palette/preview) runs once per frame.
- Everything else calls `refresh()` directly.
- 🟢 In a reactive framework this is handled by the framework's batching; you may not need an explicit
  rAF throttle, but you DO need to avoid rebuilding the whole CSS/palette synchronously on every
  slider tick.

## Files & runtime 🟢

- `index.html` — markup only; ends with `<script src="./app.js">`.
- `app.js` — all logic (the IIFE begins at line 1 with color conversions).
- `style.css` — two-column grid, tabs, editors, palette, preview tree.
- No build, no deps. Must be served over HTTP (relative color / `contrast-color()` require a modern
  browser; opening `file://` blocks the linked CSS).
- `build/compile.mjs` — legacy static exporter, superseded by the in-tool `buildLibrary`. Ignore.

## What a reimplementation should keep vs. redesign

- **Keep (🔴):** `genColors` math, `scaleData` (ramp/anchors), the export string structure, the
  "one source of truth" principle, contrast/luminance/linear-blend formulas.
- **Redesign freely (🟢):** how state is stored and observed, how the DOM/components render, the rAF
  throttle, the specific panels/tabs, class names, and the authoring UX.
