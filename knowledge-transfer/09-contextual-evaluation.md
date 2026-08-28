# 09 · Contextual evaluation (the preview tree)

The "Contextual evaluation" view shows surfaces the way they're actually used — a **recursive tree
rooted at the base** — rather than a flat list. This is a 🟡 RECOMMENDED model (it makes surface
composition legible); the exact layout is 🟢 ADAPTABLE.

## Preview roles 🟡
Each surface has a **preview role** that determines how it appears in the tree. It **auto-derives**
from the surface's config, and can be overridden per surface:
```
derivedRole(surf) = surf.reference==='base' ? 'once'
                  : surf.source==='base'    ? 'nest'
                  :                           'applied'
roleOf(surf) = surf.base ? 'base'
             : (!surf.previewRole || surf.previewRole==='auto') ? derivedRole(surf) : surf.previewRole
```
| role | behavior in the tree | auto when |
|---|---|---|
| `nest` | the recursive spine; iterates to the nest depth | parent-relative + base tint (e.g. `raised`) |
| `applied` | a leaf card rendered in **every** context (base + each nest level) | parent-relative + scale tint (e.g. `info`, `error`) |
| `once` | a single leaf card, in the **base** context only | base-relative (e.g. `overlay`) |
| `hidden` | not shown | (manual) |

Plus a per-surface `showInPreview` boolean (default true) that removes it from the tree entirely.

## Structure (recursive) 🟡
```
renderContext(surf, parentLin, depthLeft, isBase, nestSurf):
  color = surfaceLin(surf, parentLin)                 // base-relative surfaces use the base
  box(color, label, --bg=color, --contrast=<token>):
    • ctx-self:  a "Generated color" swatch (selected scale @ selected contrast) + optional meta
    • for each APPLIED surface: leaf(that surface vs color)        // every context
    • if isBase: for each ONCE surface: leaf(that surface vs base) // base only
    • if nestSurf and depthLeft>0: renderContext(nestSurf, color, depthLeft-1, false, nestSurf)

trees = nestSurfaces.map(n => renderContext(base, null, nestDepth, true, n))   // one tree per nest surface
        (or a single base context if there are no nest surfaces)
```
- **One independent tree per `nest` surface** (rooted at base). No branching/mixed spines.
- `applied` and `once` cards are **leaves** (a swatch, no further recursion).
- Each card sets `--bg` = its surface color and `--contrast` = the selected token, then paints a
  single **"Generated color"** swatch via `class="<scale> tint-bg"` — i.e. it **dogfoods** the
  exported CSS. 🔴 (the swatch must be produced by the real CSS API, not a JS-computed hex).

## Controls 🟢
- **Color scale** + **Contrast swatch** pickers — drive the swatch in every card.
- **Nest depth** slider (default 2, max 4) — how many times the nest spine recurses.
- **Method detail** toggle (default off) — reveals a Dynamic/Opaque/Transparent 3-up with measured
  contrast under each card's swatch (the `06` comparison). Hidden by default to keep the mockup clean.

## Layout detail 🟢
Within a context, the context's own swatch + its (optional) method-detail are wrapped in a flex
**column** (`.ctx-self`) so the comparison sits *below* the swatch, consistent with leaf cards; the
applied/once leaves and the nested context are flex-wrapped siblings beside it.

## Acceptance tests 🟡
- With defaults, the base context contains the `info`/`error`/`overlay` leaves; the `raised` spine
  nests to `nestDepth`; `overlay` appears only at base.
- Each `applied` leaf's measured contrast is vs **its own context**, not the base (e.g. info nested in
  raised is 1.15:1 vs raised).
- Unchecking a surface's `showInPreview` removes it (and, for a nest surface, its whole spine).
