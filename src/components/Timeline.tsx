import { useMemo, useState } from "react";
import type { CalendarEvent, TimelineBlock } from "../lib/types";
import {
  MS_PER_MIN,
  formatClockRange,
  formatDuration,
  minutesSinceMidnight,
} from "../lib/format";
import { cn } from "../lib/cn";

interface Props {
  blocks: TimelineBlock[];
  meetings?: CalendarEvent[];
}

interface Layout {
  startMin: number;
  endMin: number;
  span: number;
  hourTicks: number[];
}

function computeLayout(blocks: TimelineBlock[]): Layout {
  let min = 8 * 60;
  let max = 18 * 60;
  for (const b of blocks) {
    min = Math.min(min, minutesSinceMidnight(b.startTs));
    max = Math.max(max, minutesSinceMidnight(b.endTs));
  }
  const startMin = Math.max(0, Math.floor(min / 60) * 60 - 0);
  const endMin = Math.min(24 * 60, Math.ceil(max / 60) * 60);
  const span = Math.max(60, endMin - startMin);
  const firstHour = Math.ceil(startMin / 60);
  const lastHour = Math.floor(endMin / 60);
  const step = span > 12 * 60 ? 2 : 1;
  const hourTicks: number[] = [];
  for (let h = firstHour; h <= lastHour; h += step) hourTicks.push(h);
  return { startMin, endMin, span, hourTicks };
}

const pct = (n: number) => `${n}%`;

export function Timeline({ blocks, meetings = [] }: Props) {
  const layout = useMemo(() => computeLayout(blocks), [blocks]);
  const [hover, setHover] = useState<{
    block: TimelineBlock;
    left: number;
  } | null>(null);

  const place = (ts: number) =>
    ((minutesSinceMidnight(ts) - layout.startMin) / layout.span) * 100;
  const width = (a: number, b: number) =>
    Math.max(0.4, ((b - a) / MS_PER_MIN / layout.span) * 100);

  const labelHour = (h: number) =>
    h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;

  return (
    <div className="select-none">
      {/* Hour axis */}
      <div className="relative h-4 text-[11px] text-faint">
        {layout.hourTicks.map((h) => (
          <div
            key={h}
            className="absolute -translate-x-1/2"
            style={{ left: pct(((h * 60 - layout.startMin) / layout.span) * 100) }}
          >
            {labelHour(h)}
          </div>
        ))}
      </div>

      {/* Meetings track */}
      {meetings.length > 0 && (
        <div className="relative mb-1 h-6">
          {meetings.map((m) => (
            <div
              key={m.id}
              title={m.subject ?? "Meeting"}
              className="absolute top-0 flex h-6 items-center overflow-hidden rounded-md border border-[var(--c-accent)] bg-accent-soft px-1.5 text-[11px] font-medium text-accent"
              style={{
                left: pct(place(m.startTs)),
                width: pct(width(m.startTs, m.endTs)),
              }}
            >
              <span className="truncate">{m.subject ?? "Meeting"}</span>
            </div>
          ))}
        </div>
      )}

      {/* Activity track */}
      <div
        className="relative h-12 rounded-lg bg-surface-2"
        onMouseLeave={() => setHover(null)}
      >
        {/* hour gridlines */}
        {layout.hourTicks.map((h) => (
          <div
            key={h}
            className="absolute top-0 h-full w-px bg-border/60"
            style={{ left: pct(((h * 60 - layout.startMin) / layout.span) * 100) }}
          />
        ))}

        {blocks.map((b, i) => {
          const idle = b.state === "idle" || b.state === "away";
          const locked = b.state === "locked";
          return (
            <div
              key={i}
              onMouseEnter={() => setHover({ block: b, left: place(b.startTs) })}
              className={cn(
                "absolute top-1 h-10 cursor-pointer rounded-md transition-[filter] hover:brightness-110",
                idle && "opacity-40",
              )}
              style={{
                left: pct(place(b.startTs)),
                width: pct(width(b.startTs, b.endTs)),
                background:
                  idle || locked
                    ? "repeating-linear-gradient(45deg, var(--c-border), var(--c-border) 4px, transparent 4px, transparent 8px)"
                    : b.categoryColor ?? "var(--c-faint)",
              }}
            />
          );
        })}

        {/* Tooltip */}
        {hover && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-[var(--c-shadow)]"
            style={{ left: pct(Math.min(92, Math.max(8, hover.left))) }}
          >
            <div className="font-medium text-text">
              {hover.block.label || hover.block.appName || "Activity"}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-muted">
              <span>{formatClockRange(hover.block.startTs, hover.block.endTs)}</span>
              <span className="text-faint">·</span>
              <span>{formatDuration(hover.block.durationMs)}</span>
            </div>
            {hover.block.categoryName && (
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: hover.block.categoryColor ?? undefined }}
                />
                <span className="text-muted">{hover.block.categoryName}</span>
                {hover.block.urlDomain && (
                  <span className="text-faint">· {hover.block.urlDomain}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
