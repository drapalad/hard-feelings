# Fidelity — iso-week-bleed-volume

Merged: `a526179` (`unattended/iso-week-bleed-volume` → `master`)

| id | verdict |
| --- | --- |
| S-04.1 | implemented |
| S-04.2 | implemented |
| S-04.3 | implemented |
| S-04.4 | implemented |
| S-04.5 | implemented |
| S-04.6 | implemented |

Rolling `currentLoad` kept beside `isoWeeks[]` — **FU-143**.

Proof (`git diff 50273d4..a526179`): `+  return \`ISO week includes ${day} ${MONTHS[month - 1]}\`;`
