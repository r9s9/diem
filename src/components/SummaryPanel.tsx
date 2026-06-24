import { useEffect, useState } from "react";
import { Check, Copy, RefreshCw, Sparkles } from "lucide-react";
import type { Summary, SummaryPeriod } from "../lib/types";
import { api } from "../lib/api";
import { Badge, SectionLabel, Spinner } from "./ui";

export function SummaryPanel({
  periodType,
  periodKey,
  initial,
}: {
  periodType: SummaryPeriod;
  periodKey: string;
  initial?: Summary | null;
}) {
  const [summary, setSummary] = useState<Summary | null>(initial ?? null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => setSummary(initial ?? null), [initial, periodKey]);

  async function generate(force: boolean) {
    setLoading(true);
    try {
      setSummary(await api.generateSummary(periodType, periodKey, force));
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!summary) return;
    await navigator.clipboard.writeText(summary.narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-accent" />
          <SectionLabel>AI summary</SectionLabel>
        </div>
        {summary && (
          <Badge tone={summary.source === "local" ? "neutral" : "accent"}>
            {summary.source === "local" ? "On-device" : "Cloud"} ·{" "}
            {summary.model ?? "model"}
          </Badge>
        )}
      </div>

      <div className="selectable min-h-[88px] flex-1 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-text">
        {loading ? (
          <div className="flex items-center gap-2 text-muted">
            <Spinner /> Writing your summary…
          </div>
        ) : summary ? (
          summary.narrative
        ) : (
          <span className="text-faint">
            No summary yet. Generate one to get a plain-language recap you can paste
            into your timesheet.
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => generate(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw size={14} />
          {summary ? "Regenerate" : "Generate"}
        </button>
        <button
          onClick={copy}
          disabled={!summary || loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted hover:text-text disabled:opacity-50"
        >
          {copied ? <Check size={14} className="text-[var(--c-good)]" /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
