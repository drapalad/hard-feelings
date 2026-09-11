import React, { useMemo, useState } from "react";
import { Calendar, Flag, Gauge, NotebookPen, Pencil, Percent, Plus, Timer, Trash2, Type } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatLastRaceChip, seedRefDistance } from "@/lib/services/last-race";
import { formatTime, predictTimes, STANDARD_DISTANCES } from "@/lib/services/pace-estimate";
import { lastRaceWriteSchema, profileWriteSchema, raceWriteSchema } from "@/lib/services/profile-races";
import { sortRacesUpcomingFirst } from "@/lib/services/races";
import { WEEKDAYS, type Race, type RacePriority, type Weekday } from "@/types";

interface SetupFormProps {
  weeklyKm: number | null;
  longWeekdays: Weekday[];
  restWeekdays: Weekday[];
  mixEasy: number;
  mixThreshold: number;
  mixSpeed: number;
  lastRaceDate: string | null;
  lastRaceKm: number | null;
  lastRaceTimeSec: number | null;
  coachNotes: string | null;
  races: Race[];
  onRacesChange: (races: Race[]) => void;
}

interface SavedLastRace {
  lastRaceDate: string;
  lastRaceKm: number;
  lastRaceTimeSec: number;
}

interface ApiErrorBody {
  code: string;
  message: string;
}

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const PRIORITIES: RacePriority[] = ["A", "B", "C", "D"];

function initialLongWeekdays(days: Weekday[]): Weekday[] {
  return days.length === 0 ? ["sat"] : WEEKDAYS.filter((day) => days.includes(day));
}

const fieldClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 focus:ring-2 focus:ring-purple-400 focus:outline-none";

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

const DISTANCE_OPTIONS = [...STANDARD_DISTANCES.map((d) => ({ label: d.label, km: d.km })), { label: "Custom", km: 0 }];

function parseTimeInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parts = trimmed.split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  if (parts.length === 2) {
    const [mm, ss] = parts;
    if (ss >= 60) return null;
    return mm * 60 + ss;
  }
  if (parts.length === 3) {
    const [hh, mm, ss] = parts;
    if (mm >= 60 || ss >= 60) return null;
    return hh * 3600 + mm * 60 + ss;
  }
  return null;
}

function readError(body: unknown): ApiErrorBody {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return { code: "UNKNOWN", message: "Request failed" };
  }
  const error = body.error;
  if (typeof error !== "object" || error === null) {
    return { code: "UNKNOWN", message: "Request failed" };
  }
  const code = "code" in error && typeof error.code === "string" ? error.code : "UNKNOWN";
  const message = "message" in error && typeof error.message === "string" ? error.message : "Request failed";
  return { code, message };
}

function initialSavedLastRace(date: string | null, km: number | null, timeSec: number | null): SavedLastRace | null {
  if (date === null || km === null || timeSec === null) {
    return null;
  }
  return { lastRaceDate: date, lastRaceKm: km, lastRaceTimeSec: timeSec };
}

function lastRaceFromBody(body: unknown): SavedLastRace | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const date = "lastRaceDate" in body && typeof body.lastRaceDate === "string" ? body.lastRaceDate : null;
  const km = "lastRaceKm" in body && typeof body.lastRaceKm === "number" ? body.lastRaceKm : null;
  const timeSec = "lastRaceTimeSec" in body && typeof body.lastRaceTimeSec === "number" ? body.lastRaceTimeSec : null;
  return initialSavedLastRace(date, km, timeSec);
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export default function SetupForm({
  weeklyKm: initialKm,
  longWeekdays: initialLong,
  restWeekdays: initialRest,
  mixEasy: initialEasy,
  mixThreshold: initialThreshold,
  mixSpeed: initialSpeed,
  lastRaceDate: initialLastRaceDate,
  lastRaceKm: initialLastRaceKm,
  lastRaceTimeSec: initialLastRaceTimeSec,
  coachNotes: initialCoachNotes,
  races: initialRaces,
  onRacesChange,
}: SetupFormProps) {
  const seededLastRace = initialSavedLastRace(initialLastRaceDate, initialLastRaceKm, initialLastRaceTimeSec);
  const seededDistance = seededLastRace ? seedRefDistance(seededLastRace.lastRaceKm) : { label: "10K", customKm: "" };
  const [weeklyKm, setWeeklyKm] = useState<number | null>(initialKm);
  const [kmInput, setKmInput] = useState(initialKm === null ? "" : String(initialKm));
  const [kmError, setKmError] = useState<string | undefined>();
  const [kmBusy, setKmBusy] = useState(false);
  const [longWeekdays, setLongWeekdays] = useState<Weekday[]>(() => initialLongWeekdays(initialLong));
  const [restWeekdays, setRestWeekdays] = useState<Weekday[]>(() =>
    WEEKDAYS.filter((day) => initialRest.includes(day)),
  );
  const [mixEasy, setMixEasy] = useState(String(initialEasy));
  const [mixThreshold, setMixThreshold] = useState(String(initialThreshold));
  const [mixSpeed, setMixSpeed] = useState(String(initialSpeed));

  const [races, setRaces] = useState<Race[]>(initialRaces);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [priority, setPriority] = useState<RacePriority>(
    initialRaces.some((race) => race.priority === "A") ? "B" : "A",
  );
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [raceError, setRaceError] = useState<string | undefined>();
  const [raceBusy, setRaceBusy] = useState(false);

  const [lastRaceDateInput, setLastRaceDateInput] = useState(seededLastRace?.lastRaceDate ?? "");
  const [refDistanceLabel, setRefDistanceLabel] = useState(seededDistance.label);
  const [refCustomKm, setRefCustomKm] = useState(seededDistance.customKm);
  const [refTime, setRefTime] = useState(seededLastRace ? formatTime(seededLastRace.lastRaceTimeSec) : "");
  const [savedLastRace, setSavedLastRace] = useState<SavedLastRace | null>(seededLastRace);
  const [lastRaceError, setLastRaceError] = useState<string | undefined>();
  const [lastRaceBusy, setLastRaceBusy] = useState(false);
  const [notesInput, setNotesInput] = useState(initialCoachNotes ?? "");
  const [notesError, setNotesError] = useState<string | undefined>();
  const [notesBusy, setNotesBusy] = useState(false);

  const refDistanceKm = useMemo(() => {
    if (refDistanceLabel === "Custom") {
      const km = Number(refCustomKm);
      return km > 0 && Number.isFinite(km) ? km : null;
    }
    return DISTANCE_OPTIONS.find((d) => d.label === refDistanceLabel)?.km ?? null;
  }, [refDistanceLabel, refCustomKm]);

  const estimates = useMemo(() => {
    const seconds = parseTimeInput(refTime);
    if (seconds === null || seconds <= 0 || refDistanceKm === null) return [];
    return predictTimes(refDistanceKm, seconds);
  }, [refDistanceKm, refTime]);

  const mixEasyN = Number(mixEasy);
  const mixThresholdN = Number(mixThreshold);
  const mixSpeedN = Number(mixSpeed);
  const mixTotal = mixEasyN + mixThresholdN + mixSpeedN;

  function toggleLong(day: Weekday, checked: boolean) {
    setKmError(undefined);
    setLongWeekdays((current) => WEEKDAYS.filter((item) => (item === day ? checked : current.includes(item))));
  }

  function toggleRest(day: Weekday, checked: boolean) {
    setKmError(undefined);
    setRestWeekdays((current) => WEEKDAYS.filter((item) => (item === day ? checked : current.includes(item))));
  }

  function mixBarWidth(part: number): string {
    if (!Number.isFinite(mixTotal) || mixTotal <= 0) {
      return "0%";
    }
    return `${(part / mixTotal) * 100}%`;
  }

  const today = utcToday();
  const upcoming = races.filter((race) => race.date >= today);
  const past = races.filter((race) => race.date < today);
  const formOpen = adding || editingId !== null;

  function resetRaceForm(nextRaces: Race[] = races) {
    setAdding(false);
    setEditingId(null);
    setDate("");
    setPriority(nextRaces.some((race) => race.priority === "A") ? "B" : "A");
    setName("");
    setGoal("");
    setRaceError(undefined);
  }

  function openAdd() {
    resetRaceForm();
    setAdding(true);
  }

  function applySavedLastRace(saved: SavedLastRace) {
    const distance = seedRefDistance(saved.lastRaceKm);
    setSavedLastRace(saved);
    setLastRaceDateInput(saved.lastRaceDate);
    setRefDistanceLabel(distance.label);
    setRefCustomKm(distance.customKm);
    setRefTime(formatTime(saved.lastRaceTimeSec));
  }

  async function saveLastRace(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setLastRaceError(undefined);
    const seconds = parseTimeInput(refTime);
    if (lastRaceDateInput === "" || refDistanceKm === null || seconds === null || seconds <= 0) {
      setLastRaceError("Enter a date, distance, and finish time to save");
      return;
    }
    const parsed = lastRaceWriteSchema.safeParse({
      lastRaceDate: lastRaceDateInput,
      lastRaceKm: refDistanceKm,
      lastRaceTimeSec: seconds,
    });
    if (!parsed.success) {
      setLastRaceError(parsed.error.issues[0]?.message ?? "Check the last race details");
      return;
    }
    setLastRaceBusy(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastRaceDate: parsed.data.lastRaceDate,
          lastRaceKm: parsed.data.lastRaceKm,
          lastRaceTimeSec: parsed.data.lastRaceTimeSec,
        }),
      });
      const body = await readBody(response);
      if (!response.ok) {
        setLastRaceError(readError(body).message);
        return;
      }
      applySavedLastRace(lastRaceFromBody(body) ?? parsed.data);
    } finally {
      setLastRaceBusy(false);
    }
  }

  async function saveKm(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setKmError(undefined);
    const trimmed = kmInput.trim();
    setKmBusy(true);
    try {
      const parsed = profileWriteSchema.safeParse({
        weeklyKm: trimmed === "" ? null : Number(trimmed),
        longWeekdays,
        restWeekdays,
        mixEasy: Number(mixEasy),
        mixThreshold: Number(mixThreshold),
        mixSpeed: Number(mixSpeed),
      });
      if (!parsed.success) {
        setKmError(parsed.error.issues[0]?.message ?? "Check weekly km, long-run days, and mix total");
        return;
      }
      const response = await fetch("/api/profile", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weeklyKm: parsed.data.weeklyKm,
          longWeekdays: parsed.data.longWeekdays,
          restWeekdays: parsed.data.restWeekdays,
          mixEasy: parsed.data.mixEasy,
          mixThreshold: parsed.data.mixThreshold,
          mixSpeed: parsed.data.mixSpeed,
        }),
      });
      const body = await readBody(response);
      if (!response.ok) {
        setKmError(readError(body).message);
        return;
      }
      if (typeof body === "object" && body !== null && "weeklyKm" in body) {
        const savedKm = body.weeklyKm;
        if (savedKm === null) {
          setWeeklyKm(null);
          setKmInput("");
        } else if (typeof savedKm === "number") {
          setWeeklyKm(savedKm);
          setKmInput(String(savedKm));
        }
        setLongWeekdays(parsed.data.longWeekdays);
        setRestWeekdays(parsed.data.restWeekdays);
        setMixEasy(String(parsed.data.mixEasy));
        setMixThreshold(String(parsed.data.mixThreshold));
        setMixSpeed(String(parsed.data.mixSpeed));
      }
    } finally {
      setKmBusy(false);
    }
  }

  async function saveCoachNotes(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotesError(undefined);
    const trimmedKm = kmInput.trim();
    const parsed = profileWriteSchema.safeParse({
      weeklyKm: trimmedKm === "" ? null : Number(trimmedKm),
      longWeekdays,
      restWeekdays,
      mixEasy: Number(mixEasy),
      mixThreshold: Number(mixThreshold),
      mixSpeed: Number(mixSpeed),
      coachNotes: notesInput,
    });
    if (!parsed.success) {
      setNotesError(parsed.error.issues[0]?.message ?? "Check weekly km, long-run days, and mix total");
      return;
    }
    setNotesBusy(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weeklyKm: parsed.data.weeklyKm,
          longWeekdays: parsed.data.longWeekdays,
          restWeekdays: parsed.data.restWeekdays,
          mixEasy: parsed.data.mixEasy,
          mixThreshold: parsed.data.mixThreshold,
          mixSpeed: parsed.data.mixSpeed,
          coachNotes: "coachNotes" in parsed.data ? parsed.data.coachNotes : notesInput,
        }),
      });
      const body = await readBody(response);
      if (!response.ok) {
        setNotesError(readError(body).message);
        return;
      }
      if (typeof body === "object" && body !== null && "coachNotes" in body) {
        const saved = body.coachNotes;
        setNotesInput(typeof saved === "string" ? saved : "");
      }
    } finally {
      setNotesBusy(false);
    }
  }

  function startEdit(race: Race) {
    setAdding(false);
    setEditingId(race.id);
    setDate(race.date);
    setPriority(race.priority);
    setName(race.name ?? "");
    setGoal(race.goal ?? "");
    setRaceError(undefined);
  }

  async function saveRace(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setRaceError(undefined);
    const parsed = raceWriteSchema.safeParse({ date, priority, name, goal });
    if (!parsed.success) {
      setRaceError(parsed.error.issues[0]?.message ?? "Check the race details");
      return;
    }
    setRaceBusy(true);
    try {
      const url = editingId === null ? "/api/races" : `/api/races/${editingId}`;
      const response = await fetch(url, {
        method: editingId === null ? "POST" : "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await readBody(response);
      if (!response.ok) {
        const error = readError(body);
        setRaceError(error.message);
        return;
      }
      const saved = body as Race;
      const next = editingId === null ? [...races, saved] : races.map((race) => (race.id === saved.id ? saved : race));
      const sorted = sortRacesUpcomingFirst(next);
      setRaces(sorted);
      onRacesChange(sorted);
      resetRaceForm(sorted);
    } finally {
      setRaceBusy(false);
    }
  }

  async function removeRace(id: string) {
    setRaceError(undefined);
    setRaceBusy(true);
    try {
      const response = await fetch(`/api/races/${id}`, { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) {
        setRaceError(readError(await readBody(response)).message);
        return;
      }
      const next = races.filter((race) => race.id !== id);
      setRaces(next);
      onRacesChange(next);
      if (editingId === id) {
        resetRaceForm(next);
      }
    } finally {
      setRaceBusy(false);
    }
  }

  return (
    <div className="space-y-8 text-left">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Weekly kilometres</h2>
        {weeklyKm === null ? (
          <p className="text-sm text-blue-100/70">
            No weekly km set yet. Save a typical week to use later for plan generation.
          </p>
        ) : null}
        <form onSubmit={saveKm} className="space-y-3">
          <FormField
            id="weeklyKm"
            label="Weekly km"
            type="number"
            value={kmInput}
            onChange={(value) => {
              setKmInput(value);
              setKmError(undefined);
            }}
            placeholder="47.5"
            error={kmError}
            icon={<Gauge className="size-4" />}
          />
          <WeekdayChecks
            legend="Preferred long-run days"
            name="longWeekdays"
            selected={longWeekdays}
            onToggle={toggleLong}
          />
          <WeekdayChecks legend="Rest weekdays" name="restWeekdays" selected={restWeekdays} onToggle={toggleRest} />
          <p className="text-sm text-blue-100/70">None checked means every day is available.</p>
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-blue-100/80">Stimulus mix</h3>
            <FormField
              id="mixEasy"
              label="Easy"
              type="number"
              value={mixEasy}
              onChange={(value) => {
                setMixEasy(value);
                setKmError(undefined);
              }}
              hint={<p className="mt-1 text-xs text-blue-100/60">Easy = base + recovery + long</p>}
              icon={<Percent className="size-4" />}
            />
            <FormField
              id="mixThreshold"
              label="Threshold"
              type="number"
              value={mixThreshold}
              onChange={(value) => {
                setMixThreshold(value);
                setKmError(undefined);
              }}
              hint={<p className="mt-1 text-xs text-blue-100/60">Threshold = tempo + threshold</p>}
              icon={<Percent className="size-4" />}
            />
            <FormField
              id="mixSpeed"
              label="Speed"
              type="number"
              value={mixSpeed}
              onChange={(value) => {
                setMixSpeed(value);
                setKmError(undefined);
              }}
              hint={<p className="mt-1 text-xs text-blue-100/60">Speed = anaerobic, hills, strides — not gym</p>}
              icon={<Percent className="size-4" />}
            />
            <p className={cn("text-sm", mixTotal === 100 ? "text-blue-100/70" : "text-red-300")}>
              Total {Number.isFinite(mixTotal) ? mixTotal : "—"} / 100
            </p>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
              <span className="bg-emerald-400/80" style={{ width: mixBarWidth(mixEasyN) }} />
              <span className="bg-amber-400/80" style={{ width: mixBarWidth(mixThresholdN) }} />
              <span className="bg-rose-400/80" style={{ width: mixBarWidth(mixSpeedN) }} />
            </div>
          </div>
          <Button type="submit" disabled={kmBusy} className="rounded-lg bg-purple-600 text-white hover:bg-purple-500">
            {kmBusy ? "Saving..." : "Save weekly km"}
          </Button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Coach notes</h2>
        <p className="text-sm text-blue-100/70">These notes go to the coach on every chat turn.</p>
        <form onSubmit={saveCoachNotes} className="space-y-3">
          <div>
            <label htmlFor="coachNotes" className="mb-1 block text-sm text-blue-100/80">
              Notes for the coach
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-3 left-3 size-4 text-white/40">
                <NotebookPen className="size-4" />
              </span>
              <textarea
                id="coachNotes"
                name="coachNotes"
                value={notesInput}
                maxLength={2000}
                rows={4}
                onChange={(event) => {
                  setNotesInput(event.target.value);
                  setNotesError(undefined);
                }}
                placeholder="e.g. Keep Fridays easy — kids' pickup"
                className={cn(fieldClass, "min-h-[6rem] pl-10")}
              />
            </div>
            <ServerError message={notesError} />
          </div>
          <Button
            type="submit"
            disabled={notesBusy}
            className="rounded-lg bg-purple-600 text-white hover:bg-purple-500"
          >
            {notesBusy ? "Saving..." : "Save"}
          </Button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Race calendar</h2>
        {races.length === 0 ? (
          <p className="text-sm text-blue-100/70">No races yet. Add an A race and any side events.</p>
        ) : null}

        {formOpen ? (
          <form onSubmit={saveRace} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-blue-100/80">{editingId === null ? "Add a race" : "Edit race"}</p>
            <FormField
              id="race-date"
              label="Date"
              type="date"
              value={date}
              onChange={(value) => {
                setDate(value);
                setRaceError(undefined);
              }}
              icon={<Calendar className="size-4" />}
            />
            <div>
              <label htmlFor="race-priority" className="mb-1 block text-sm text-blue-100/80">
                Priority
              </label>
              <select
                id="race-priority"
                value={priority}
                onChange={(event) => {
                  setPriority(event.target.value as RacePriority);
                  setRaceError(undefined);
                }}
                className={cn(fieldClass, "pl-3")}
              >
                {PRIORITIES.map((item) => (
                  <option key={item} value={item} className="bg-slate-900">
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <FormField
              id="race-name"
              label="Name (optional)"
              value={name}
              onChange={(value) => {
                setName(value);
                setRaceError(undefined);
              }}
              placeholder="Berlin Marathon"
              icon={<Type className="size-4" />}
            />
            <FormField
              id="race-goal"
              label="Goal (optional)"
              value={goal}
              onChange={(value) => {
                setGoal(value);
                setRaceError(undefined);
              }}
              placeholder="sub-3"
              icon={<Flag className="size-4" />}
            />
            <ServerError message={raceError} />
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={raceBusy}
                className="rounded-lg bg-purple-600 text-white hover:bg-purple-500"
              >
                <Plus className="size-4" />
                {raceBusy ? "Saving..." : editingId === null ? "Add race" : "Save race"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={raceBusy}
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() => {
                  resetRaceForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            disabled={raceBusy}
            className="rounded-lg bg-purple-600 text-white hover:bg-purple-500"
            onClick={openAdd}
          >
            <Plus className="size-4" />
            Add race
          </Button>
        )}

        <RaceGroup title="Upcoming" races={upcoming} busy={raceBusy} onEdit={startEdit} onRemove={removeRace} />
        <RaceGroup title="Past" races={past} busy={raceBusy} onEdit={startEdit} onRemove={removeRace} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Estimated paces</h2>
        <p className="text-sm text-blue-100/70">
          Enter a recent race result to see predicted finish times (Riegel formula).
        </p>
        {savedLastRace ? (
          <p className={cn("inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white")}>
            {formatLastRaceChip(savedLastRace.lastRaceDate, savedLastRace.lastRaceKm, savedLastRace.lastRaceTimeSec)}
          </p>
        ) : null}
        <form onSubmit={saveLastRace} className="space-y-3">
          <FormField
            id="last-race-date"
            label="Race date"
            type="date"
            value={lastRaceDateInput}
            onChange={(value) => {
              setLastRaceDateInput(value);
              setLastRaceError(undefined);
            }}
            icon={<Calendar className="size-4" />}
          />
          <div>
            <label htmlFor="ref-distance" className="mb-1 block text-sm text-blue-100/80">
              Reference distance
            </label>
            <select
              id="ref-distance"
              value={refDistanceLabel}
              onChange={(event) => {
                setRefDistanceLabel(event.target.value);
                setLastRaceError(undefined);
              }}
              className={cn(fieldClass, "pl-3")}
            >
              {DISTANCE_OPTIONS.map((d) => (
                <option key={d.label} value={d.label} className="bg-slate-900">
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          {refDistanceLabel === "Custom" ? (
            <FormField
              id="ref-custom-km"
              label="Distance (km)"
              type="number"
              value={refCustomKm}
              onChange={(value) => {
                setRefCustomKm(value);
                setLastRaceError(undefined);
              }}
              placeholder="15"
              icon={<Gauge className="size-4" />}
            />
          ) : null}
          <FormField
            id="ref-time"
            label="Finish time (MM:SS or H:MM:SS)"
            value={refTime}
            onChange={(value) => {
              setRefTime(value);
              setLastRaceError(undefined);
            }}
            placeholder="41:30"
            icon={<Timer className="size-4" />}
          />
          <ServerError message={lastRaceError} />
          <Button
            type="submit"
            disabled={lastRaceBusy}
            className="rounded-lg bg-purple-600 text-white hover:bg-purple-500"
          >
            {lastRaceBusy ? "Saving..." : "Save"}
          </Button>
        </form>
        {estimates.length > 0 ? (
          <ul className="space-y-2">
            {estimates.map((est) => (
              <li
                key={est.label}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              >
                <span className="font-medium text-white">{est.label}</span>
                <span className="text-blue-100/80">{est.formatted}</span>
              </li>
            ))}
          </ul>
        ) : refTime.trim() !== "" ? (
          <p className="text-sm text-red-300">Enter a valid time (e.g. 41:30 or 1:45:00) to see estimates.</p>
        ) : (
          <p className="text-sm text-blue-100/70">Log a recent race time above to see your estimated paces.</p>
        )}
      </section>
    </div>
  );
}

function WeekdayChecks({
  legend,
  name,
  selected,
  onToggle,
}: {
  legend: string;
  name: string;
  selected: Weekday[];
  onToggle: (day: Weekday, checked: boolean) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-blue-100/80">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((day) => (
          <label key={`${name}-${day}`} className={cn("flex items-center gap-2 text-sm text-white")}>
            <input
              type="checkbox"
              name={name}
              value={day}
              checked={selected.includes(day)}
              onChange={(event) => {
                onToggle(day, event.target.checked);
              }}
              className="size-4 rounded border-white/20 bg-white/10"
            />
            {WEEKDAY_LABELS[day]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RaceGroup({
  title,
  races,
  busy,
  onEdit,
  onRemove,
}: {
  title: string;
  races: Race[];
  busy: boolean;
  onEdit: (race: Race) => void;
  onRemove: (id: string) => void;
}) {
  if (races.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-blue-100/80">{title}</h3>
      <ul className="space-y-2">
        {races.map((race) => (
          <li
            key={race.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <div>
              <p className="font-medium text-white">
                {race.name ?? "Untitled race"}{" "}
                <span className="text-sm font-normal text-purple-200">({race.priority})</span>
              </p>
              <p className="text-sm text-blue-100/70">{race.date}</p>
              {race.goal ? <p className="text-sm text-blue-100/60">{race.goal}</p> : null}
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={busy}
                className="text-white hover:bg-white/10"
                onClick={() => {
                  onEdit(race);
                }}
                aria-label={`Edit ${race.name ?? race.date}`}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={busy}
                className="text-white hover:bg-white/10"
                onClick={() => {
                  onRemove(race.id);
                }}
                aria-label={`Delete ${race.name ?? race.date}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
