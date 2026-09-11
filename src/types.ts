export type WorkoutType = "base" | "recovery" | "tempo" | "threshold" | "anaerobic" | "long";

export type WorkoutStageKind = "warmup" | "work" | "recovery" | "cooldown";

export interface UnitStage {
  kind: WorkoutStageKind;
  label: string;
  duration: string;
  target: string;
}

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type RacePriority = "A" | "B" | "C" | "D";

export interface TrainingUnit {
  date: string;
  type: WorkoutType;
  distanceKm: number;
  structure?: string;
  stages?: UnitStage[];
  frozen: boolean;
}

export interface PlanRevisionSummary {
  id: string;
  createdAt: string;
}

export interface WorkoutLog {
  date: string;
  type: WorkoutType;
  distanceKm: number;
  avgPaceSecPerKm?: number;
  avgHr?: number;
}

export interface RaceInput {
  date: string;
  priority: RacePriority;
  goal?: string;
}

export interface Profile {
  weeklyKm: number;
  longWeekdays: Weekday[];
  restWeekdays: Weekday[];
  mixEasy: number;
  mixThreshold: number;
  mixSpeed: number;
}

export type ProfileView = Omit<Profile, "weeklyKm"> & {
  weeklyKm: number | null;
  lastRaceDate: string | null;
  lastRaceKm: number | null;
  lastRaceTimeSec: number | null;
  coachNotes: string | null;
};
export type ProfilePatch = Partial<Profile>;

export interface Race {
  id: string;
  date: string;
  priority: RacePriority;
  goal?: string;
  name?: string;
}

export function toRaceInput(race: Race): RaceInput {
  if (race.goal === undefined) {
    return { date: race.date, priority: race.priority };
  }
  return { date: race.date, priority: race.priority, goal: race.goal };
}

export interface Plan {
  units: TrainingUnit[];
}

export interface GenerateInput {
  weeklyKm: number;
  races: RaceInput[];
  frozenUnits: TrainingUnit[];
  weekStart: string;
  longWeekdays: Weekday[];
  restWeekdays: Weekday[];
  mixEasy: number;
  mixThreshold: number;
  mixSpeed: number;
}

export type BoundCode = "WEEKLY_VOLUME_EXCEEDED" | "CONSECUTIVE_LONGS" | "FROZEN_ANCHOR_DROPPED";

export interface BoundViolation {
  code: BoundCode;
  severity: "hard" | "soft";
  message: string;
  dates?: string[];
}

export interface ValidateResult {
  hard: BoundViolation[];
  soft: BoundViolation[];
}

export type GenerateErrorCode = "MISSING_WEEKLY_KM" | "INVALID_WEEKLY_KM" | "NO_A_RACE" | "UNSATISFIABLE_BOUNDS";

export type GenerateResult =
  | { ok: true; plan: Plan; validation: ValidateResult }
  | { ok: false; error: { code: GenerateErrorCode; message: string } };

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  weekStart: string;
}

export interface ChatThread {
  id: string;
  title: string | null;
  startedAt: string;
}

export interface LoadedRange {
  from: string;
  to: string;
}

export interface UnitMutation {
  date: string;
  type?: WorkoutType;
  distanceKm?: number;
  structure?: string;
  stages?: UnitStage[] | null;
  delete?: true;
}

export interface PlanDiffEntry {
  date: string;
  before: TrainingUnit | null;
  after: TrainingUnit | null;
}

export type AgentReportKind = "gap" | "algorithm_proposal";

export type AgentReportStatus = "open" | "reviewed";

export interface AgentReport {
  id: string;
  sourceUserId: string;
  weekStart: string;
  kind: AgentReportKind;
  status: AgentReportStatus;
  title: string;
  body: string;
  boundCodes: BoundCode[];
  createdAt: string;
  reviewedAt: string | null;
}

export interface PendingRacesPatch {
  add: { date: string; priority: RacePriority; name?: string; goal?: string }[];
  remove: { id: string }[];
  patch: { id: string; date?: string; priority?: RacePriority; name?: string; goal?: string }[];
}

export interface FlagTurnSnapshot {
  mutations: UnitMutation[];
  log: { date: string; distanceKm?: number } | null;
  profile: ProfilePatch | null;
  freeze: string[] | null;
  unfreeze: string[] | null;
  races: PendingRacesPatch | null;
  validation: ValidateResult;
  dataRequest: LoadedRange | null;
  persist: {
    proposedCount: number;
    appliedCount: number;
    weeksWritten: string[];
  };
}

export interface PendingProfileFreeze {
  id: string;
  weekStart: string;
  profile?: ProfilePatch;
  freeze: string[];
  unfreeze: string[];
  races?: PendingRacesPatch;
  creates?: UnitMutation[];
}
