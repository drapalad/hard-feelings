# Fidelity — load-chart-tabs

Merged: `b2147d3` (`unattended/load-chart-tabs` → `master`)

| id | verdict |
| --- | --- |
| S-14.1 | changed |
| S-14.2 | implemented |
| S-14.3 | implemented |
| S-14.4 | implemented |

S-14.1: tab labels are `km per week` / `daily load (decay 0.85)`, not Weekly / Daily — Notes verdict override. Decay suffix vs shorter `daily load` — **FU-137**.

Proof (`git diff 6d988a5..b2147d3`): `+export const LOAD_CHART_WEEK_TAB = "km per week";` and `+      <div role="tablist" aria-label="Training load"`.
