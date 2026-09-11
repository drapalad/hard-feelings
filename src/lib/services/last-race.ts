import { formatTime, STANDARD_DISTANCES } from "./pace-estimate";

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const STANDARD_KM_EPS = 1e-4;

function standardDistanceLabel(km: number): string | null {
  const match = STANDARD_DISTANCES.find((distance) => Math.abs(km - distance.km) < STANDARD_KM_EPS);
  return match?.label ?? null;
}

function formatCustomKm(km: number): string {
  return String(Number(km.toFixed(4)));
}

export function formatLastRaceChip(date: string, km: number, timeSec: number): string {
  const [yearText, monthText, dayText] = date.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const day = Number(dayText);
  const utc = new Date(Date.UTC(year, monthIndex, day));
  const month = MONTHS_EN[utc.getUTCMonth()] ?? monthText;
  const distance = standardDistanceLabel(km) ?? `${formatCustomKm(km)} km`;
  return `${utc.getUTCDate()} ${month} ${utc.getUTCFullYear()} · ${distance} · ${formatTime(timeSec)}`;
}

export function seedRefDistance(km: number): { label: string; customKm: string } {
  const label = standardDistanceLabel(km);
  if (label !== null) {
    return { label, customKm: "" };
  }
  return { label: "Custom", customKm: formatCustomKm(km) };
}
