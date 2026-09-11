# Replace landing starter cards with HardFeelings product copy Implementation Plan

## Overview

Replace the three 10x starter feature cards on the public landing (`src/components/Welcome.astro`) with HardFeelings product copy from the PRD (race priorities + weekly km, algorithmic generation, chat-gated diffs). Keep the existing hero and card chrome. Close FU-016.

## Current State Analysis

`src/pages/index.astro` renders `Welcome` inside `Layout`. The hero already says **HardFeelings** with subtitle “Training plans for amateur runners — live on Cloudflare Workers.” Below it, a three-column grid still ships boilerplate cards: Authentication Ready (lock icon, Supabase auth), Modern Stack (“Astro 5, React 19, Tailwind 4…”), Developer Experience (ESLint/Prettier). That is FU-016.

Cards use inline 24×24 stroke SVGs (Lucide lock / layers / code) and shared chrome: `rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl` in `grid-cols-1 sm:grid-cols-3`. No Vitest or Playwright file asserts this copy. S-01–S-03 (the product the cards should describe) are already shipped.

## Desired End State

A visitor on `/` still sees the HardFeelings hero. The three cards describe the product: weekly km + A–D priorities drive generation; generation is algorithmic and fast; chat shows a diff with accept/reject, soft warnings allowed, hard bounds cannot land. Starter/stack advertising is gone. FU-016 is Status: done under `## Done`.

### Key Discoveries:

- Landing is `Welcome.astro` only; `index.astro` is a one-line wrapper (`src/pages/index.astro`).
- Hero is already product-named; FU-016 Notes: “Cards still advertise the boilerplate and the wrong Astro major.”
- Existing card SVGs are Lucide stroke icons inlined, not `lucide-react` components (Welcome is Astro, not a React island).
- AGENTS.md `cn()` rule applies to new class merges; this change must not restyle chrome or concatenate new class strings.

## What We're NOT Doing

- Hero title, subtitle, Sign In / Sign Up, Topbar, cosmic background, or dashboard.
- Translating the landing to Polish.
- Advertising Astro, React, Tailwind, TypeScript, ESLint, Prettier, Supabase, or “starter”.
- Calendar restore, Admin research, or any other open FU / DEP.
- New Vitest or Playwright tests (copy is asserted by source gates; visual quality is Manual).
- Editing FU-001–FU-014, FU-017, or any DEP-*.
- Converting Welcome to a React island.

## Implementation Approach

One markup edit in `Welcome.astro` (titles, bodies, icons), then close FU-016 in `context/backlog.md`. Verify with source greps plus existing lint, unit tests, and build.

## User experience spec

Card titles and bodies are part of the contract (unattended implementer must not invent a second set). Chrome, type scale, and English voice stay as they are today.

## Phase 1: Product cards and close FU-016

### Overview

Swap the three starter cards for PRD-backed product cards (icons included) and mark FU-016 done.

### Changes Required:

#### 1. Landing cards

**File**: `src/components/Welcome.astro`

**Intent**: Visitors on `/` should learn what HardFeelings does (S-01–S-03), not that this repo started as a 10x starter.

**Contract**: Keep the hero block and the feature-grid wrapper (`mx-auto grid max-w-4xl grid-cols-1 gap-6 px-4 pb-24 sm:grid-cols-3`) and each card’s chrome classes unchanged. Replace only each card’s SVG, `<h3>`, and `<p>`. Do not mention Astro, React, Tailwind, TypeScript, ESLint, Prettier, Supabase, or starter. New titles/bodies, in this order:

1. **Race priorities A–D** — Weekly kilometres and A–D race priorities drive the algorithm — one A-goal plus side events, not a one-size week.
2. **Algorithmic generation** — Plans appear fast from the algorithm, not from a chatbot writing your week. Chat proposes; the algorithm builds and bounds.
3. **Chat with a diff** — Ask to change a day and review a clear proposition. Accept or reject. Soft warnings are yours; hard bounds cannot land.

Replace the lock / layers / code SVGs with Lucide-equivalent inline stroke icons (same `width="24" height="24"`, `stroke-width="2"`, `class="mb-4 text-purple-300"`): calendar, zap, git-compare. Keep them inline SVG (not a React island).

#### 2. Backlog

**File**: `context/backlog.md`

**Intent**: FU-016 is the reason for this change; close it when the cards ship so the queue is honest.

**Contract**: Tick FU-016, set **Status:** done, move the item under `## Done`, add **Done:** 2026-08-31 and a one-line Notes note that the three Welcome cards now describe priorities, algorithmic generation, and chat diffs. Do not edit FU-001–FU-014, FU-017, or DEP-*. Do not open a new FU unless a genuine leftover appears; next free id is FU-018.

### Success Criteria:

#### Automated Verification:

- `src/components/Welcome.astro` has the three `<h3>` titles `Race priorities A–D`, `Algorithmic generation`, and `Chat with a diff`, and contains none of `Authentication Ready`, `Modern Stack`, `Astro 5`, `Developer Experience`, `React`, `Tailwind`, `ESLint`, or `starter`
- Hero `<h1>` is still `HardFeelings` and the hero `<p>` is still `Training plans for amateur runners — live on Cloudflare Workers.`
- Feature grid still includes `sm:grid-cols-3` and cards still include `rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl`
- `context/backlog.md` FU-016 is Status: done, checkbox ticked, listed under `## Done` with Done: 2026-08-31; FU-001–FU-014 headings unchanged
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- Open `/` in a desktop browser and confirm the three cards read as HardFeelings product (priorities, algorithm, chat + diff), not a starter kit, and still sit in a three-column row

---

## Testing Strategy

### Unit Tests:

- None new. Landing copy is static Astro markup; existing `npm test` must still pass. Test-plan §1 cost×signal: this is not a risk-map scenario (#1–#6).

### Integration Tests:

- None. `npm run build` loading `Welcome.astro` is the compile check.

### Manual Testing Steps:

1. Open `/` (signed out) and read the three cards.
2. Confirm hero and Sign In / Sign Up are unchanged and the grid is three columns on a wide viewport.

## Performance Considerations

Static SSR markup only; no extra islands or client JS.

## References

- `context/backlog.md` → FU-016
- `context/foundation/prd.md` — Vision, US-01, FR-002, FR-003, FR-004, FR-006, FR-008
- `context/foundation/roadmap.md` — S-01, S-02, S-03
- `src/components/Welcome.astro`
- `src/pages/index.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Product cards and close FU-016

#### Automated

- [x] 1.1 `src/components/Welcome.astro` has the three `<h3>` titles `Race priorities A–D`, `Algorithmic generation`, and `Chat with a diff`, and contains none of `Authentication Ready`, `Modern Stack`, `Astro 5`, `Developer Experience`, `React`, `Tailwind`, `ESLint`, or `starter` — 837747e
- [x] 1.2 Hero `<h1>` is still `HardFeelings` and the hero `<p>` is still `Training plans for amateur runners — live on Cloudflare Workers.` — 837747e
- [x] 1.3 Feature grid still includes `sm:grid-cols-3` and cards still include `rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl` — 837747e
- [x] 1.4 `context/backlog.md` FU-016 is Status: done, checkbox ticked, listed under `## Done` with Done: 2026-08-31; FU-001–FU-014 headings unchanged — 837747e
- [x] 1.5 `npm test` exits 0 — 837747e
- [x] 1.6 `npm run lint` exits 0 — 837747e
- [x] 1.7 `npm run build` exits 0 — 837747e

#### Manual

- [x] 1.8 Open `/` in a desktop browser and confirm the three cards read as HardFeelings product (priorities, algorithm, chat + diff), not a starter kit, and still sit in a three-column row
