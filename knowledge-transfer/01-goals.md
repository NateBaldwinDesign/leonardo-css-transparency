# 01 · Goals

## Primary purpose 🔴

Ship **color as a function, not as fixed tokens.** Instead of exporting a frozen list of hex
values (`--blue-500: #2f56f4`), export a **scale + a pure-CSS function** so that, at paint time, the
CSS itself produces the color that hits a **target WCAG contrast against whatever background it
lands on** — exactly, and adapting to that background.

The concrete deliverable is a **pure-CSS library** (no JS at runtime) where an engineer writes:

```html
<div class="surface-raised"><div class="s-content">
  <span class="blue tint-fg" style="--contrast: var(--contrast-500)">Accessible on any surface</span>
</div></div>
```

…and the text color is computed by CSS to hit the `--contrast-500` ratio against the current
surface, preserving the scale's hue/chroma. The authoring tool exists to design the scales,
contrasts, and surfaces, and to **generate that CSS**.

## The problem being solved 🔴

1. **Static tokens don't adapt.** A token picked to be accessible on white fails on gray; teams ship
   many near-duplicate tokens per surface and still miss targets.
2. **Naive translucency misses contrast.** Applying CSS `opacity` to a color composites in **gamma**
   space, so the resulting contrast is not what you targeted (see `06`/`07`). Doing the blend in
   **linear light** yields *exact* contrast — but browsers don't do that for `opacity`.
3. **Contrast should be a first-class input.** Designers think "I need 4.5:1 here," not "pick swatch
   #500." The system makes the *ratio* the API (`--contrast-*`) and derives the color.

## Strategic value proposition 🔴

- **Exact, background-adaptive contrast** computed **in pure CSS at paint time**.
- **Chroma preserved** (the color stays colorful even when subtle), via a linear-light fade of a
  saturated source — not a wash toward gray.
- **One function per scale** replaces a whole token ladder; **surfaces** compose without enumeration.

## Who / what it's for 🟢

Design-systems and product teams that want accessible, adaptive color without shipping JS. The
prototype is an authoring tool; the *output* is meant to drop into any web project's stylesheet.

## Non-goals / explicit exclusions 🔴 (do not reintroduce without cause)

- **No "optical"/constant-hue solve.** Hitting a target contrast while holding OKLCh hue+chroma
  constant needs an iterative solver — it **cannot be a pure-CSS function**, which defeats the
  purpose. It was evaluated and **removed**. Linear-light fade is the sole method.
- **No runtime JavaScript in the output.** The exported artifact is CSS only. (The *authoring tool*
  uses JS; the *product* must not.) 🔴
- **No dependency on a specific framework** for the output. The CSS uses only standard modern
  features: relative color `color(from … srgb-linear …)`, `contrast-color()`, `clamp/min/max/calc`.

## Success criteria (how to know a reimplementation is correct) 🔴

1. For every scale × every `--contrast-*` token, the produced color's **measured** WCAG contrast
   equals the **target** (within ~0.02) on light and dark backgrounds.
2. The output contains **zero JS** and resolves entirely in the browser's CSS engine.
3. Surfaces compose: a surface nested in another sits at its target contrast **relative to its
   actual parent**; base-referenced overlays stay at their target vs the root regardless of nesting.
4. The tool's own previews are rendered **through the exported CSS** (dogfooding), so preview ==
   shipped output.
