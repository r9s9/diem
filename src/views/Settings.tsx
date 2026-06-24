import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarCheck,
  Cpu,
  Power,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { Settings as SettingsT } from "../lib/types";
import { api } from "../lib/api";
import { useApiData } from "../lib/hooks";
import { useApp, type ThemeMode } from "../state/store";
import { Badge, Card, SectionLabel, Segmented, Spinner, Toggle } from "../components/ui";

function Row({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-text">{title}</div>
        {desc && <div className="text-xs text-muted">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Group({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-accent">{icon}</span>
        <SectionLabel>{title}</SectionLabel>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </Card>
  );
}

export function Settings() {
  const { theme, setTheme } = useApp();
  const { data } = useApiData(() => api.getSettings(), []);
  const ollama = useApiData(() => api.getOllamaStatus(), []);
  const calendar = useApiData(() => api.getCalendarStatus(), []);
  const [draft, setDraft] = useState<SettingsT | null>(null);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  if (!draft) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  function save(next: SettingsT) {
    setDraft(next);
    void api.updateSettings(next);
  }
  const patch = <K extends keyof SettingsT>(key: K, value: Partial<SettingsT[K]>) =>
    save({ ...draft!, [key]: { ...draft![key], ...value } });

  async function connectCalendar() {
    await api.connectCalendar();
    calendar.reload();
  }

  return (
    <div className="animate-in mx-auto max-w-2xl space-y-4">
      <Group icon={<Power size={15} />} title="Tracking">
        <Row title="Track activity" desc="Passively record apps, windows and on/off time.">
          <Toggle
            checked={draft.tracking.enabled}
            onChange={(v) => patch("tracking", { enabled: v })}
          />
        </Row>
        <Row title="Idle threshold" desc="Seconds of no input before you're marked idle.">
          <input
            type="number"
            min={30}
            max={600}
            value={draft.tracking.idleThresholdSec}
            onChange={(e) => patch("tracking", { idleThresholdSec: Number(e.target.value) })}
            className="w-20 rounded-lg border border-border bg-surface-2 px-2 py-1 text-right text-sm tabular-nums"
          />
        </Row>
        <Row
          title="Record full URLs"
          desc="Off = store only the domain (e.g. github.com). On = full page URL."
        >
          <Toggle
            checked={draft.tracking.captureBrowserUrls}
            onChange={(v) => patch("tracking", { captureBrowserUrls: v })}
          />
        </Row>
        <Row title="Record document names" desc="From window titles, e.g. report.docx.">
          <Toggle
            checked={draft.tracking.captureDocNames}
            onChange={(v) => patch("tracking", { captureDocNames: v })}
          />
        </Row>
      </Group>

      <Group icon={<Sparkles size={15} />} title="AI">
        <Row
          title="On-device categorization"
          desc="Sort activity locally with a small model. Nothing leaves your laptop."
        >
          <div className="flex items-center gap-2">
            <Badge tone={ollama.data?.running ? "good" : "warn"}>
              {ollama.data?.installed
                ? ollama.data.running
                  ? "Ollama running"
                  : "Ollama installed"
                : "Ollama not found"}
            </Badge>
            <Toggle
              checked={draft.ai.localEnabled}
              onChange={(v) => patch("ai", { localEnabled: v })}
            />
          </div>
        </Row>
        <Row
          title="Cloud summaries (opt-in)"
          desc="Send aggregated totals to Claude for richer weekly/monthly recaps."
        >
          <Toggle
            checked={draft.ai.cloudSummariesEnabled}
            onChange={(v) => patch("ai", { cloudSummariesEnabled: v })}
          />
        </Row>
        <Row
          title="Include detail in cloud requests"
          desc="When off, only category totals are sent — never window titles or URLs."
        >
          <Toggle
            disabled={!draft.ai.cloudSummariesEnabled}
            checked={draft.ai.cloudSendDetail}
            onChange={(v) => patch("ai", { cloudSendDetail: v })}
          />
        </Row>
      </Group>

      <Group icon={<CalendarCheck size={15} />} title="Calendar">
        <Row
          title="Outlook & Teams"
          desc={
            calendar.data?.connected
              ? `Connected as ${calendar.data.account}`
              : "Pull meetings via Microsoft Graph."
          }
        >
          {calendar.data?.connected ? (
            <Badge tone="good">Connected</Badge>
          ) : (
            <button
              onClick={connectCalendar}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:opacity-90"
            >
              Connect
            </button>
          )}
        </Row>
        <Row title="Sync every" desc="How often to refresh calendar data.">
          <select
            value={draft.calendar.syncIntervalMin}
            onChange={(e) => patch("calendar", { syncIntervalMin: Number(e.target.value) })}
            className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm"
          >
            {[15, 30, 60, 120].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </Row>
      </Group>

      <Group icon={<ShieldCheck size={15} />} title="Privacy & startup">
        <Row title="Launch at login" desc="Start diem automatically and keep tracking.">
          <Toggle
            checked={draft.startup.autostart}
            onChange={(v) => patch("startup", { autostart: v })}
          />
        </Row>
        <Row title="Start minimized to tray" desc="Open quietly without a window.">
          <Toggle
            checked={draft.startup.startMinimized}
            onChange={(v) => patch("startup", { startMinimized: v })}
          />
        </Row>
        <Row title="Appearance" desc="Theme for the diem window.">
          <Segmented<ThemeMode>
            value={theme}
            onChange={setTheme}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </Row>
      </Group>

      <p className="px-1 text-xs leading-relaxed text-faint">
        diem stores everything in an encrypted database on this device. No activity is
        uploaded unless you turn on cloud summaries. See PRIVACY.md for details.
      </p>
    </div>
  );
}
