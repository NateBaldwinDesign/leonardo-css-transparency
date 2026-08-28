# 05 · Scales, ramps, anchors

A **scale** is a hue/chroma family expressed as **functions of lightness**, realized into a ramp,
then compressed into anchors that the exported CSS bakes in.

## Scale model 🟡
```
scale = { id, name, stops: [ {id, L, h, c}, ... ] }
```
- `L` = lightness 0–1, `h` = hue degrees, `c` = chroma as % of CMAX (0–100). (See `04`.)
- A stop is a **key point**: "at this lightness, the family has this hue & chroma."
- Between stops, hue and chroma are **interpolated across lightness**; outside the stop range they
  are held flat (nearest stop). A single-stop scale therefore has constant hue/chroma at all
  lightnesses (a tinted grayscale ramp).
- 🟢 The stop model (L/h/c key points) is one good authoring representation. The target may store
  scales differently (e.g., explicit key hexes). What matters (🔴) is that a scale yields a
  **monotonic-in-luminance ramp** and a set of **anchors** for the exporter.

Constants: `STOPS = 33`, `Llo = 0.03`, `Lhi = 0.985`. 🟡 (step count adaptable; keep enough
resolution that the piecewise anchor fit is smooth.)

## hue/chroma at a lightness 🟡
```
hcAt(stops, L):
  sort stops by L
  if L <= first.L → first {h,c};  if L >= last.L → last {h,c}
  else linearly interpolate: hue via lerpHue (shortest arc), chroma linearly
```

## Build the ramp 🔴 (behavioral)
```
buildRamp(stops):
  for i in 0..32: L = Llo + (Lhi-Llo)*i/32
                  {h,c} = hcAt(stops, L)
                  lin = gamutClamp(L, c/100*CMAX, h)
                  push { L, lin, lum: lumOf(lin) }
  sort ascending by lum;  set hex = linToHex(lin) each
  return ramp   // 33 entries, sorted by luminance
```
Sorting by luminance (not by the parametric L) is important: the downstream anchor read is keyed by
**luminance**, and gamut clamping can make the luminance order differ slightly from L order.

## Anchors (the compressed ramp the CSS bakes) 🔴
```
rampAnchors(ramp):
  anchors = [ {lum:0, lin:[0,0,0]} ]                       // pure black
  for i in [4,9,14,19,24,28]:  push { lum, lin } of ramp[i] // 6 interior samples
  push { lum:1, lin:[1,1,1] }                              // pure white
  sort by lum; dedupe points closer than 1e-4 in lum
  → ~8 luminance-keyed points
```
- **Why anchors:** the exported CSS reconstructs the scale's color at any luminance with a
  **piecewise-linear interpolation over these ~8 points**, per channel. 8 points keep the CSS `calc`
  small while staying visually accurate. 🔴 (the *mechanism*); 🟡 (the exact indices/count — you may
  choose different sample points, but black@0 and white@1 endpoints are required so extremes are exact).

## Read a color from anchors at luminance L 🔴
```
readAnchors(A, L):  // L clamped 0–1
  per channel: sum over segments of  slope * (clamp(L, A[i].lum, A[i+1].lum) - A[i].lum)
  where slope = (A[i+1].lin[ch]-A[i].lin[ch]) / (A[i+1].lum-A[i].lum)
```
This is the JS twin of the exported `chanExpr` CSS (see `07`). They must agree.

## Neutral detection 🔴
```
NEUTRAL_C = 2   // percent of CMAX
isNeutralScale(scale) = every stop.c < NEUTRAL_C
```
A neutral scale has no hue to preserve → the generator pins its source to the pure white/black
extreme (extremity `e = 1`). See `06`/`07`. This is an **authoring-time property** (depends only on
the stops), so the exporter can bake it as a constant. 🔴

## Cached derivation 🟡
```
scaleData(scale) = { ramp, anchors, neutral, gradient }
```
`gradient` is a CSS `linear-gradient` string of the ramp hexes for the editor swatch (🟢 UI only).

## Reference palette (export convenience) 🟢
The exporter also emits a fixed `--<name>-50 … --<name>-950` hex palette (11 steps) for
eyeballing/back-compat. Not used by the dynamic function; purely a convenience. Sampling formula
(over the luminance-sorted ramp of length `n=33`), for the 11 names `[50,100,200,…,900,950]` at
index `i=0..10`:
```
rampIndex = round( (10 - i) * (n - 1) / 10 )      // i=0→ramp[32] (lightest) as --50; i=10→ramp[0] as --950
--<name>-<step> = linToHex(ramp[rampIndex])
```

## Acceptance tests 🔴
- A single `c:0` stop → ramp is pure grayscale black→white; `isNeutralScale` true.
- Anchors always start `{0,[0,0,0]}` and end `{1,[1,1,1]}`.
- `readAnchors(anchors, 0) = [0,0,0]`, `readAnchors(anchors, 1) = [1,1,1]`.
- `readAnchors` at an interior anchor's luminance returns that anchor's linear color.
