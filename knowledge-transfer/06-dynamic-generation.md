# 06 · Dynamic generation — `genColors` (the core algorithm)

This is the heart of the system. It is 🔴 CRITICAL and is **shared by the tool and the exporter**
(the tool runs this JS; the exporter re-expresses the *same* steps as CSS `calc()`, see `07`). The
JS and the CSS must produce the same result.

## Inputs
`genColors(scale, bgHex, T, data, sideOverride?)`
- `scale`, `data = scaleData(scale)` (provides `anchors`, `neutral`).
- `bgHex` — the background color to hit contrast against.
- `T` — target WCAG contrast ratio.
- `sideOverride` — optional `0` (lighten) / `1` (darken); if omitted, auto (see below).

## Algorithm (exact) 🔴
```
bgLin = hexToLin(bgHex);  Lbg = lumOf(bgLin)

// 1. Which side? 1 = darker than bg, 0 = lighter. Auto crosses at WCAG's 0.1791.
dark = sideOverride ?? (settings.side==='dark' ? 1 : settings.side==='light' ? 0 : (Lbg > 0.1791 ? 1 : 0))

// 2. Target luminance that yields contrast T against bg (inverse WCAG):
Lov = clamp01( dark ? (Lbg+0.05)/T - 0.05 : T*(Lbg+0.05) - 0.05 )

// 3. Extremity: how far past Lov (toward the extreme) to pick the SOURCE.
//    Neutral scales pin to the pure extreme (e=1). Otherwise the extremity curve:
e = neutral ? 1 : clamp01( extOffset + extSteep * (T-1)/11 )
Lend = 1 - dark                       // the extreme luminance (1=white if lightening, 0=black if darkening)
Lsrc = clamp01( Lov + e*(Lend - Lov) ) // source luminance, between Lov and the extreme

// 4. The source color at that luminance, read from the scale's anchors:
srcLin = readAnchors(anchors, Lsrc)

// 5. Alpha to fade src over bg (LINEAR) so the result's luminance == Lov (closed form):
dn    = dark ? min(Lsrc - Lbg, -0.0001) : max(Lsrc - Lbg, 0.0001)   // guard /0
alpha = clamp01( (Lov - Lbg) / dn )

// 6. Dynamic color = linear composite:
dynLin = bgLin.map((c,k) => alpha*srcLin[k] + (1-alpha)*c)
```
`dynLin` is the shipped color. Its measured contrast against `bg` equals `T` (that's the whole
point — step 5 was solved to make luminance = Lov, and Lov gives contrast T by step 2).

### Why the closed form works 🔴
Luminance is linear, and linear compositing is linear in `alpha`, so
`L(dynLin) = alpha·L(src) + (1−alpha)·L(bg)`. Setting that to `Lov` and solving for `alpha` gives
step 5. **No iteration** → expressible in CSS `calc`.

## The two comparison outputs (tool-only; NOT exported) 🟡

**Opaque** — the plain scale color *at the target luminance*:
```
opqLin = readAnchors(anchors, Lov)   // exact contrast, but an opaque token (no bg adaptation)
```

**Transparent** — the same source applied with **real CSS `opacity`** (gamma compositing), to show
how naive opacity misses:
```
bgGam = bgLin.map(toGam); srcGam = srcLin.map(toGam)
// Colorful sources: reuse Dynamic's linear alpha → small honest "miss".
alphaT = alpha
// Neutral sources sit at gamma extremes where reuse is wildly off; solve the opacity whose GAMMA
// composite hits Lov (bisection, ~30 iters, luminance monotonic in alpha):
if neutral: bisearch alphaT in [0,1] s.t. lum(toLin(alphaT*srcGam + (1-alphaT)*bgGam)) == Lov
transLin = bgGam.map((c,k) => toLin(alphaT*srcGam[k] + (1-alphaT)*c))
```
- 🟡 This whole comparison exists to *demonstrate* the linear-vs-gamma difference. If the target
  project doesn't need the teaching comparison, it can be dropped. If kept, the **neutral gamma-solve**
  is required so neutral scrims don't look broken (they'd otherwise be far off target).

## Return shape
```
{ Lov, Lsrc, dark, alpha,
  dynamic:     { lin, hex, meas: contrast(lum(dynLin), Lbg) },
  opaque:      { lin, hex, meas },
  transparent: { lin, hex, meas, srcHex: linToHex(srcLin), alpha: alphaT },
  dE: deltaEOK(dynLin, opqLin) }
```
`meas` = measured contrast (for display/validation). `dE` = drift readout.

## Settings that feed this 🟡
```
settings = { side: 'auto'|'light'|'dark', extOffset: 0.36, extSteep: -1, guardThreshold: 0.10 }
```
- `side` — global contrast side (auto/light/dark). Surfaces override it per-surface (see `08`).
- `extOffset` (0–1), `extSteep` (−1…1) — the extremity curve. Defaults `0.36 / -1`. 🟡 tunable;
  positive steepness proved not useful in practice.

## Worked example (verify your port against this) 🔴
Neutral scale (`silver`, e=1) at contrast **1.06** on white (`--bg = #ffffff`, `Lbg = 1`):
```
dark = 1 (Lbg 1 > 0.1791)
Lov  = (1+0.05)/1.06 - 0.05          = 0.940566
e    = 1 (neutral) → Lend = 0, Lsrc = 0.940566 + 1*(0-0.940566) = 0
src  = readAnchors(A, 0)             = [0,0,0]   (pure black)
dn   = min(0-1, -0.0001)             = -1
alpha= clamp01((0.940566-1)/-1)      = 0.059434
dyn  = 0.059434*0 + 0.940566*1       = 0.940566 per channel (neutral gray)
contrast(0.940566, 1) = 1.05/(0.940566+0.05) = 1.06  ✓
```
(Confirmed in-browser: the injected CSS produces `color(srgb-linear 0.940566 …)`.)

## Acceptance tests 🔴
- For any scale, `genColors(scale, '#ffffff', 4.79, data).dynamic.meas ≈ 4.79`.
- Same on `'#000000'` and mid grays, for T across the full token set.
- Neutral scale on white: `dynamic` is neutral (equal R=G=B) and hits target; its `transparent.meas`
  also ≈ target (thanks to the gamma-solve).
- Colorful scale: `dynamic.meas` exact; `transparent.meas` slightly off (the honest miss).
