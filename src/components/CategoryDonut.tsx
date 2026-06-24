import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { CategoryTotal } from "../lib/types";
import { formatDuration, percent } from "../lib/format";

export function CategoryDonut({
  categories,
  totalMs,
}: {
  categories: CategoryTotal[];
  totalMs: number;
}) {
  const data = categories.map((c) => ({
    name: c.categoryName,
    value: c.activeMs,
    color: c.categoryColor,
  }));

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-36 w-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.length ? data : [{ name: "none", value: 1, color: "var(--c-border)" }]}
              dataKey="value"
              innerRadius={48}
              outerRadius={68}
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {(data.length ? data : [{ color: "var(--c-border)" }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-lg font-semibold tabular-nums">
            {formatDuration(totalMs)}
          </div>
          <div className="text-[11px] text-faint">tracked</div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {categories.slice(0, 6).map((c) => (
          <li key={c.categoryId} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: c.categoryColor }}
            />
            <span className="truncate text-text">{c.categoryName}</span>
            <span className="ml-auto shrink-0 tabular-nums text-muted">
              {formatDuration(c.activeMs)}
            </span>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-faint">
              {percent(c.share)}
            </span>
          </li>
        ))}
        {categories.length === 0 && (
          <li className="text-sm text-faint">No tracked activity yet.</li>
        )}
      </ul>
    </div>
  );
}
