# 12 · Open directions & deferred items

⚠️ **Nothing in this file is implemented.** It records design intent that was agreed or discussed but
not built. Treat as direction, not fact. If building fresh, these represent the *intended* end-state
and are often better than porting the current code.

## A. Unify "base color" into a "background scale" 🟡 (agreed direction, not built)

**Problem it fixes:** two overlapping concepts — the "Background color" and a surface "base color"
tint — and two derivation paths (`baseTintDecls` bright-anchor vs. the scale `dynamicTintDecls`).
Confusing and redundant.

**The proposal:**
- Introduce a permanent **background scale** that always exists in the scales list, with a **single
  key color** driven by the top **Background** input (hue/chroma come from it). It is **hidden from
  the Color scales editor** for now and is the **undeletable "last scale"** (replacing the old
  "delete last scale → grayscale" behavior).
- When a surface's tint source is the background, treat it **exactly like picking any other scale**:
  `contrast + scale → value` via `genColors` / `dynamicTintDecls`. **Delete the `deriveSurfaceLin` /
  `baseTintDecls` bright-anchor path entirely.**
- Net effect: *everything* — text colors, fills, and surfaces — flows through one dynamic path.

**Behavior change to accept:** the scale path yields **subtler, chroma-bounded tints** (a tint never
exceeds the background's own chroma), and a **neutral background → pure black/white shades** (via the
neutral `e=1` rule). This is more "background-like" than the bright-anchor lift and is the point.

**Assumptions to confirm with the product owner (were still open):**
1. Base ground stays the literal Background input color; the background scale only *derives*
   elevations from it.
2. Default selected/preview scale stays a real editable scale (never the background scale).

**Open questions that had not been answered (decide before building):**
- Where is the background scale usable beyond tint source? (tint-source-only, or also
  paintable/selectable in ramps + eval pickers?)
- Its label in the surface "Tint" dropdown (`--bg`, `--background`, or keep "Base color"?).
- Its export shape (a full `.bg` scale class + palette like others, or internal-only anchors baked
  into the surfaces that use it?).

**Recommendation for a fresh build:** implement the unified model from the start (all surfaces
scale-sourced, background = a single-key scale). It's simpler and removes `baseTintDecls` from `07`.

## B. Elevations = surfaces + shadows 🟢 (reserved, not built)
"These are all surfaces; a surface with a shadow is an elevation." The surface model was shaped to
accept a future `shadow` field without rework. Drop-shadow tokens/logic are out of scope for now.

## C. Interactive nesting composer for the preview 🟢 (nice-to-have)
The eval tree currently renders one tree per nest surface at a global depth. A future version could
let the user arrange arbitrary nestings interactively.

## D. Persistence / import-export 🟢 (obvious gap)
No state persistence today (reload resets). A product needs to save authored state and import/export
the DEFAULTS-shaped document.

## E. Deferred/known tradeoffs (already reasoned about) 🟡
- **Optical / constant-hue solve: intentionally excluded** — can't be pure CSS (see `01`). Do not
  reintroduce as an export mode.
- **Chroma overshoot** in the base-color bright-anchor lighten can look slightly neon at high
  lightness; the `12.A` unification avoids it.
- **Scrim behind overlays** is not modeled; overlays just contrast with the base.
- **Positive extremity steepness** proved not useful; only the negative direction is valuable.
- **Multiple nest surfaces** render as independent trees (no composed/branching spine — deliberate).
