// Deterministic mock data so the UI renders meaningfully in a plain browser
// (Vite preview) when the Rust backend isn't attached. Seeded by the day key so
// each day looks stable but distinct. Never used when running under Tauri.
import type {
  AppUsage,
  CalendarEvent,
  CalendarStatus,
  Category,
  CategoryTotal,
  DayView,
  OllamaStatus,
  OnOffBand,
  PeriodDayBucket,
  PeriodView,
  Settings,
  Summary,
  SummaryPeriod,
  TimelineBlock,
  TrackingStatus,
} from "./types";
import { MS_PER_MIN, addDays, parseDayLocal, toDayKey } from "./format";

export const MOCK_CATEGORIES: Category[] = [
  { id: "development", name: "Development", color: "#6366F1", isBillable: true, isIdle: false, sortOrder: 10 },
  { id: "meetings", name: "Meetings", color: "#0EA5E9", isBillable: true, isIdle: false, sortOrder: 20 },
  { id: "email-comms", name: "Email & Comms", color: "#10B981", isBillable: true, isIdle: false, sortOrder: 30 },
  { id: "documents", name: "Documents & Writing", color: "#F59E0B", isBillable: true, isIdle: false, sortOrder: 40 },
  { id: "research", name: "Research & Browsing", color: "#8B5CF6", isBillable: true, isIdle: false, sortOrder: 50 },
  { id: "design", name: "Design", color: "#EC4899", isBillable: true, isIdle: false, sortOrder: 60 },
  { id: "planning", name: "Planning & PM", color: "#14B8A6", isBillable: true, isIdle: false, sortOrder: 70 },
  { id: "breaks-idle", name: "Breaks & Idle", color: "#94A3B8", isBillable: false, isIdle: true, sortOrder: 80 },
];

const CAT = Object.fromEntries(MOCK_CATEGORIES.map((c) => [c.id, c]));

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type Plan = { cat: string; app: string; label: string; mins: number; domain?: string };

const APPS: Record<string, { app: string; labels: string[]; domain?: string }[]> = {
  development: [
    { app: "Code.exe", labels: ["diem — tracker.rs", "diem — commands.rs", "api-gateway — main.go"] },
    { app: "WindowsTerminal.exe", labels: ["pwsh — cargo build", "pwsh — git rebase"] },
    { app: "chrome.exe", labels: ["pull request #482 · acme/diem", "rust docs — std::sync"], domain: "github.com" },
  ],
  meetings: [{ app: "ms-teams.exe", labels: ["Daily standup", "Client sync — Northwind", "Design review"] }],
  "email-comms": [
    { app: "OUTLOOK.EXE", labels: ["Inbox — 3 unread", "RE: invoice Q2"] },
    { app: "slack.exe", labels: ["#engineering", "#client-northwind"], domain: "slack.com" },
  ],
  documents: [
    { app: "WINWORD.EXE", labels: ["Statement of Work.docx", "Weekly report.docx"] },
    { app: "EXCEL.EXE", labels: ["Timesheet-Q2.xlsx", "Budget.xlsx"] },
  ],
  research: [{ app: "chrome.exe", labels: ["how to … — Stack Overflow", "MDN — fetch"], domain: "stackoverflow.com" }],
  design: [{ app: "Figma.exe", labels: ["diem — Today view", "diem — design system"], domain: "figma.com" }],
  planning: [{ app: "chrome.exe", labels: ["DIEM board · Linear", "Sprint 14 · Jira"], domain: "linear.app" }],
};

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function dayPlan(rng: () => number, isWeekend: boolean): Plan[] {
  if (isWeekend && rng() > 0.25) return [];
  const seq: { cat: string; mins: number }[] = [
    { cat: "email-comms", mins: 20 + Math.floor(rng() * 20) },
    { cat: "development", mins: 60 + Math.floor(rng() * 50) },
    { cat: "meetings", mins: 25 + Math.floor(rng() * 10) },
    { cat: "development", mins: 50 + Math.floor(rng() * 60) },
    { cat: "breaks-idle", mins: 35 + Math.floor(rng() * 25) }, // lunch
    { cat: "documents", mins: 30 + Math.floor(rng() * 40) },
    { cat: "research", mins: 20 + Math.floor(rng() * 30) },
    { cat: "meetings", mins: 30 + Math.floor(rng() * 20) },
    { cat: "planning", mins: 15 + Math.floor(rng() * 25) },
    { cat: "development", mins: 40 + Math.floor(rng() * 50) },
    { cat: "email-comms", mins: 15 + Math.floor(rng() * 15) },
  ];
  return seq
    .filter(() => rng() > 0.08)
    .map(({ cat, mins }) => {
      const src = pick(rng, APPS[cat] ?? APPS.development);
      return { cat, app: src.app, label: pick(rng, src.labels), mins, domain: src.domain };
    });
}

export function buildDayView(day: string): DayView {
  const rng = mulberry32(seedOf(day));
  const base = parseDayLocal(day);
  const dow = base.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const startHour = 8 + Math.floor(rng() * 2); // 8–9am
  let cursor = base.getTime() + startHour * 60 * MS_PER_MIN + Math.floor(rng() * 30) * MS_PER_MIN;

  const blocks: TimelineBlock[] = [];
  const totals = new Map<string, number>();
  let activeMs = 0;
  let idleMs = 0;

  for (const p of dayPlan(rng, isWeekend)) {
    // occasional short idle gap between tasks
    if (rng() > 0.6) {
      const gap = (3 + Math.floor(rng() * 8)) * MS_PER_MIN;
      cursor += gap;
    }
    const dur = p.mins * MS_PER_MIN;
    const start = cursor;
    const end = cursor + dur;
    const c = CAT[p.cat];
    const isIdle = c.isIdle;
    blocks.push({
      startTs: start,
      endTs: end,
      durationMs: dur,
      state: isIdle ? "idle" : "active",
      label: p.label,
      appName: p.app,
      categoryId: c.id,
      categoryName: c.name,
      categoryColor: c.color,
      urlDomain: p.domain ?? null,
    });
    if (isIdle) idleMs += dur;
    else {
      activeMs += dur;
      totals.set(p.cat, (totals.get(p.cat) ?? 0) + dur);
    }
    cursor = end;
  }

  const categories: CategoryTotal[] = [...totals.entries()]
    .map(([id, ms]) => ({
      categoryId: id,
      categoryName: CAT[id].name,
      categoryColor: CAT[id].color,
      activeMs: ms,
      share: activeMs ? ms / activeMs : 0,
    }))
    .sort((a, b) => b.activeMs - a.activeMs);

  const appMap = new Map<
    string,
    { ms: number; best: number; name?: string | null; color?: string | null }
  >();
  for (const b of blocks) {
    if (b.state !== "active") continue;
    const key = b.appName ?? "Unknown";
    const e = appMap.get(key) ?? { ms: 0, best: 0 };
    e.ms += b.durationMs;
    if (b.durationMs >= e.best) {
      e.best = b.durationMs;
      e.name = b.categoryName;
      e.color = b.categoryColor;
    }
    appMap.set(key, e);
  }
  const apps: AppUsage[] = [...appMap.entries()]
    .map(([appName, a]) => ({
      appName,
      activeMs: a.ms,
      categoryName: a.name,
      categoryColor: a.color,
      share: activeMs ? a.ms / activeMs : 0,
    }))
    .sort((x, y) => y.activeMs - x.activeMs);

  const meetings = blocks
    .filter((b) => b.categoryId === "meetings")
    .map<CalendarEvent>((b, i) => ({
      id: `mtg-${day}-${i}`,
      subject: b.label,
      startTs: b.startTs,
      endTs: b.endTs,
      isAllDay: false,
      isOnline: true,
      onlineProvider: "teamsForBusiness",
      organizerName: i % 2 ? "You" : "Priya Nair",
      attendeeCount: 3 + (i % 5),
      showAs: "busy",
      attended: true,
      categoryId: "meetings",
    }));

  const first = blocks[0]?.startTs ?? null;
  const last = blocks.length ? blocks[blocks.length - 1].endTs : null;
  const bands: OnOffBand[] = first && last ? buildBands(blocks) : [];
  const meetingMs = meetings.reduce((s, m) => s + (m.endTs - m.startTs), 0);

  return {
    day,
    firstActivityTs: first,
    lastActivityTs: last,
    activeMs,
    idleMs,
    onMs: first && last ? last - first : 0,
    meetingMs,
    blocks,
    bands,
    categories,
    apps,
    meetings,
    summary: activeMs ? buildSummary("day", day, categories, meetings.length) : null,
  };
}

function buildBands(blocks: TimelineBlock[]): OnOffBand[] {
  const bands: OnOffBand[] = [];
  for (const b of blocks) {
    const kind = b.state === "idle" ? "idle" : "on";
    const prev = bands[bands.length - 1];
    if (prev && prev.kind === kind && b.startTs - prev.endTs < 6 * MS_PER_MIN) {
      prev.endTs = b.endTs;
    } else {
      bands.push({ startTs: b.startTs, endTs: b.endTs, kind });
    }
  }
  return bands;
}

function buildSummary(
  periodType: SummaryPeriod,
  periodKey: string,
  categories: CategoryTotal[],
  meetingCount: number,
): Summary {
  const top = categories.slice(0, 3).map((c) => c.categoryName.toLowerCase());
  const narrative =
    `Focused day. Most time went to ${top[0] ?? "deep work"}` +
    (top[1] ? `, with stretches of ${top[1]}` : "") +
    (top[2] ? ` and ${top[2]}` : "") +
    `. ${meetingCount} meeting${meetingCount === 1 ? "" : "s"} attended. ` +
    `Generated locally — review and edit before adding to your timesheet.`;
  return {
    id: `sum-${periodType}-${periodKey}`,
    periodType,
    periodKey,
    narrative,
    model: "llama3.2:3b",
    source: "local",
    generatedAt: Date.now(),
  };
}

export function buildPeriodView(periodType: SummaryPeriod, anchorDay: string): PeriodView {
  const anchor = parseDayLocal(anchorDay);
  let start: Date;
  let count: number;
  if (periodType === "week") {
    const dow = (anchor.getDay() + 6) % 7; // Monday-based
    start = new Date(anchor);
    start.setDate(anchor.getDate() - dow);
    count = 7;
  } else {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  }

  const days: PeriodDayBucket[] = [];
  const totals = new Map<string, number>();
  const appAgg = new Map<
    string,
    { ms: number; best: number; name?: string | null; color?: string | null }
  >();
  let activeMs = 0;
  let idleMs = 0;
  let meetingMs = 0;

  for (let i = 0; i < count; i++) {
    const dayKey = toDayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const dv = buildDayView(dayKey);
    activeMs += dv.activeMs;
    idleMs += dv.idleMs;
    meetingMs += dv.meetingMs;
    for (const c of dv.categories) totals.set(c.categoryId!, (totals.get(c.categoryId!) ?? 0) + c.activeMs);
    for (const a of dv.apps) {
      const e = appAgg.get(a.appName) ?? { ms: 0, best: 0 };
      e.ms += a.activeMs;
      if (a.activeMs >= e.best) {
        e.best = a.activeMs;
        e.name = a.categoryName;
        e.color = a.categoryColor;
      }
      appAgg.set(a.appName, e);
    }
    days.push({
      day: dayKey,
      activeMs: dv.activeMs,
      idleMs: dv.idleMs,
      meetingMs: dv.meetingMs,
      categories: dv.categories,
    });
  }

  const categories: CategoryTotal[] = [...totals.entries()]
    .map(([id, ms]) => ({
      categoryId: id,
      categoryName: CAT[id].name,
      categoryColor: CAT[id].color,
      activeMs: ms,
      share: activeMs ? ms / activeMs : 0,
    }))
    .sort((a, b) => b.activeMs - a.activeMs);

  const apps: AppUsage[] = [...appAgg.entries()]
    .map(([appName, a]) => ({
      appName,
      activeMs: a.ms,
      categoryName: a.name,
      categoryColor: a.color,
      share: activeMs ? a.ms / activeMs : 0,
    }))
    .sort((x, y) => y.activeMs - x.activeMs);

  const endDay = toDayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + count - 1));
  const periodKey = periodType === "week" ? `${anchorDay}/w` : anchorDay.slice(0, 7);

  return {
    periodType,
    periodKey,
    startDay: toDayKey(start),
    endDay,
    activeMs,
    idleMs,
    meetingMs,
    days,
    categories,
    apps,
    summary: buildSummary(periodType, periodKey, categories, Math.round(meetingMs / (35 * MS_PER_MIN))),
  };
}

export const MOCK_TRACKING_STATUS: TrackingStatus = {
  running: true,
  paused: false,
  currentApp: "Code.exe",
  currentTitle: "diem — tracker.rs",
  state: "active",
  todayActiveMs: buildDayView(toDayKey(new Date())).activeMs,
  lastFlushTs: Date.now(),
};

export const MOCK_OLLAMA_STATUS: OllamaStatus = {
  installed: false,
  running: false,
  models: [],
  recommendedModel: "llama3.2:3b",
};

export const MOCK_CALENDAR_STATUS: CalendarStatus = {
  connected: false,
  account: null,
  lastSyncTs: null,
};

export const MOCK_SETTINGS: Settings = {
  tracking: {
    enabled: true,
    pollIntervalMs: 2000,
    idleThresholdSec: 90,
    captureBrowserUrls: false,
    captureDocNames: true,
  },
  ai: {
    localEnabled: true,
    ollamaModel: "llama3.2:3b",
    cloudSummariesEnabled: false,
    cloudSendDetail: false,
  },
  calendar: { connected: false, account: null, syncIntervalMin: 30 },
  startup: { autostart: true, startMinimized: true },
};
