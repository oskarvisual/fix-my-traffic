import { TIME_CONFIG } from '../../config/game';

const START_MS = Date.parse(`${TIME_CONFIG.startDate}T00:00:00Z`);
const DAY_MS = 86_400_000;

/** Calendar date (UTC) for a simulation day index. */
export function dateForDay(day: number): Date {
  return new Date(START_MS + Math.floor(day) * DAY_MS);
}

export function isFirstDayOfMonth(day: number): boolean {
  return dateForDay(day).getUTCDate() === 1;
}

export function isFirstDayOfYear(day: number): boolean {
  const d = dateForDay(day);
  return d.getUTCDate() === 1 && d.getUTCMonth() === 0;
}

/** Simulated days produced by `realSeconds` of wall time at a speed multiplier. */
export function simDaysForRealTime(realSeconds: number, speed: number): number {
  if (speed <= 0 || realSeconds <= 0) return 0;
  return (realSeconds * speed) / TIME_CONFIG.realSecondsPerSimDayAt1x;
}

/** Days between two day indices expressed in months (approx.). */
export function daysToMonths(days: number): number {
  return days / 30.44;
}
