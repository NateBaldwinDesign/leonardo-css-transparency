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

### Exact default values (copy verbatim) 🟡
Reproduce these numbers exactly; don't re-derive by eye. `L` 0–1, `h` degrees, `c` % of CMAX(0.4).
This is the authoritative copy — the reference `app.js` `DEFAULTS` is identical.
```js
const DEFAULTS = {
  background: '#ffffff',
  scales: [
    { name:'silver',     stops:[ {L:0, h:0, c:0} ] },                                                             // #000000
    { name:'magenta',    stops:[ {L:0.6603, h:7.8, c:59.2}, {L:0.3981, h:10.6, c:39.8} ] },                       // #ff3377 #870032
    { name:'red',        stops:[ {L:0.675, h:30.1, c:53.3}, {L:0.5779, h:30.4, c:51.1}, {L:0.3001, h:31.5, c:25.5} ] }, // #ff513d #d83220 #561107
    { name:'cinnamon',   stops:[ {L:0.5781, h:46.1, c:28.6}, {L:0.7733, h:50.7, c:22.4}, {L:0.3155, h:40.7, c:22} ] }, // #b0623b #e4a581 #551e07
    { name:'orange',     stops:[ {L:0.7736, h:65.1, c:43.4}, {L:0.7319, h:53, c:46.5}, {L:0.49, h:42.3, c:36.7} ] }, // #ff9a00 #ff8000 #a13b00
    { name:'brown',      stops:[ {L:0.8034, h:76.3, c:21}, {L:0.4893, h:76.5, c:16.9}, {L:0.3895, h:74.5, c:16.8} ] }, // #deb881 #765b32 #5a3f16
    { name:'yellow',     stops:[ {L:0.8681, h:94.1, c:44.5}, {L:0.6102, h:73.5, c:32.4} ] },                     // #fad000 #b17500
    { name:'chartreuse', stops:[ {L:0.9265, h:116.7, c:32}, {L:0.8658, h:121.2, c:52.1}, {L:0.3564, h:119.8, c:21.1} ] }, // #e1f28c #bfe600 #374200
    { name:'celery',     stops:[ {L:0.8417, h:135.2, c:55}, {L:0.2761, h:135.2, c:20.2} ] },                     // #86e93f #143000
    { name:'green',      stops:[ {L:0.7335, h:154.2, c:44.5}, {L:0.3528, h:165.7, c:18.4}, {L:0.9011, h:156.6, c:20} ] }, // #1ec873 #004732 #b3efc9
    { name:'seafoam',    stops:[ {L:0.9058, h:172.2, c:16.7}, {L:0.7764, h:172.9, c:36.8}, {L:0.3571, h:182.3, c:16} ] }, // #b3efdb #11d4ad #00473f
    { name:'turquoise',  stops:[ {L:0.9116, h:196.1, c:15.1}, {L:0.7495, h:205.4, c:31.6}, {L:0.3425, h:205.2, c:14.6} ] }, // #b3efef #11c4d4 #004147
    { name:'cyan',       stops:[ {L:0.9013, h:226.4, c:14.3}, {L:0.7081, h:245.8, c:40.7}, {L:0.4404, h:233.6, c:22.9} ] }, // #b7e7fc #31a8ff #005a7d
    { name:'blue',       stops:[ {L:0.7893, h:258.6, c:25.6}, {L:0.5335, h:266.7, c:59.7}, {L:0.3224, h:265.9, c:38.9}, {L:0.2409, h:268.7, c:21.8} ] }, // #92bcfc #2f56f4 #0e2581 #0f1a48
    { name:'indigo',     stops:[ {L:0.743, h:278.4, c:33.5}, {L:0.5186, h:284, c:62.7}, {L:0.3135, h:282.2, c:46.7} ] }, // #99a2ff #6339ef #2e008a
    { name:'purple',     stops:[ {L:0.4844, h:300, c:61.7}, {L:0.2799, h:299, c:37.6} ] },                       // #7915d1 #360066
    { name:'fuchsia',    stops:[ {L:0.7243, h:322.1, c:61.9}, {L:0.6114, h:321.9, c:58.3}, {L:0.3176, h:319.5, c:38.2} ] }, // #ea61ff #c040d4 #510061
    { name:'pink',       stops:[ {L:0.7274, h:343.2, c:55}, {L:0.6254, h:347.5, c:57.8}, {L:0.3245, h:350.4, c:33.8} ] }, // #ff61ca #e232a1 #61003d
    { name:'wireframe',  stops:[ {L:0.5521, h:264.1, c:34.4} ] },                                                 // #486ec2
  ],
  contrasts: [1.06, 1.15, 1.32, 1.6, 2, 2.6, 3.22, 3.95, 4.79, 6.29, 7.9, 10, 12.3, 14.8, 17, 19.5],
  surfaces: [
    { name:'bg', base:true },
    { name:'raised',  source:'base', reference:'parent', contrast:1.1,  forceDark:false, expanded:false },
    { name:'overlay', source:'base', reference:'base',   contrast:1.6,  forceDark:false, expanded:false },
    { name:'info',    source:'blue', reference:'parent', contrast:1.15, forceDark:false, expanded:false },
    { name:'error',   source:'red',  reference:'parent', contrast:1.15, forceDark:false, expanded:false },
  ],
  extOffset: 0.36,   // extremity curve base offset (0–1)
  extSteep: -1,      // extremity × contrast steepness (−1…1)
};
```
(Global `settings` also carries `side:'auto'` and `guardThreshold:0.10`, which are not in DEFAULTS.)

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
