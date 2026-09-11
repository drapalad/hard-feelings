# Disable Astro Dev toolbar Implementation Plan

## Overview

Turn off Astro’s floating Dev toolbar for local `astro dev` so it no longer overlays `/` and `/dashboard`. Production already has no toolbar. Product UI stays untouched.

## Current State Analysis

`astro.config.mjs` sets `output: "server"`, React + sitemap integrations, Tailwind via Vite, the Cloudflare adapter, and `astro:env` secrets. It does not set `devToolbar`, so Astro 6’s default is enabled in development. That overlay is FU-017: it sits on top of landing and dashboard under `astro dev` and is absent after a production build.

No README, test, or other config file mentions `devToolbar`. `src/components/Welcome.astro` is unrelated (FU-016 landing copy).

## Desired End State

Local `astro dev` does not show the Astro Dev toolbar on `/` or `/dashboard`. `astro.config.mjs` has `devToolbar.enabled: false`. `output: "server"` and the rest of the config are unchanged. FU-017 is Status: done. Welcome and dashboard markup are unchanged.

### Key Discoveries:

- `astro.config.mjs` has no `devToolbar` key today — Astro 6 defaults the toolbar on in `astro dev`.
- FU-017 Notes already record that production builds have no toolbar; this change is local-dev only.
- AGENTS.md requires `output: "server"` in this file — the edit must not drop it.

## What We're NOT Doing

- Product UI, landing cards, Topbar, dashboard layout (LOCKED; FU-016 stays open).
- README / `.env.example` / Wrangler / Cloudflare changes.
- A Vitest or Playwright test for the toolbar.
- Changing `output`, the adapter, integrations, or `env.schema`.

## Implementation Approach

One config field in `defineConfig`, then close FU-017 in `context/backlog.md`. Verify with lint, unit tests, and build so the rest of the config still loads.

## Phase 1: Disable Dev toolbar

### Overview

Set `devToolbar.enabled: false` in `astro.config.mjs` and mark FU-017 done.

### Changes Required:

#### 1. Astro config

**File**: `astro.config.mjs`

**Intent**: Stop Astro from injecting the Dev toolbar overlay during `astro dev`.

**Contract**: Inside `defineConfig({...})`, add `devToolbar: { enabled: false }`. Keep `output: "server"` and every existing key (`integrations`, `vite`, `adapter`, `env`) unchanged.

#### 2. Backlog

**File**: `context/backlog.md`

**Intent**: FU-017 is the reason for this change; close it when the config lands so the next-queue “Gotowe gdy” is true on disk.

**Contract**: Under `### FU-017`, set Status to `done`, tick the checkbox, and add a one-line Notes note that `devToolbar.enabled: false` is in `astro.config.mjs`. Do not edit other FU items.

### Success Criteria:

#### Automated Verification:

- `astro.config.mjs` contains `devToolbar: { enabled: false }` (or equivalent nested `enabled: false` under `devToolbar`) and still has `output: "server"`
- `src/components/Welcome.astro` is unchanged in this change
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- Under `astro dev`, `/` and `/dashboard` have no floating Astro Dev toolbar overlay

---

## Testing Strategy

### Unit Tests:

- None new. The flag is Astro runtime config; existing `npm test` must still pass.

### Integration Tests:

- None. Build loading `astro.config.mjs` is the integration check.

### Manual Testing Steps:

1. `npm run dev`, open `/`, confirm no Astro Dev toolbar.
2. Open `/dashboard` (signed in), same check.

## References

- `context/backlog.md` → FU-017
- `astro.config.mjs`
- Astro 6 `devToolbar` config (`enabled`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Disable Dev toolbar

#### Automated

- [x] 1.1 `astro.config.mjs` contains `devToolbar: { enabled: false }` (or equivalent nested `enabled: false` under `devToolbar`) and still has `output: "server"` — 643b586
- [x] 1.2 `src/components/Welcome.astro` is unchanged in this change — 643b586
- [x] 1.3 `npm test` exits 0 — 643b586
- [x] 1.4 `npm run lint` exits 0 — 643b586
- [x] 1.5 `npm run build` exits 0 — 643b586

#### Manual

- [ ] 1.6 Under `astro dev`, `/` and `/dashboard` have no floating Astro Dev toolbar overlay
