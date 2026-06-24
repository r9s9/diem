import type { PeriodDayBucket } from "../lib/types";
import { MS_PER_HOUR, formatDuration, parseDayLocal, todayKey } from "../lib/format";
import { cn } from "../lib/cn";

export function PeriodBars({
  days,
  onSelect,
}: {
  days: PeriodDayBucket[];
  onSelect?: (day: string) => void;
}) {
  const maxMs = Math.max(MS_PER_HOUR, ...days.map((d) => d.activeMs + d.idleMs));
  const compact = days.length > 10;
  const today = todayKey();

  return (
    <div className="flex h-48 items-end gap-1.5">
      {days.map((d) => {
        const date = parseDayLocal(d.day);
        const isToday = d.day === today;
        const totalH = ((d.activeMs + d.idleMs) / maxMs) * 100;
        return (
          <button
            key={d.day}
            onClick={() => onSelect?.(d.day)}
            className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            title={`${formatDuration(d.activeMs)} active`}
          >
            <div className="flex w-full flex-1 items-end justify-center">
              <div
                className="relative flex w-full max-w-[34px] flex-col-reverse overflow-hidden rounded-md bg-surface-2 transition-[height]"
                style={{ height: `${Math.max(2, totalH)}%` }}
              >
                {d.categories.map((c) => (
                  <div
                    key={c.categoryId}
                    style={{
                      height: `${(c.activeMs / Math.max(1, d.activeMs + d.idleMs)) * 100}%`,
                      background: c.categoryColor,
                    }}
                  />
                ))}
              </div>
            </div>
            <div
              className={cn(
                "text-[11px] tabular-nums",
                isToday ? "font-semibold text-accent" : "text-faint",
              )}
            >
              {compact
                ? date.getDate()
                : date.toLocaleDateString(undefined, { weekday: "short" })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
