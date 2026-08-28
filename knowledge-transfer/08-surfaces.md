# 08 · Surfaces

A **surface** is a named background computed by a **target contrast** vs a **reference**, **tinted**
from a **source**. Surfaces compose by nesting. "Elevation" = a surface + shadow (future, not built).

> Full design rationale and the conversation history live in `../SURFACES-PLAN.md`. This file is the
> distilled spec.

## Model 🟡
```
surface = {
  id, name,
  base?: true,                       // the ground surface (the Background input); exactly one
  source: 'base' | '<scaleName>',    // tint: the base color itself, or a scale's hue
  reference: 'parent' | 'base',      // contrast measured vs the parent surface, or the root
  contrast: <ratio>,                 // target WCAG ratio vs the reference
  forceDark: bool,                   // force darker polarity (else auto)
  expanded: bool,                    // UI: raises the contrast slider max 3→12
  previewRole: 'auto'|'nest'|'applied'|'once'|'hidden',   // see 09
  showInPreview: bool                // see 09
}
```

## Polarity (lighter vs darker) 🔴
```
goLight(surf, Lp) = !forceDark && contrast <= 1.05/(Lp+0.05)   // Lp = reference luminance
```
Lighter by default; auto-**flips darker** when the light side caps (e.g. a white base, where
`1.05/(1+0.05)=1.0`, so any contrast>1 forces darker); `forceDark` forces it. This is the same
`--_dark`/`--_gl` step baked into the CSS.

## Derivation (tool side, `surfaceLin`) 🔴 (behavioral)
```
surfaceLin(surf, parentLin):
  if surf.base: return background color (linear)
  refLin = surf.reference==='base' ? baseColorLin : parentLin
  if surf.source==='base':   return deriveSurfaceLin(surf, refLin)          // base-color tint
  scale = find scale by name(surf.source)
  if !scale: return deriveSurfaceLin(surf, refLin)                          // dangling → fallback
  dark = goLight(surf, lum(refLin)) ? 0 : 1
  return genColors(scale, hex(refLin), surf.contrast, scaleData(scale), dark).dynamic.lin
```
So **scale-sourced surfaces reuse `genColors`** (unifying with the color system); **base-sourced
surfaces** use the bright-anchor retint:
```
deriveSurfaceLin(surf, refLin):   // keep hue; hit contrast C
  Lp = lum(refLin)
  if goLight:  maxc = max(refLin[0],refLin[1],refLin[2], 1e-6);  Lt = C*(Lp+0.05)-0.05
               a = clamp01((Lt-Lp)/max(Lp/maxc-Lp, 1e-6))
               return refLin.map(k => clamp01(k + a*(k/maxc - k)))   // toward the hue's bright form
  else:        Lt = (Lp+0.05)/C-0.05;  f = Lt/max(Lp,1e-6)
               return refLin.map(k => clamp01(f*k))                  // toward black
```
> 🟡 See `12` — there's an active proposal to eliminate the base-source special case by modeling the
> background itself as a "background scale," so *all* surfaces derive through `genColors`. Prefer that
> unified model in a fresh build.

## The CSS composition constraint 🔴 (the crux)
A CSS custom property **cannot be redefined from its own inherited value on the same element** —
`--bg: color(from var(--bg) …)` is a dependency cycle → invalid. This single fact dictates the
markup:

- **Parent-relative surfaces** read the inherited `--bg`, so the "read" and the "re-publish for
  descendants" must happen on **two different elements**: the surface element computes `--_surf` and
  paints it; a child `.s-content` sets `--bg: var(--_surf)` for the subtree.
- **Base-relative surfaces (overlays)** read a stable root `--surface-base` (never `--bg`), so there's
  no cycle — a **single element** can both paint and set `--bg` for its subtree.

A one-element `> *` shortcut does **not** work for parent-relative surfaces: when a child is itself a
surface it both consumes and produces the surface var → the cycle returns. The two-element wrapper is
required. (Verified.)

## Export shape 🔴
```
:root { --bg: <bgHex>; --surface-base: <bgHex>; }

/* parent-relative, scale-sourced (e.g. info from 'blue' @1.15 vs parent) */
.surface-info { <dynamicTintDecls: cExpr=1.150, darkExpr=<surface polarity>, ref=var(--bg), out=--_surf>
                background: var(--_surf); }
/* parent-relative, base-sourced (e.g. raised) */
.surface-raised { <baseTintDecls: C=1.100, ref=var(--bg), out=--_surf>  background: var(--_surf); }
/* base-relative overlay — single element sets its own subtree --bg */
.surface-overlay { <baseTintDecls: ref=var(--surface-base), out=--_surf>
                   background: var(--_surf); --bg: var(--_surf); }

.s-content { --bg: var(--_surf); }   /* wrapper for parent-relative surfaces */
```
- Scale-sourced surface polarity in CSS: `darkExpr = forceDark ? '1' : clamp(0,1,(C - 1.05/(var(--_luma)+0.05))*100000)`.
- Scale-sourced uses the source scale's extremity (`off/st`, neutral → `1/0`).

## Markup contract 🔴
```html
<div class="surface-raised"><div class="s-content"> …content, and nested surfaces… </div></div>
<div class="surface-overlay"> …content… </div>   <!-- base-relative: no wrapper needed -->
```
Nesting compounds: `surface-raised` inside `surface-raised` sits at its contrast vs the *outer*
raised. Base-relative overlays stay vs the root at any depth. (Both verified numerically.)

## Naming note 🟢
`bg` is used for both the base surface and its `--bg`/`--surface-base` vars; scale palettes use
`--<name>-500`, surfaces use `.surface-<name>`. Distinct namespaces; rename freely in a port.

## Acceptance tests 🔴
- `.surface-raised` (1.1 vs parent) on white → 1.10:1; nested in itself → 1.10:1 vs the outer.
- `.surface-overlay` (1.6 vs base) nested 3 deep → still 1.60:1 vs the base.
- `.surface-info` (blue @1.15 vs parent) at each level → 1.15:1 vs *that* level, and visibly tinted.
