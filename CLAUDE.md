# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A **section playground** for the Kairo.ai marketing website. Each new website
section is drafted here in isolation as its own Next.js route (`src/app/**/page.tsx`)
so it can be reviewed, iterated, and then handed off individually into the live
site repo. It is not the production site — it's a staging ground with review-only
scaffolding around each draft.

The real project root is `sections-playground/` (this directory). The parent
`Kairo/` folder only holds a stray `package-lock.json` and is not the project.

## Commands

```bash
npm run dev          # dev server at http://localhost:3000
npm run build         # static export -> ./out
npm run start         # serve a production build
npm run lint          # eslint (flat config, eslint-config-next)

GITHUB_PAGES=true npm run build   # Pages build: sets basePath/assetPrefix to /kairo
```

Node 22 (see `.github/workflows/pages.yml`). There is **no test setup** — no test
runner, no test files.

## Build / deploy model

- `next.config.ts` sets `output: "export"` — the app is fully client-rendered and
  exported to static HTML in `./out`. It deploys anywhere.
- `trailingSlash: true` is required so export writes `route/index.html` instead of
  sibling `route.html`; otherwise hard loads / direct links to the trailing-slash
  URLs that the App Router settles on would 404 on static hosts.
- `images: { unoptimized: true }` — needed for static export; `next/image` still works.
- `GITHUB_PAGES=true` flips `basePath`/`assetPrefix` to `/kairo` for
  `https://<user>.github.io/kairo/`. Local dev and Vercel leave them empty.
- `.github/workflows/pages.yml` builds and deploys to GitHub Pages on push to `main`
  (adds `out/.nojekyll`).

## Stack

- Next.js 16.3.4 (App Router) — **read `node_modules/next/dist/docs/` before
  writing Next.js code**; this version has breaking changes vs. older knowledge
  (see `AGENTS.md`).
- React 19, TypeScript strict.
- Tailwind CSS v4 via `@tailwindcss/postcss`. Config is CSS-first: `@import
  "tailwindcss"` + `@theme inline { ... }` in `src/app/globals.css`. There is no
  `tailwind.config`.
- Section internals use **CSS Modules** (`*.module.css` co-located with the
  component); nav/layout chrome uses Tailwind utility classes.
- Path alias: `@/*` -> `src/*`.
- Dark theme only. The layout shell hardcodes `bg-[#050505] text-zinc-200`;
  `globals.css` sets `color-scheme: dark`.

## Architecture

Three layers: a fixed app shell, per-route review scaffolding, and the draft
sections themselves.

### App shell — `src/app/layout.tsx` + `src/components/nav/NavHeader.tsx`

- The layout is a **non-scrolling full-viewport shell** (`h-[100dvh]`,
  `overflow-hidden`). Each route is its own full-viewport page; the header
  persists across navigations and only the `<main>` content swaps.
- Loads Inter via `next/font/google` and Material Symbols Outlined via a `<link>`
  in `<body>` (used for the arc's centre glyphs and nav icons; `.material-symbols-outlined`
  base styles live in `globals.css`).
- `AppChrome` (default export of `NavHeader.tsx`) renders the persistent header:
  route-based nav dropdowns (`NAV` array) where **each entry is a real route, not
  a tab** — picking a draft navigates there.
- Trailing-slash normalization: static export can land the URL with or without a
  trailing slash depending on hard load vs. client `<Link>` transition, so nav
  active-state compares paths through `normalize()` (strips trailing slashes).
- **Header control slot**: `AppChrome` exposes an empty `<div>` in the header via
  `HeaderSlotContext`. Pages read it with `useHeaderControlsSlot()` and
  `createPortal` their own controls into it, so page-local controls render on the
  same visual row as the nav **without lifting state** into the layout.

### Per-route scaffolding — `src/components/nav/SectionPreview.tsx`

Every page route renders `<SectionPreview>`. It is **review-only** and is meant to
be stripped (along with its portal target in `NavHeader`) when a section
graduates into the live repo.

- Props: `steps` (number of autoplay/step beats; `0` hides the Auto/step row) and
  `render({ initialStep, autoplay })` — a callback that returns the section.
- Provides three control groups, portaled into the header slot: Auto play/pause,
  step pin (1..steps), and desktop/mobile viewport width (mobile clamps to 393px).
- Pages pass `key={`${initialStep}-${autoplay}`}` to the section so toggling a
  control remounts it fresh.

### Draft sections — `src/components/sections/`

Each is a `"use client"` component with a co-located `.module.css`.

| Route | Component | Notes |
|---|---|---|
| `/` | `HeroSection` | Hero Draft 1. Video-modal hero; `VIDEO_SRC` is a placeholder sample video (TODO: real walkthrough). |
| `/rhythm/draft-1` | `OngoingArcSection` | "The Rhythm" Draft 1 ("Ongoing / Arc"), **frozen as originally built**. |
| `/rhythm/draft-2` | `RhythmSectionDraft2` | "The Rhythm" Draft 2 — rebuilt from feedback: reshape motion, cross-visit progress bands, loop cue, hover tooltips. |

Section conventions:
- Copy lives in top-of-file `const` arrays (`STEPS`, `EYEBROW`/`HEADLINE`/etc.).
- The arc sections copy exact bezier geometry from Figma (`ARC_D`, centre
  `224,224`, radius `224`). Several JS constants (`DRAW_MS`, `VB` viewBox,
  arc length) **must be kept in sync with values in the matching `.module.css`** —
  the comments call out each pairing.
- `RhythmSectionDraft2` models progress as `CYCLE_BANDS`: three visits each cover
  a band of the arc, the next visit picks up where the last stopped, and exactly
  3 visits complete the goal before wrapping.

## Gotchas

- The `<!-- BEGIN:nextjs-agent-rules -->` block in `AGENTS.md` is **rewritten by
  `next dev`** on every run. Commit it with your work to keep the tree clean;
  deleting it from a diff just re-creates the uncommitted change.
- `CLAUDE.md` imports `AGENTS.md` (`@AGENTS.md`) — keep that line.
