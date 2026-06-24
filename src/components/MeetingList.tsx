import { CalendarClock, Users, Video } from "lucide-react";
import type { CalendarEvent } from "../lib/types";
import { formatClockRange, formatDuration } from "../lib/format";
import { Badge } from "./ui";

export function MeetingList({ meetings }: { meetings: CalendarEvent[] }) {
  if (meetings.length === 0) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-faint">
        <CalendarClock size={16} />
        No meetings on this day.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {meetings.map((m) => (
        <li
          key={m.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            {m.isOnline ? <Video size={16} /> : <CalendarClock size={16} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-text">
              {m.subject ?? "(no subject)"}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="tabular-nums">
                {formatClockRange(m.startTs, m.endTs)}
              </span>
              <span className="text-faint">·</span>
              <span>{formatDuration(m.endTs - m.startTs)}</span>
              {m.attendeeCount != null && (
                <>
                  <span className="text-faint">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Users size={12} /> {m.attendeeCount}
                  </span>
                </>
              )}
            </div>
          </div>
          {m.attended != null && (
            <Badge tone={m.attended ? "good" : "neutral"}>
              {m.attended ? "Attended" : "Missed"}
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
