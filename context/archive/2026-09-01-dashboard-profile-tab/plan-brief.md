# Dashboard Week / Profile Tabs — Plan Brief

> Full plan: `context/changes/dashboard-profile-tab/plan.md`

## What & Why

Today `/dashboard` stacks athlete setup (weekly km + race calendar) above the training week and chat, so the plan sits below the fold. This change adds Week (default) and Profile tabs so daily use opens on the plan; setup stays one click away.

## Starting Point

`dashboard.astro` hydrates `SetupForm` then `PlanWorkspace` as two `client:load` islands inside the glass card. There is no tab pattern in the repo. Chat and chrome are owned by other changes.

## Desired End State

Signed-in `/dashboard` opens on **Week** (`PlanWorkspace`). **Profile** shows `SetupForm` unchanged. Glass card and gradient H1 stay as they are. Chat markup and handlers are untouched. In-session week/chat state survives switching to Profile and back.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Tab labels and default | Week (default) and Profile | Locked in change Notes; plan must be above the fold on first paint | Plan |
| Wrapper location | `src/components/dashboard/DashboardTabs.tsx` plus `dashboard-tabs.ts` | Matches `setup/` and `plan/` folders; Notes asked for a wrapper under `src/components/` | Plan |
| Single island | One `client:load` wrapper; children are React imports, not nested Astro islands | Two islands cannot share selected-tab state | Plan |
| Tab primitive | Native `tablist` / `tab` / `tabpanel`; no shadcn Tabs | Repo has no Tabs component; two tabs do not justify a new Radix dependency | Unattended |
| Inactive panel | Hide with `hidden`; keep both children mounted | Unmounting `PlanWorkspace` would reset chat/week `useState` and would change chat | Unattended |
| URL persistence | In-memory only; no `?tab=` or hash | Nothing in the app deep-links dashboard panels; default Week is the product intent | Unattended |
| Testing | Node Vitest on the tab contract; no Playwright / jsdom | Matches `PlanCalendar.test.ts` and test-plan §6.3 | Unattended |
| Sign out | Leave the bottom form where it is; do not move it into Profile | Chrome / duplicate Sign out belongs to `dashboard-chrome` | Plan |

## Scope

**In scope:** tab contract + test; `DashboardTabs` island; `dashboard.astro` wiring.

**Out of scope:** glass/H1 restyle; chat changes; collapsed add-race; URL tabs; new packages; moving or removing Sign out.

## Architecture / Approach

`dashboard.astro` keeps SSR fetches and chrome. It hydrates `DashboardTabs`, which holds selected tab in `useState`, renders ARIA tabs, and shows `PlanWorkspace` or `SetupForm` via `hidden` (not unmount). A sibling `.ts` module owns ids/labels/default so Node tests do not import the island.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Tab contract | Default Week + labels locked in Vitest | Labels drift from Notes if the island hard-codes strings |
| 2. Dashboard tab island | One island on `/dashboard`; setup behind Profile | Unmounting Week would drop chat state; touching chrome classes collides with `dashboard-chrome` |

**Prerequisites:** signed-in dashboard with `SetupForm` + `PlanWorkspace` (already shipped).
**Estimated effort:** one session, two phases.

## Open Risks & Assumptions

- Parallel `dashboard-chrome` edits the same `dashboard.astro` chrome strings — this plan copies them unchanged.
- `collapsed-add-race` still applies inside Profile after this ships; this plan does not collapse the form.
- Hide-vs-unmount is recorded as FU-037 (was FU-032 in this run; remapped on merge).

## Success Criteria (Summary)

- `/dashboard` defaults to Week with the plan above the fold.
- Profile still edits weekly km and races.
- Chat and dashboard chrome are visually and behaviorally unchanged.
