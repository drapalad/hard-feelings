/** Riegel-formula race pace predictor. Client-side only, no persistence. */

export interface PaceEstimate {
  label: string;
  distanceKm: number;
  timeSeconds: number;
  formatted: string;
}

export const STANDARD_DISTANCES = [
  { label: "5K", km: 5 },
  { label: "10K", km: 10 },
  { label: "Half", km: 21.0975 },
  { label: "Marathon", km: 42.195 },
] as const;

const RIEGEL_EXPONENT = 1.06;

/**
 * Predict finish times for standard distances using the Riegel formula:
 * t2 = t1 * (d2 / d1) ^ 1.06
 *
 * @param distanceKm  Reference race distance in kilometres (must be > 0)
 * @param timeSeconds Reference race finish time in seconds (must be > 0)
 * @returns Predicted times for 5K, 10K, Half Marathon, Marathon
 */
export function predictTimes(distanceKm: number, timeSeconds: number): PaceEstimate[] {
  if (distanceKm <= 0 || timeSeconds <= 0 || !Number.isFinite(distanceKm) || !Number.isFinite(timeSeconds)) {
    return [];
  }

  return STANDARD_DISTANCES.map(({ label, km }) => {
    const predicted = timeSeconds * Math.pow(km / distanceKm, RIEGEL_EXPONENT);
    const rounded = Math.round(predicted);
    return {
      label,
      distanceKm: km,
      timeSeconds: rounded,
      formatted: formatTime(rounded),
    };
  });
}

/**
 * Format seconds as H:MM:SS (or MM:SS when under one hour).
 */
export function formatTime(totalSeconds: number): string {
  const s = Math.abs(Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}
