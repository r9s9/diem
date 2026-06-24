import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Pause,
  Play,
  RotateCw,
  Settings as Cog,
  Sun,
} from "lucide-react";
import { api } from "../lib/api";
import { useApiData, useInterval } from "../lib/hooks";
import { cn } from "../lib/cn";
import {
  formatDayLabel,
  formatMonthLabel,
  parseDayLocal,
  todayKey,
} from "../lib/format";
import { useApp, type ViewId } from "../state/store";
import { Logo } from "./Logo";
import { Badge } from "./ui";

const NAV: { id: ViewId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

function periodLabel(view: ViewId, anchor: string): string {
  if (view === "month") return formatMonthLabel(anchor.slice(0, 7));
  if (view === "week") {
    const d = parseDayLocal(anchor);
    const dow = (d.getDay() + 6) % 7;
    const start = new Date(d);
    start.setDate(d.getDate() - dow);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (x: Date) =>
      x.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(start)} – ${fmt(end)}`;
  }
  if (anchor === todayKey()) return "Today";
  return formatDayLabel(anchor);
}

export function TopBar() {
  const { view, anchorDay, theme, setView, setTheme, shift, goToToday, refresh } =
    useApp();

  const status = useApiData(() => api.getTrackingStatus(), []);
  useInterval(() => status.reload(), 5000);

  function doRefresh() {
    refresh();
    status.reload();
  }

  const paused = status.data?.paused ?? false;

  async function togglePause() {
    await api.setTrackingPaused(!paused);
    status.reload();
  }

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <header className="app-noselect sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-[var(--glass-bg)] px-4 backdrop-blur-xl">
      {/* Brand */}
      <div className="flex items-center gap-2 pr-1">
        <Logo />
        <span className="text-[15px] font-semibold tracking-tight">diem</span>
      </div>

      {/* Primary nav */}
      <nav className="flex items-center gap-0.5 rounded-xl bg-surface-2 p-0.5">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              view === n.id
                ? "bg-surface text-text shadow-sm"
                : "text-muted hover:text-text",
            )}
          >
            {n.label}
          </button>
        ))}
      </nav>

      {/* Date navigation (hidden in settings) */}
      {view !== "settings" && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => shift(-1)}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
            aria-label="Previous"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-[120px] text-center text-sm font-medium tabular-nums">
            {periodLabel(view, anchorDay)}
          </div>
          <button
            onClick={() => shift(1)}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
            aria-label="Next"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={goToToday}
            className="ml-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-text"
          >
            Today
          </button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Tracking status */}
        <button onClick={togglePause} className="group">
          <Badge tone={paused ? "warn" : "good"}>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                paused ? "bg-[var(--c-warn)]" : "animate-pulse bg-[var(--c-good)]",
              )}
            />
            {paused ? "Paused" : "Tracking"}
            {paused ? (
              <Play size={12} className="opacity-60 group-hover:opacity-100" />
            ) : (
              <Pause size={12} className="opacity-60 group-hover:opacity-100" />
            )}
          </Badge>
        </button>

        <button
          onClick={doRefresh}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text active:rotate-180 active:transition-transform"
          aria-label="Refresh data"
          title="Refresh"
        >
          <RotateCw size={16} />
        </button>
        <button
          onClick={() => setTheme(nextTheme)}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          onClick={() => setView("settings")}
          className={cn(
            "grid h-8 w-8 place-items-center rounded-lg hover:bg-surface-2 hover:text-text",
            view === "settings" ? "bg-surface-2 text-text" : "text-muted",
          )}
          aria-label="Settings"
        >
          <Cog size={17} />
        </button>
      </div>
    </header>
  );
}
