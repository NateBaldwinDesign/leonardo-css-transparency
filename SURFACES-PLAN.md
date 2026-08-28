# Surfaces v2 — composable, tintable, contrast-relative

Plan for reworking the **Surfaces** feature. Captures the design agreed in conversation so it
can be built in stages. Shadows ("elevation") are explicitly **out of scope** here but the model
is shaped to accept them later.

## 1. Why change

Today's surfaces ([`surfaceLinAt`](app.js) — search `function surfaceLinAt`) derive each layer by
shifting the **lightness** of the previous layer toward pure white (lighten) or pure black
(darken) to hit a target contrast. Two problems:

1. **Tint is washed out.** Mixing a tinted base toward *white* in linear RGB is desaturation, so
   lightened layers lose the base hue. We want hue/chroma retained, like the color-scale engine does.
2. **Layers are enumerated.** `layer-1`, `layer-2` are fixed *positions* baked into a root
   `--_s0…_sN` chain. That enumeration exists **only to dodge a CSS custom-property cycle** (you
   cannot redefine `--bg` from its own inherited value on one element). It prevents true
   composition — `layer-1` on `layer-1` can't automatically become `layer-2`.

## 2. Core reframe

> **Everything is a Surface.** A surface has a **tint** and a **contrast relative to a reference**.
> A surface that also casts a **shadow** is an *elevation* (future). An **overlay** is just a
> surface whose reference is the base rather than its parent.

Tint and stacking become **orthogonal**: a surface can be tinted blue ("info") or red ("error")
*without* implying any z-index/lightness change, and it can also sit at a contrast step above the
thing it's on. Both, either, or neither.

## 3. The model

Each **surface type** carries:

| Field | Meaning |
|---|---|
| `name` | CSS var / class name (e.g. `raised`, `info`, `overlay`). |
| `source` | **Tint source** (per type): `"base"` or a **scale name**. See §4. |
| `reference` | What contrast is measured against: `"parent"` (inherited surface) or `"base"` (root). |
| `contrast` | Target WCAG ratio vs the reference. |
| `forceDark` | Force the darker polarity (else auto). |
| `expanded` | UI only — raises the contrast slider max (3 → 12). |
| _(future)_ `shadow` | Reserved; makes the surface an "elevation". Not built now. |

**Polarity (unchanged):** lighter by default, auto-flip darker when the light side caps (e.g. a
white base), with a per-type `forceDark` override.

## 4. Tint sources (per type)

**`source: "base"`** — retint the *reference* color itself, keeping its hue:
- Lighten toward the hue's **bright form** `bright = prev / max(prev.r, prev.g, prev.b)` (the same
  hue at full value), **not** toward white. Neutral input → `bright = white`, so grays stay gray.
- Darken toward black (scale channels by `f`), same as today.
- Luminance stays linear in the blend fraction, so the exact-contrast solve remains closed-form:
  - `Lt` from the WCAG inverse (light: `Lt = C·(Lp+0.05) − 0.05`; dark: `Lt = (Lp+0.05)/C − 0.05`).
  - Lighten fraction `a = (Lt − Lp) / (Lbright − Lp)`, where `Lbright = Lp / maxc`.
  - Result channel `= prev + a·(bright − prev)` (lighten) or `= f·prev` with `f = Lt/Lp` (darken).
- All expressible in pure CSS via the `--_luma` token + `max()` + division → exportable.
- Caveat: mixing toward the bright hue can *overshoot* chroma at high lightness (real ramps taper).
  Acceptable for v1; tunable later.

**`source: <scale>`** — sample an authored color scale (reuse the existing dynamic engine):
- The surface background = that scale's **dynamic color** at `contrast` over the reference
  (`genColors(scale, refHex, C).dynamic`, i.e. the opaque composited result).
- Chroma/hue retention is exact and comes "for free" from the scale's chromatic anchors.
- This is what powers **semantic tints** (blue `info`, red `error`): pick a small contrast + a
  tinted scale and you get a subtly tinted surface at controlled lightness.
- Exports through the existing `chanExpr(anchors,…)` machinery.

## 5. The CSS-cycle constraint & composition mechanism

A custom property cannot be redefined from its own inherited value on the same element
(`--bg: color(from var(--bg) …)` = dependency cycle → invalid). Consequences:

- **`reference: "parent"`** (reads inherited `--bg`) → needs a **two-element wrapper** so the read
  and the re-publish happen on different elements. A single-element `> *` shortcut *reintroduces*
  the cycle exactly when a child is itself a surface (the compounding case), so the wrapper is
  genuinely required.
- **`reference: "base"`** (reads a stable root `--surface-base`) → **no cycle, single element.**
  Overlays are simpler by construction.

**Author markup:**
```html
<!-- parent-relative surface: wrapper + content -->
<div class="surface-raised">        <!-- reads inherited --bg, computes --_e, paints it -->
  <div class="s-content">           <!-- --bg: var(--_e) → passes the surface down -->
    …content; nested <div class="surface-*"> compounds from here…
  </div>
</div>

<!-- base-relative surface (overlay): single element -->
<div class="surface-overlay"> …content… </div>
```

## 6. Export shape

Replaces the `--_s0…_sN` chain + aliases with **reusable types**:
```css
:root { --bg: <background>; --surface-base: <background>; }

/* parent-relative, tinted from the 'blue' scale, +1.15:1 over its parent */
.surface-info { --_c: 1.15;
  --_e: color(from var(--bg) srgb-linear <dynamic 'blue' @ --_c>);
  background: var(--_e); }
.s-content    { --bg: var(--_e); }

/* base-relative overlay — always vs the root; single element, sets --bg for its own descendants */
.surface-overlay { --_c: 2.5;
  --_e: color(from var(--surface-base) srgb-linear <dynamic @ --_c>);
  background: var(--_e); --bg: var(--_e); }
```
- `source:"base"` bakes the bright-anchor tint/shade expression (§4).
- `source:<scale>` bakes that scale's anchors via `chanExpr`.
- Polarity/`forceDark` logic baked exactly as today (tie → lighter).
- `--_e` is a single per-element private so `.s-content` (parent-relative) and descendants
  (base-relative) can read it without recomputation.

## 7. Data model

`DEFAULTS.surfaces` becomes a list of **types** (plain data; ids stamped at load):
```js
surfaces: [
  { name:'bg',      base:true },                                              // ground = Background input
  { name:'raised',  source:'base',  reference:'parent', contrast:1.1, forceDark:false, expanded:false },
  { name:'overlay', source:'base',  reference:'base',   contrast:2.5, forceDark:false, expanded:false },
  { name:'info',    source:'blue',  reference:'parent', contrast:1.15,forceDark:false, expanded:false },
  { name:'error',   source:'red',   reference:'parent', contrast:1.15,forceDark:false, expanded:false },
]
```
(Exact defaults TBD during build.) Base stays the Background input; renaming a type sets its CSS
var/class.

## 8. Tool-side derivation (shared preview + export path)

Generalize `surfaceLinAt` into a resolver that, for a surface instance:
1. Resolves the **reference** linear color: `parent` = the surface it's nested under; `base` =
   surfaces[0] (the Background), regardless of nesting depth.
2. Computes polarity (auto + `forceDark`) from the reference luminance.
3. Produces the surface color by **source**:
   - `"base"` → bright-anchor tint/shade (§4).
   - `<scale>` → `genColors(scale, refHex, contrast).dynamic.lin`.
4. Chains in **linear light** (not through rounded hex) so preview == exported CSS.

## 9. UI (Surfaces tab)

Per surface type row gains:
- **Source** picker: `Base color` or one of the scales.
- **Reference** toggle: `Parent` / `Base` (overlay).
- Existing: name (rename → var), contrast slider (max 3, `expanded` → 12), force-darker, delete.

## 10. Preview (Contextual evaluation) — v2, usage-shaped

The preview is a **recursive tree rooted at the base**. Every *context* (the base, and each
nesting level) renders the same three things:

1. **A content sample** — a mock card (one fill + three chips) painted in the selected scale's
   color, so you see that scale color *on* this surface. Driven by the existing scale + contrast
   pickers; dogfoods the injected CSS (`.<scale>.tint-bg`).
2. **Each "applied" surface** as a leaf card on this context, resolved relative to *this* context
   (info-on-base, then info-on-raised-1, then info-on-raised-2…).
3. **The "nesting" surface** nested inside, which recurses until the depth runs out.

**Per-surface preview role** (auto-derived, override per surface; also `hidden`):
| role | behavior | auto-derived when |
|---|---|---|
| `nest` | the recursive spine; iterates to the nest depth | parent-relative + base tint |
| `applied` | a leaf card shown in **every** context | parent-relative + scale tint |
| `once` | a single leaf card, in the **base** context only | base-relative (overlay) |
| `hidden` | not shown | (manual only) |

- **Multiple `nest` surfaces** → **one independent tree per nest surface** (each rooted at base;
  applied/once cards shown within each). No branching, no mixed spines.
- **Nest depth** — a global slider, default **2**, max **4**.
- **Applied & once cards are leaves** (content sample only; they don't recurse).
- **Dynamic/Opaque/Transparent meta hidden by default**, revealed by a "Method detail" toggle.

Pseudocode:
```
renderContext(surf, parentLin, depthLeft, isBase, nestSurf):
  color = surfaceLin(surf, parentLin)            // base-relative surfaces use the base
  box(color, label):
    • content sample (selected scale @ contrast)
    • for each APPLIED surface: leaf(that surface vs color)      // every context
    • if isBase: for each ONCE surface: leaf(that surface vs base)
    • if nestSurf and depthLeft>0: renderContext(nestSurf, color, depthLeft-1, false, nestSurf)
// one tree per nest surface, each: renderContext(base, –, depth, true, nestSurf)
```

## 11. Build order

1. **Data model + derivation math** — `DEFAULTS.surfaces` shape, resolver (source × reference ×
   contrast × polarity) in the shared path; keep preview working.
2. **Export** — per-type classes with the wrapper/overlay split; base-color and scale-source bakes.
3. **Surfaces tab UI** — source + reference controls per type.
4. **Preview** — nested/branched demo honoring `reference`.

## 12. Deferred / open

- **Shadows → "elevation."** Reserve a `shadow` field; build later (drop-shadow logic, tokens).
- **Scrim behind overlays** — not solved; overlays just contrast with the base.
- **Equal-lightness pure tint** (contrast ≈ 1 but hue shift) — covered adequately by `source:<scale>`
  at low contrast; revisit if a dedicated "recolor only" mode is wanted.
- **Chroma overshoot** in `source:"base"` lightening — tune the bright-anchor if it reads neon.
