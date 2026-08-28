# 07 · The pure-CSS export (the product)

This file describes how `genColors` (JS, `06`) becomes **pure CSS that computes the same color at
paint time**. This is the deliverable. Everything here is 🔴 CRITICAL unless tagged otherwise —
getting it wrong means the output silently misses contrast targets.

## The enabling CSS features 🔴
1. **Relative color syntax**: `color(from <src> srgb-linear <r-expr> <g-expr> <b-expr>)` — lets you
   read a source color's channels (`r`,`g`,`b`, in the requested space) and compute new channels with
   `calc()`. Using `srgb-linear` means **the channels are linear**, so weighted sums = linear
   compositing. This is what makes WCAG-exact blending possible in CSS.
2. **`calc()` / `clamp()` / `min()` / `max()`** for the arithmetic.
3. **`contrast-color(<c>)`** for an auto foreground (used for `--on-bg`).

## The `--_luma` text-token trick 🔴 (the key insight)
Inside `color(from var(--bg) srgb-linear …)`, the identifiers `r`, `g`, `b` refer to the source's
channels. But you want intermediate values (luminance, target luminance, alpha) computed *from*
those channels and reused across the three channel expressions. The trick:

> Define custom properties whose **values are unresolved expressions** that mention `r`/`g`/`b`.
> They are meaningless on their own, but when substituted (via `var()`) **into a `color(from …)`
> context**, `r`/`g`/`b` resolve and the whole expression evaluates.

Example: `--_luma: (0.2126*r + 0.7152*g + 0.0722*b);` then `--_lov: …var(--_luma)…;` then the final
`--tint: color(from var(--bg) srgb-linear calc(… var(--_a) …) …)`. Every intermediate is just text
until it lands inside the `color()` call. **This is why the whole pipeline is pure CSS.** Custom
property names are per-element, so intermediates don't leak across elements.

⚠️ **Whitespace matters** in these expressions: write `var(--_luma) + 0.05` with spaces around
operators; some minifiers/joins that drop spaces will invalidate the `calc`. And do not nest
`/* */` comments inside the generated block.

## Reconstructing a scale color at a luminance in CSS 🔴
The JS `readAnchors` becomes `chanExpr(A, channel, lumVar)` — a piecewise-linear sum over anchor
segments:
```
chanExpr(A, ch, vn) =  Σ over segments i:
   <slope_i> * (clamp(<A[i].lum>, var(<vn>), <A[i+1].lum>) - <A[i].lum>)
   where slope_i = (A[i+1].lin[ch] - A[i].lin[ch]) / (A[i+1].lum - A[i].lum)
```
Note the `clamp(min, val, max)` **arg order**: the anchor luminances are the min/max bounds and
`var(vn)` (the desired luminance) is the middle value. Getting this order wrong is a known bug class
— it must be `clamp(A[i].lum, var(vn), A[i+1].lum)`. 🔴

## The shared dynamic-tint block 🔴
Both scale classes and scale-sourced surfaces use one generator. It mirrors `genColors` steps 1–6
exactly, as CSS:
```
dynamicTintDecls({A, off, st, cExpr, darkExpr, ref, out}) →
  --_c: <cExpr>;                                  /* target contrast */
  --_luma: (0.2126*r + 0.7152*g + 0.0722*b);      /* luminance of ref, resolved in color() */
  --_dark: <darkExpr>;                            /* 1 = darker side, 0 = lighter */
  --_lov: clamp(0, calc(var(--_dark) * ((var(--_luma)+0.05)/var(--_c) - 0.05)
            + (1 - var(--_dark)) * (var(--_c)*(var(--_luma)+0.05) - 0.05)), 1);
  --_ext: clamp(0, calc(<off> + <st> * (var(--_c)-1)/11), 1);      /* extremity e */
  --_lend: calc(1 - var(--_dark));
  --_lsrc: clamp(0, calc(var(--_lov) + var(--_ext)*(var(--_lend)-var(--_lov))), 1);
  --_dn: calc(var(--_dark)*min(var(--_lsrc)-var(--_luma), -0.0001)
            + (1 - var(--_dark))*max(var(--_lsrc)-var(--_luma), 0.0001));
  --_a: clamp(0, calc((var(--_lov)-var(--_luma))/var(--_dn)), 1);  /* the closed-form alpha */
  <out>: color(from <ref> srgb-linear
    calc(var(--_a)*(<chanExpr r @ --_lsrc>) + (1-var(--_a))*r)
    calc(var(--_a)*(<chanExpr g @ --_lsrc>) + (1-var(--_a))*g)
    calc(var(--_a)*(<chanExpr b @ --_lsrc>) + (1-var(--_a))*b));
```
Compare line-by-line to `06`: `--_lov`=Lov, `--_ext`=e, `--_lsrc`=Lsrc, `--_a`=alpha, and `<out>` is
the linear composite `alpha*src + (1-alpha)*ref`. `src` per channel is `chanExpr` (readAnchors).

- **Scale class** uses: `cExpr = var(--contrast, var(--level-aa))`, `darkExpr = sideExpr()`,
  `ref = var(--bg)`, `out = --tint`, `off/st` = scale's extremity (neutral → `1 / 0`).
- **`sideExpr()`** (auto side in CSS): `clamp(0, 1, (var(--_luma) - 0.1791) * 100000)` — a smoothstep-
  free step at the WCAG crossover 0.1791; `'1'`/`'0'` for forced dark/light. The `*100000` turns the
  sign of the difference into a 0/1 via clamp. 🔴

## The base-color surface tint (retint the reference, keep hue) 🔴-to-match / 🟡-if-redesigning
**Criticality is conditional:** the shipped defaults (`raised`, `overlay`) are `source:'base'`, so
this path is **🔴 required to reproduce current output faithfully.** It is **🟡 (skippable)** only if
you adopt the `12` "background scale" redesign, which routes base tints through `dynamicTintDecls`
instead and deletes this path.
For surfaces whose source is the base color (not a scale), a lighter/darker retint that preserves
hue by moving toward the hue's **bright form** (channels / max-channel) instead of white:
```
baseTintDecls({C, force, ref, out}) →
  --_luma: (0.2126*r + 0.7152*g + 0.0722*b);
  --_maxc: max(r, max(g, b));
  --_al: clamp(0, calc(((C*(var(--_luma)+0.05)-0.05) - var(--_luma))
            / max(var(--_luma)/var(--_maxc) - var(--_luma), 0.000001)), 1);   /* lighten fraction */
  --_f: calc(((var(--_luma)+0.05)/C - 0.05) / max(var(--_luma), 0.000001));   /* darken factor */
  --_gl: <force ? 0 : (1 - clamp(0, 1, (C - 1.05/(var(--_luma)+0.05)) * 100000))>;  /* go-light? tie→light */
  <out>: color(from <ref> srgb-linear
    calc(var(--_gl)*(r + var(--_al)*(r/var(--_maxc) - r)) + (1-var(--_gl))*(var(--_f)*r))
    …g…  …b…);
```
- 🟡 **Note:** there is an open proposal (`12`) to *delete this path* and treat the base color as
  just another scale (a "background scale"), unifying everything through `dynamicTintDecls`. If you're
  building fresh, strongly consider implementing the unified approach from `12` instead of porting
  `baseTintDecls`.

## Full library structure (`buildLibrary`) 🔴
The exported string, in order:
```
/* header comment with a usage example */
<surfaces block>            // :root{--bg;--surface-base} + .surface-* classes + .s-content   (see 08)
:root { --contrast-100: …; --contrast-200: …; … --level-ui:3; --level-aa:4.5; --level-aaa:7; }
<one block per scale>:
   :root { --<name>-50..950: <hex>; }            // reference palette (convenience)
   .<name> { <dynamicTintDecls → --tint>; --on-bg: contrast-color(var(--bg)); }
.tint-fg { color: var(--tint); }
.tint-bg { background: var(--tint); }
```
- **Contrast tokens**: `--contrast-<(i+1)*100>` for each contrast **sorted ascending**, value = the
  raw ratio. `--level-ui/aa/aaa = 3/4.5/7` are semantic fallbacks (the scale's `--_c` defaults to
  `--level-aa`). 🔴 (naming 🟢).
- **Apply classes**: `.tint-fg`/`.tint-bg` read the computed `--tint`. 🟢 (naming/mechanism).

## Consumption (how an engineer uses the output) 🔴
```html
<div class="surface-raised"><div class="s-content">
  <span class="blue tint-fg" style="--contrast: var(--contrast-500)">accessible text</span>
  <div  class="blue tint-bg" style="--contrast: var(--contrast-200)">fill</div>
</div></div>
```
A surface sets `--bg` for its subtree; a scale class + `--contrast` computes `--tint`; `tint-fg/bg`
paint it. Contrast is hit against whatever surface the element sits on.

## Acceptance tests 🔴
- Inject the library; for each scale × `--contrast-*`, measure a `.<scale>.tint-bg`'s computed
  background contrast vs `--bg` → equals the token value (±0.02), on light and dark `--bg`.
- Braces and parens in the output are balanced; no nested block comments.
- `color(from var(--bg) srgb-linear …)` resolves (Chrome/Safari modern). If a browser lacks relative
  color, the whole thing fails — that's the platform floor.
