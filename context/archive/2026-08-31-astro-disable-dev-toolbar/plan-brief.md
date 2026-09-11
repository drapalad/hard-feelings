# Disable Astro Dev toolbar — Plan Brief

> Full plan: `context/changes/astro-disable-dev-toolbar/plan.md`

## What & Why

The Astro Dev toolbar floats over `/` and `/dashboard` during `astro dev` (FU-017). Production already has no toolbar. This change turns it off in config so local browse matches what members see after a build.

## Starting Point

`astro.config.mjs` is the Astro 6 SSR + Cloudflare config (`output: "server"`). It does not set `devToolbar`, so the overlay is on by default in development.

## Desired End State

`devToolbar.enabled: false` in `astro.config.mjs`. Product UI unchanged. FU-017 Status: done.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| How to hide the overlay | `devToolbar: { enabled: false }` in `astro.config.mjs` | LOCKED; Astro’s supported switch; production already has no toolbar | Plan |
| Product UI | Do not edit Welcome, dashboard, or Topbar | LOCKED; landing cards are FU-016 | Plan |
| Tests | No new Vitest/Playwright; lint + existing tests + build | A config flag is loaded by `astro build`; a toolbar unit test would not exercise `astro dev` | Unattended |
| Docs | No README / env / Wrangler edits | FU-017 names only the config file; toolbar is local-dev only | Unattended |
| Close FU-017 | Status: done in the same phase | Queue “Gotowe gdy” and the item’s Next step | Plan |
| Keep SSR contract | Leave `output: "server"` and other keys | AGENTS.md hard rule | Plan |

## Scope

**In scope:** `astro.config.mjs` `devToolbar`; close FU-017.

**Out of scope:** product UI, FU-016, deploy/infra, new tests, README.

## Architecture / Approach

One `defineConfig` field. Astro reads it at `astro dev` / `astro build`. No runtime product code.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Disable Dev toolbar | Config off + FU-017 done | Accidental drop of `output: "server"` |

**Prerequisites:** none
**Estimated effort:** one short session, one phase

## Open Risks & Assumptions

- Disabling the toolbar removes Astro’s local audit overlay (islands, a11y hints). Accepted: the overlay is unused and blocks the product UI (FU-017).

## Success Criteria (Summary)

- Local `/` and `/dashboard` are not covered by the Astro toolbar.
- Config still declares `output: "server"`.
- FU-017 is done.
