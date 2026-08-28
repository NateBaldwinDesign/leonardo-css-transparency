# 02 · Strategy

High-level objectives, the strategic decisions that make the system work, and the **invariants** any
reimplementation must preserve.

## The core mental model 🔴

A color is produced by three inputs at paint time:

```
scale (hue/chroma family)  +  target contrast T  +  background --bg   →   color
```

The CSS follows the scale to a **source** color near the light/dark extreme, then **fades that
source over `--bg` in linear light** by an alpha chosen so the composited luminance hits exactly the
luminance that yields contrast `T` against `--bg`. Because luminance is *linear* in the blend
fraction when compositing in linear light, the required alpha has a **closed form** — no iteration —
so it can be written as a CSS `calc()`.

Everything else (scales, surfaces, contrast tokens, previews) orbits this one idea.

## Strategic decisions + rationale

### D1. Linear-light compositing is the whole trick 🔴
WCAG contrast is a function of **relative luminance**, which is linear in linear-sRGB. If you blend
`src` over `bg` with alpha `a` in linear light, the result's luminance is
`a·L(src) + (1−a)·L(bg)` — *linear in `a`*. So to hit a target luminance `Lov`, solve
`a = (Lov − L(bg)) / (L(src) − L(bg))`. This is the closed form the CSS bakes.
- **Why it matters:** CSS `opacity` composites in **gamma** space, so its alpha does *not* give this
  luminance and misses the target. The system reproduces linear compositing via
  `color(from var(--bg) srgb-linear …)`. **This is the difference between the product and "just use
  opacity."**

### D2. Ship a function, not tokens 🔴
Export one CSS class per scale that reads `--bg` + `--contrast` and computes the color. Rationale:
adapts to any background; collapses a token ladder to a function; makes the *ratio* the API.

### D3. Preserve chroma via an "extremity" source pick 🟡
Rather than fade the scale's color *at the target luminance* (which, when subtle, looks washed), pick
a **more saturated source** further toward the light/dark extreme and fade *that*. How far is the
**extremity curve** (`extOffset + extSteep·(T−1)/11`). Rationale: keeps low-contrast tints colorful.
- 🟡 The exact curve/parameters are tunable; the *presence* of a source-extremity choice is the
  strategic bit. In practice only the negative-steepness direction proved useful.

### D4. Neutrals are a special case of the same math 🔴
A scale with ~zero chroma has no hue to preserve, so its source is pinned to the **pure white/black
extreme** (extremity `e = 1`). This yields clean scrims. It's not a separate code path — just
`e = 1`. See `06`.

### D5. Surfaces = tint × reference × contrast, composable in pure CSS 🔴
A surface is a background computed at a target contrast vs a **reference** (its parent, or the base),
tinted from a **source** (the base color, or a scale). Surfaces compose by nesting. The one hard
constraint is a **CSS custom-property cycle** (you cannot redefine `--bg` from its own inherited
value on one element), which dictates the two-element wrapper for parent-relative surfaces. See `08`.

### D6. Dogfood the output 🟡
The tool injects its generated CSS live and renders previews through it, guaranteeing preview ==
export. Rationale: prevents drift between "what the tool shows" and "what ships." Also forces the
generator to be correct. 🟢 The *mechanism* (a live `<style>`) is adaptable; the *principle* (single
source of truth for color math shared by preview and export) is 🔴.

### D7. Comparisons are teaching tools, kept honest 🟡
The tool always shows **Dynamic** (shipped) and can show **Opaque** (token pick) and **Transparent**
(naive CSS opacity) side by side, with measured contrast, so the advantage of the linear method is
visible. Only Dynamic is exported.

## Invariants any reimplementation MUST preserve 🔴

1. **Contrast is computed against relative luminance** using the WCAG formula
   `(max+0.05)/(min+0.05)`, luminance `0.2126R + 0.7152G + 0.0722B` on **linear** channels.
2. **The dynamic blend happens in linear-sRGB**, and the alpha is the closed form in D1.
3. **The output is pure CSS** — the color math is expressed with relative color syntax + calc, no JS.
4. **The same generation code produces both the preview and the export** (one source of truth).
5. **Contrast targets are hit exactly** (validated numerically), on light and dark backgrounds.

## What is explicitly flexible 🟢

- Language/framework of the authoring tool; DOM/rendering; state storage; component structure.
- UI layout, styling, naming of classes/tokens, panel arrangement.
- How scales are *authored* (the L/h/c-across-lightness editor is one good approach, not the only one).
- Number of ramp steps, anchor count/positions (as long as the piecewise approx stays accurate).
- Whether comparisons (Opaque/Transparent) exist at all in the target.
