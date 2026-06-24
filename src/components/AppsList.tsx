import { AppWindow } from "lucide-react";
import type { AppUsage } from "../lib/types";
import { formatDuration, percent } from "../lib/format";
import { EmptyState } from "./ui";

function pretty(name: string): string {
  return name.replace(/\.exe$/i, "");
}

export function AppsList({
  apps,
  limit = 12,
}: {
  apps: AppUsage[];
  limit?: number;
}) {
  if (!apps.length) {
    return (
      <EmptyState
        icon={<AppWindow size={20} />}
        title="No apps logged yet"
        hint="Apps you work in will appear here with time spent."
      />
    );
  }
  const top = apps.slice(0, limit);
  return (
    <ul className="space-y-3">
      {top.map((a) => (
        <li key={a.appName}>
          <div className="mb-1.5 flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: a.categoryColor ?? "var(--c-faint)" }}
            />
            <span className="truncate font-medium text-text">{pretty(a.appName)}</span>
            {a.categoryName && (
              <span className="hidden truncate text-xs text-faint sm:inline">
                {a.categoryName}
              </span>
            )}
            <span className="ml-auto shrink-0 tabular-nums text-muted">
              {formatDuration(a.activeMs)}
            </span>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-faint">
              {percent(a.share)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, a.share * 100)}%`,
                background: a.categoryColor ?? "var(--c-accent)",
              }}
            />
          </div>
        </li>
      ))}
      {apps.length > limit && (
        <li className="pt-1 text-xs text-faint">+{apps.length - limit} more apps</li>
      )}
    </ul>
  );
}
