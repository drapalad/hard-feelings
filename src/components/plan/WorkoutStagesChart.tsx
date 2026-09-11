import React from "react";
import { cn } from "@/lib/utils";
import type { UnitStage, WorkoutType } from "@/types";
import { parseWorkoutStages, type WorkoutStageKind } from "./workout-stages";

const KIND_BAR: Record<WorkoutStageKind, string> = {
  warmup: "bg-slate-400",
  cooldown: "bg-slate-400",
  recovery: "bg-sky-400",
  work: "bg-amber-400",
};

function workBar(type: WorkoutType): string {
  if (type === "threshold" || type === "anaerobic") {
    return "bg-red-400";
  }
  return KIND_BAR.work;
}

function segmentTitle(kind: WorkoutStageKind, label: string): string {
  return `${kind} · ${label}`;
}

export default function WorkoutStagesChart({
  structure,
  stages: persistedStages,
  distanceKm,
  type,
}: {
  structure?: string;
  stages?: UnitStage[];
  distanceKm: number;
  type: WorkoutType;
}) {
  const stages = parseWorkoutStages({ structure, stages: persistedStages, distanceKm, type });
  const total = stages.reduce((sum, stage) => sum + stage.weight, 0);

  return (
    <div className="flex h-3 w-full overflow-hidden rounded-sm" role="img" aria-label="Workout stages">
      {stages.map((stage, index) => (
        <div
          key={`${stage.kind}-${index}-${stage.label}`}
          className={cn("min-w-px", stage.kind === "work" ? workBar(type) : KIND_BAR[stage.kind])}
          style={{ flexGrow: stage.weight, flexBasis: 0, width: `${(stage.weight / total) * 100}%` }}
          title={segmentTitle(stage.kind, stage.label)}
          aria-label={segmentTitle(stage.kind, stage.label)}
        />
      ))}
    </div>
  );
}
