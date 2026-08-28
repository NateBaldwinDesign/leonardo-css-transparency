# 11 · State management & the refresh loop

The prototype uses plain mutable objects + a single `refresh()`. 🟢 The **mechanism** is fully
adaptable (use signals/stores/reducers in the target); the **principles** below (🟡/🔴) should survive.

## DEFAULTS — the single data source 🟡
One object is the source of truth for what loads on a fresh page:
```
DEFAULTS = {
  background: '#ffffff',
  scales:    [ { name, stops:[ {L,h,c}, … ] }, … ],   // L 0–1, h °, c % of CMAX
  contrasts: [ 1.06, 1.15, …, 19.5 ],                  // target ratios
  surfaces:  [ { name, base? } | { name, source, reference, contrast, forceDark, expanded }, … ],
  extOffset: 0.36, extSteep: -1,
}
```
- 🟡 Keeping all authored defaults in one plain-data object (no ids, no logic) makes the tool
  configurable and portable. Recommended to preserve this separation (data vs. hydrated state).
- The default scales are OKLCh conversions of a Leonardo-style hue set (comments show the source hex).
- **Exact default values:** copy them verbatim from `app.js` → `DEFAULTS` (19 scales, 16 contrast
  ratios, 5 surfaces, extremity `0.36 / -1`). Reproduce the numbers exactly; don't re-derive by eye.

## Hydration → live state 🟢
On load, DEFAULTS is mapped into editable arrays with **stamped ids** (so items are addressable and
reorderable), plus non-persisted UI fields:
```
scales    ← DEFAULTS.scales,    each stop gets an id
contrasts ← DEFAULTS.contrasts, each gets {id, value}
surfaces  ← DEFAULTS.surfaces,  each gets {id, …, previewRole:'auto', showInPreview:true}
settings  = { side:'auto', extOffset, extSteep, guardThreshold:0.10 }
ui        = { tab, mainTab, selectedScaleId, selectedStopId, previewScaleId, activeContrastId,
              rampSurfaceId, dragging, exportOpen, nestDepth:2, showMeta:false }
```
The Background `<input>` value is set from `DEFAULTS.background` on init (JSON drives it, not the HTML
attribute). `background()` reads the input live.

## Derived getters 🟢
`sortContrasts()` (ascending), `contrastName(c)` (`--contrast-<pos*100>`), `getScale/getSel/
getSelStop`, `activeContrast`, `getSurface`, `surfaceColor`, `roleOf/derivedRole`, `sanitize` (name →
`[a-z0-9-]`). Nothing surprising; reimplement as computed values.

## The refresh loop 🟡
```
refresh():
  1. update the background label
  2. lib = buildLibrary();  genStyle.textContent = lib     // rebuild + inject the FULL exported CSS
  3. update contrast labels / active row
  4. refresh editor visuals + surface chips + ramp picker value
  5. renderPalette(); renderPreview(); renderDetail()      // previews painted BY the injected CSS
  6. if exportOpen: mirror lib into the textarea
```
- **Key principle (🔴):** step 2 injects the *actual export* into a live `<style>` (`genStyle`,
  appended to `<head>`), and steps 5's previews consume it. This is the **dogfooding** guarantee:
  the tool cannot show something the export wouldn't produce.
- 🟢 In a reactive framework, replace this with: a memoized `buildLibrary` derived from state, a
  `<style>` bound to it, and components that render via those classes. Don't hand-roll a monolithic
  `refresh` if the framework observes state for you.

## Throttling 🟡
`scheduleRefresh()` wraps `refresh()` in a `requestAnimationFrame` guard (one render per frame) for
high-frequency inputs (sliders/pickers/drag). Immediate feedback (label text, the active input's own
value) is written synchronously first. 🟢 Framework batching usually subsumes this; the requirement is
only "don't rebuild the entire CSS/palette synchronously on every input event."

## Structural vs. visual updates 🟢
The prototype distinguishes **structural rebuilds** (`rebuild*List`, `rebuildScaleEditor` — recreate
DOM) from **visual refresh** (`refresh` — update styles/values without recreating inputs). This
avoids destroying an `<input>` mid-interaction. In a framework with keyed reconciliation this
distinction is handled for you.

## Persistence 🟢
There is **none** — reload resets to DEFAULTS. A real product would persist authored state
(localStorage / file / backend) and likely support import/export of the DEFAULTS-shaped document.
This is an obvious, safe area to add.
