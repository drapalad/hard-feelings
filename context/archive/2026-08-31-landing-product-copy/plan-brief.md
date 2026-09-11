# Replace landing starter cards with HardFeelings product copy — Plan Brief

> Full plan: `context/changes/landing-product-copy/plan.md`

## What & Why

The public landing hero already says HardFeelings, but the three feature cards still advertise the 10x starter (auth, “Astro 5”, DX). FU-016: replace them with product copy so `/` describes race priorities, algorithmic generation, and chat-gated diffs (PRD US-01 / FR-002–004 / FR-006 / FR-008; roadmap S-01–S-03).

## Starting Point

`src/pages/index.astro` renders `Welcome.astro`. Hero + Sign In/Up are product-named. Cards still use lock / layers / code icons and boilerplate titles. S-01–S-03 are already shipped in the app behind auth.

## Desired End State

Three English product cards under an unchanged hero. No stack or starter advertising. FU-016 Status: done under `## Done`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Three cards + icons only; keep hero | LOCKED; FU-016 is the cards, not the heading | Plan |
| Language | English | Landing copy is already English; LOCKED said match the rest | Unattended |
| Card 1 copy | Title `Race priorities A–D`; weekly km + A–D drive the algorithm | LOCKED theme FR-002/FR-003; exact strings so implementer does not invent | Unattended |
| Card 2 copy | Title `Algorithmic generation`; fast algorithm, not an LLM planner | LOCKED theme FR-004; PRD non-goal is no LLM-written planner | Unattended |
| Card 3 copy | Title `Chat with a diff`; accept/reject; hard bounds cannot land | LOCKED theme FR-006/FR-008 | Unattended |
| Icons | Replace lock/layers/code with calendar, zap, git-compare (inline Lucide SVG) | LOCKED: swap if they no longer fit; keep Astro inline SVG, not a React island | Unattended |
| Tests | No new Vitest/Playwright; grep source + `npm test` / lint / build | Test-plan cost×signal; visual quality is Manual | Unattended |
| Close FU-016 | Same phase, Done: 2026-08-31 | LOCKED; queue honesty when cards ship | Plan |

## Scope

**In scope:** `Welcome.astro` card titles, bodies, icons; close FU-016.

**Out of scope:** hero, Topbar, dashboard, Polish translation, other FU/DEP, new test files, React islands.

## Architecture / Approach

Static Astro markup on `/`. No API, schema, or island changes. Backlog item closes in the same phase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Product cards and close FU-016 | New card copy + icons; FU-016 done | Accidental hero/chrome edit or leftover starter phrases |

**Prerequisites:** none (S-01–S-03 already shipped; this is marketing copy)
**Estimated effort:** one short session, one phase

## Open Risks & Assumptions

- Exact card sentences are an unattended reading of the locked themes; Manual 1.8 is the human copy check (no FU — one reasonable mapping, visual QA owns polish).
- Hero still mentions Cloudflare Workers; that is out of scope for FU-016.

## Success Criteria (Summary)

- `/` cards describe HardFeelings product, not the starter.
- Hero and card chrome unchanged.
- FU-016 is done.
