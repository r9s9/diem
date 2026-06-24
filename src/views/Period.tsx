import { AppWindow, BarChart3, Clock } from "lucide-react";
import type { SummaryPeriod } from "../lib/types";
import { api } from "../lib/api";
import { useApiData } from "../lib/hooks";
import { useApp } from "../state/store";
import { formatDuration, formatHoursDecimal } from "../lib/format";
import { Card, SectionLabel, Spinner, StatCard } from "../components/ui";
import { PeriodBars } from "../components/PeriodBars";
import { CategoryDonut } from "../components/CategoryDonut";
import { AppsList } from "../components/AppsList";
import { SummaryPanel } from "../components/SummaryPanel";

export function Period({ periodType }: { periodType: SummaryPeriod }) {
  const { anchorDay, refreshNonce, setView, setAnchorDay } = useApp();
  const { data, loading, error } = useApiData(
    () => api.getPeriodView(periodType, anchorDay),
    [periodType, anchorDay, refreshNonce],
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

  const activeDays = data.days.filter((d) => d.activeMs > 0).length;
  const avgMs = activeDays ? data.activeMs / activeDays : 0;

  function openDay(day: string) {
    setAnchorDay(day);
    setView("today");
  }

  return (
    <div className="animate-in space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={`Active this ${periodType}`}
          value={formatDuration(data.activeMs)}
          sub={`${formatHoursDecimal(data.activeMs)} total`}
          accent="var(--c-accent)"
        />
        <StatCard label="Daily average" value={formatDuration(avgMs)} sub={`${activeDays} active days`} />
        <StatCard label="Meetings" value={formatDuration(data.meetingMs)} />
        <StatCard label="Idle / breaks" value={formatDuration(data.idleMs)} accent="var(--c-faint)" />
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 size={15} className="text-accent" />
          <SectionLabel>Active time by day</SectionLabel>
          <span className="ml-auto text-xs text-faint">click a day to open it</span>
        </div>
        <PeriodBars days={data.days} onSelect={openDay} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Clock size={15} className="text-accent" />
            <SectionLabel>Category breakdown</SectionLabel>
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
          <SummaryPanel
            periodType={periodType}
            periodKey={data.periodKey}
            initial={data.summary}
          />
        </Card>
      </div>
    </div>
  );
}
