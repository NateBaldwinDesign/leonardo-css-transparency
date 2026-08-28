# 04 · Color math (exact specifics)

All formulas below are 🔴 CRITICAL — reproduce verbatim. Constants: `CMAX = 0.4` (max OKLCh chroma
used to normalize the chroma slider to 0–100%), degrees `D = π/180`.

## sRGB ↔ linear (per channel, 0–1) 🔴
```
toLin(c) = c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4      // gamma → linear
toGam(c) = c <= 0.0031308 ? 12.92*c : 1.055*c^(1/2.4) - 0.055  // linear → gamma
```
`hexToLin(hex)` → parse RRGGBB to 0–255, /255, `toLin` each. `linToHex(lin)` → `toGam`, clamp 0–1,
round to 0–255, hex. **Channels are handled in linear-sRGB for all blending/luminance.**

## Relative luminance & WCAG contrast 🔴
```
lumOf([r,g,b]) = 0.2126*r + 0.7152*g + 0.0722*b     // r,g,b are LINEAR
contrast(a,b)  = (max(a,b)+0.05) / (min(a,b)+0.05)   // a,b are luminances
```
Inverse (given a background luminance `Lbg` and target ratio `T`, the color luminance `Lov`):
```
lighter color:  Lov = T*(Lbg+0.05) - 0.05
darker color:   Lov = (Lbg+0.05)/T - 0.05
```
These inverses are used everywhere a target contrast becomes a target luminance. 🔴

## OKLab / OKLCh (Björn Ottosson) 🔴
Used for **authoring** (the stop editor operates in OKLCh) and for gamut clamping and ΔE. NOT used
in the runtime CSS.
```
linToOklab([r,g,b]):                       // r,g,b linear
  l = cbrt(0.4122214708 r + 0.5363325363 g + 0.0514459929 b)
  m = cbrt(0.2119034982 r + 0.6806995451 g + 0.1073969566 b)
  s = cbrt(0.0883024619 r + 0.2817188376 g + 0.6299787005 b)
  L = 0.2104542553 l + 0.7936177850 m - 0.0040720468 s
  a = 1.9779984951 l - 2.4285922050 m + 0.4505937099 s
  b = 0.0259040371 l + 0.7827717662 m - 0.8086757660 s

oklabToLin([L,a,b]):
  l = (L + 0.3963377774 a + 0.2158037573 b)^3
  m = (L - 0.1055613458 a - 0.0638541728 b)^3
  s = (L - 0.0894841775 a - 1.2914855480 b)^3
  r =  4.0767416621 l - 3.3077115913 m + 0.2309699292 s
  g = -1.2684380046 l + 2.6097574011 m - 0.3413193965 s
  b = -0.0041960863 l - 0.7034186147 m + 1.7076147010 s

oklchToLin([L,C,h]) = oklabToLin([L, C*cos(h·D), C*sin(h·D)])
linToOklch(lin):    [L, hypot(a,b), (atan2(b,a)/D + 360) mod 360]   from linToOklab
```
**Verification anchor:** `#ff0000` → OKLCh ≈ `L 0.6280, C 0.2577, h 29.23`; white → `L 1, C 0`;
mid-gray → `C 0`. If your conversion doesn't match these, it's wrong.

## Gamut clamp (reduce chroma to sRGB boundary, no hue skew) 🔴
```
inGamut(lin) = every channel in [-0.001, 1.001]
gamutClamp(L,C,h):
  if inGamut(oklchToLin([L,C,h])) return clamp01 each
  binary-search chroma in [0, C] for 22 iters, keep largest in-gamut chroma
  return oklchToLin([L, found, h]) clamped
```
Used whenever an OKLCh stop is realized to sRGB. 🟡 22 iterations is plenty; count is adaptable.

## ΔE (OKLab Euclidean) 🟡
```
deltaEOK(lin1, lin2) = euclidean distance between linToOklab(lin1) and linToOklab(lin2)
```
Used only as a **readout** ("chroma-guard"): how far the Dynamic color drifted from the Opaque pick.
A threshold (`guardThreshold = 0.10`) flags large drift. Purely informational; not part of generation.

## Hue interpolation 🟡
```
lerpHue(h0,h1,f): shortest-arc interpolation, d = ((h1-h0) mod 360 + 540) mod 360 - 180; h0 + d*f
```
Used when interpolating hue between scale stops across lightness.

## Chroma units 🟡
Stops store chroma as **percent of `CMAX` (0.4)**: `c` in 0–100 → OKLCh chroma `c/100*0.4`. This
keeps a slider in a friendly 0–100 range. 🟢 The 0.4 normalization is a convenience; adaptable, but
if you change it, update every `c/100*CMAX` and the neutral threshold accordingly.

## Acceptance tests for this file 🔴
- `toGam(toLin(x)) ≈ x`; `linToHex(hexToLin('#3366cc')) === '#3366cc'`.
- `contrast(1, 0)` (white vs black linear) = `(1.05)/(0.05)` = **21**.
- `lumOf(hexToLin('#ffffff')) = 1`, `lumOf(hexToLin('#000000')) = 0`.
- Inverse check: with `Lbg=1` (white), `T=4.79`, darker: `Lov=(1.05)/4.79-0.05 ≈ 0.1692`.
