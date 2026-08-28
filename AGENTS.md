# AGENTS.md — entry point for AI agents

This repository is a working prototype of a **Dynamic Color System** (a CSS-only, contrast-adaptive
color engine). If you are an AI agent tasked with **building a new project** or **revising another
tool** based on these concepts, do this:

## Start here 🔴
Read **`knowledge-transfer/`** in numeric order (`README.md`, then `01`→`12`) *before* proposing any
plan. That directory is a portable, framework-agnostic specification with explicit **criticality
tags**:

- 🔴 **CRITICAL** — reproduce exactly (color math, linear-light blend, pure-CSS technique). Deviating
  makes the output miss contrast targets or stop being pure CSS.
- 🟡 **RECOMMENDED** — strong default; keep unless you have a reason, and note the behavioral cost.
- 🟢 **ADAPTABLE** — implementation choice (framework, state, DOM, styling, naming); redesign freely.

## The one-paragraph summary
Ship **color as a function, not tokens**: export a **pure-CSS library** where each scale is a class
that, at paint time, fades a saturated source over the current background **in linear light** to hit
a target **WCAG contrast exactly** (`color(from var(--bg) srgb-linear …)` + `calc`). Contrast ratios
are the API (`--contrast-*`). **Surfaces** are backgrounds derived by a contrast vs a reference,
composable by nesting. The authoring tool designs scales/contrasts/surfaces and generates the CSS,
and **dogfoods** its own output in every preview.

## Non-negotiables (see `01`, `02`) 🔴
1. Output is **pure CSS** — no runtime JS.
2. Blending is **linear-light**; contrast targets are hit **exactly** (validate numerically).
3. **One generation path** feeds both preview and export (no drift).
4. **No optical/constant-hue mode** — it can't be pure CSS and was removed on purpose.

## Where things are
- `knowledge-transfer/` — **the authoritative spec** to read and carry into the new project
  (portable). If anything elsewhere conflicts with it, trust this pack and the code.
- `SURFACES-PLAN.md` — deep design history for surfaces (supporting detail).
- `app.js` / `index.html` / `style.css` — the reference implementation (vanilla, no build); the
  ultimate ground truth for exact values.
- `README.md` — end-user overview of the prototype (kept in sync, but the KT pack governs).
- `build/compile.mjs` — legacy; ignore.

## Delivery mechanism note (why Markdown, not MCP)
This knowledge is delivered as **portable Markdown** (plus this `AGENTS.md` pointer) rather than an
MCP server or harness-specific rules file, because the target is a *new* project on *unknown*
frameworks/harnesses: static docs the agent ingests as context are universal and self-contained,
whereas MCP requires a running server + compatible client and suits live/dynamic queries, not a
one-time concept transfer. If the destination later wants interactive querying, wrap
`knowledge-transfer/` in that repo's own rules file (`AGENTS.md`/`CLAUDE.md`/`.cursorrules`) or a
docs MCP server — the content is unchanged. **To reuse: copy `knowledge-transfer/` (and optionally
this file) into the target repo.**
