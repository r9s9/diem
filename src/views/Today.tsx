import { Activity, AppWindow, CalendarClock, Coffee } from "lucide-react";
import { api } from "../lib/api";
import { useApiData } from "../lib/hooks";
import { useApp } from "../state/store";
import {
  formatClock,
  formatDuration,
  formatHoursDecimal,
} from "../lib/format";
import { Card, SectionLabel, Spinner, StatCard } from "../components/ui";
import { Timeline } from "../components/Timeline";
import { CategoryDonut } from "../components/CategoryDonut";
import { AppsList } from "../components/AppsList";
import { SummaryPanel } from "../components/SummaryPanel";
import { MeetingList } from "../components/MeetingList";

export function Today() {
  const anchorDay = useApp((s) => s.anchorDay);
  const refreshNonce = useApp((s) => s.refreshNonce);
  const { data, loading, error } = useApiData(
    () => api.getDayView(anchorDay),
    [anchorDay, refreshNonce],
  );

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (error) {
    return <Card className="text-sm text-[var(--c-warn)]">Failed to load: {error}</Card>;
  }
  if (!data) return null;

  const onLabel =
    data.firstActivityTs && data.lastActivityTs
      ? `${formatClock(data.firstActivityTs)} – ${formatClock(data.lastActivityTs)}`
      : "—";

  return (
    <div className="animate-in space-y-4">
      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active"
          value={formatDuration(data.activeMs)}
          sub={`${formatHoursDecimal(data.activeMs)} tracked`}
          accent="var(--c-accent)"
        />
        <StatCard label="On / off" value={onLabel} sub={`${formatDuration(data.onMs)} span`} />
        <StatCard
          label="Meetings"
          value={data.meetings.length}
          sub={formatDuration(data.meetingMs)}
        />
        <StatCard
          label="Idle / breaks"
          value={formatDuration(data.idleMs)}
          accent="var(--c-faint)"
        />
      </div>

      {/* Timeline */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Activity size={15} className="text-accent" />
          <SectionLabel>Day timeline</SectionLabel>
        </div>
        <Timeline blocks={data.blocks} meetings={data.meetings} />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
          {data.categories.slice(0, 6).map((c) => (
            <span key={c.categoryId} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: c.categoryColor }} />
              {c.categoryName}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-border" /> Idle
          </span>
        </div>
      </Card>

      {/* Breakdown + apps + summary */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Coffee size={15} className="text-accent" />
            <SectionLabel>Where the time went</SectionLabel>
          </div>
          <CategoryDonut categories={data.categories} totalMs={data.activeMs} />
        </Card>
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <AppWindow size={15} className="text-accent" />
            <SectionLabel>Apps logged</SectionLabel>
          </div>
          <AppsList apps={data.apps} />
        </Card>
        <Card>
          <SummaryPanel periodType="day" periodKey={data.day} initial={data.summary} />
        </Card>
      </div>

      {/* Meetings */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock size={15} className="text-accent" />
          <SectionLabel>Meetings</SectionLabel>
        </div>
        <MeetingList meetings={data.meetings} />
      </Card>
    </div>
  );
}
