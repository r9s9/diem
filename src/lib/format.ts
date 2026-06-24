// Small, dependency-light formatting helpers shared across views.
import type { EpochMs } from "./types";

export const MS_PER_MIN = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "3h 24m", "24m", "45s", "0m" */
export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return "0m";
  const totalMin = Math.round(ms / MS_PER_MIN);
  if (totalMin < 1) return `${Math.round(ms / 1000)}s`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** "3.4h" — decimal hours, handy for timesheet-style readouts. */
export function formatHoursDecimal(ms: number): string {
  return `${(ms / MS_PER_HOUR).toFixed(1)}h`;
}

/** Local wall-clock "09:14". */
export function formatClock(ts: EpochMs): string {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatClockRange(a: EpochMs, b: EpochMs): string {
  return `${formatClock(a)}–${formatClock(b)}`;
}

/** Minutes since local midnight for a timestamp (used to place timeline blocks). */
export function minutesSinceMidnight(ts: EpochMs): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/** "Wed, Jun 24" */
export function formatDayLabel(day: string): string {
  const d = parseDayLocal(day);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "June 2026" */
export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

// --- Day-key helpers (YYYY-MM-DD in LOCAL time) -----------------------------

export function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDayLocal(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toDayKey(new Date());
}

export function addDays(day: string, delta: number): string {
  const d = parseDayLocal(day);
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
}

/** ISO week key like "2026-W26". */
export function toIsoWeekKey(day: string): string {
  const d = parseDayLocal(day);
  // ISO: Thursday-based week numbering.
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / MS_PER_DAY -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7,
    );
  return `${target.getFullYear()}-W${pad2(week)}`;
}

export function toMonthKey(day: string): string {
  const [y, m] = day.split("-");
  return `${y}-${m}`;
}

export function percent(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}
