# Project context — Dynamic Color System

This project reuses the concepts of a **Dynamic Color System** (CSS-only, contrast-adaptive color).
The full, authoritative specification is in **`knowledge-transfer/`** and is imported below.

## Read before planning or implementing any color / scale / surface work
@knowledge-transfer/README.md

Then read `knowledge-transfer/01-goals.md` through `knowledge-transfer/12-open-directions.md` **in
order**, and honor the criticality tags in every file:

- 🔴 **CRITICAL** — reproduce exactly (color math, linear-light blend, the pure-CSS technique).
  Changing it makes colors miss contrast targets or stop being pure CSS.
- 🟡 **RECOMMENDED** — keep unless you have a specific reason; note the behavioral cost of deviating.
- 🟢 **ADAPTABLE** — implementation choice (framework, state, DOM, styling, naming); redesign freely.

## Non-negotiables (do not violate without explicit approval)
1. The exported color CSS is **pure CSS** — no runtime JavaScript.
2. Blend in **linear light**; hit WCAG contrast targets **exactly** (validate numerically).
3. **One generation path** feeds both preview and export (no drift).
4. **No optical / constant-hue mode** — it can't be a pure-CSS function and was removed on purpose.

## Notes
- The exact default data (19 scales, 16 contrasts, 5 surfaces, extremity curve) is inlined in
  `knowledge-transfer/11-state-management.md` — copy those values verbatim; don't re-derive by eye.
- Using a non-Claude agent? `AGENTS.md` carries the same guidance.
- This file assumes `knowledge-transfer/` sits at the repo root. If you place it elsewhere, update
  the `@` import path above.
