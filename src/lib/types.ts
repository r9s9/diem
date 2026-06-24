// diem — shared domain types.
//
// This is the contract between the Rust core (Tauri commands) and the React UI.
// Timestamps are Unix epoch MILLISECONDS in UTC (numbers), matching the SQLite schema.
// Keep field names in sync with `src-tauri/migrations/*.sql` and the serde structs
// in `src-tauri/src/db` and `commands.rs`.

export type Uuid = string;
export type EpochMs = number;

export type SessionState = "active" | "idle" | "locked" | "away";
export type CategorySource = "rule" | "ai" | "user";
export type RuleMatchType = "process" | "domain" | "title_regex" | "app";
export type RuleSource = "builtin" | "user" | "ai";
export type SummaryPeriod = "day" | "week" | "month";
export type SummarySource = "local" | "cloud";
export type SystemEventKind =
  | "lock"
  | "unlock"
  | "suspend"
  | "resume"
  | "startup"
  | "shutdown";

// --- Core records (mirror DB tables) ---------------------------------------

export interface Category {
  id: Uuid;
  name: string;
  color: string; // hex
  icon?: string | null;
  isBillable: boolean;
  isIdle: boolean;
  sortOrder: number;
}

export interface CategoryRule {
  id: Uuid;
  matchType: RuleMatchType;
  pattern: string;
  categoryId: Uuid;
  priority: number;
  source: RuleSource;
  enabled: boolean;
}

export interface ActivitySession {
  id: Uuid;
  startTs: EpochMs;
  endTs: EpochMs;
  durationMs: number;
  state: SessionState;
  appName?: string | null;
  processPath?: string | null;
  windowTitle?: string | null;
  urlDomain?: string | null;
  urlFull?: string | null;
  docName?: string | null;
  categoryId?: Uuid | null;
  categorySource?: CategorySource | null;
  confidence?: number | null;
}

export interface SystemEvent {
  id: Uuid;
  kind: SystemEventKind;
  ts: EpochMs;
}

export interface CalendarEvent {
  id: Uuid;
  externalId?: string | null;
  subject?: string | null;
  startTs: EpochMs;
  endTs: EpochMs;
  isAllDay: boolean;
  isOnline: boolean;
  onlineProvider?: string | null;
  organizerName?: string | null;
  organizerEmail?: string | null;
  attendeeCount?: number | null;
  showAs?: string | null;
  location?: string | null;
  webLink?: string | null;
  attended?: boolean | null;
  categoryId?: Uuid | null;
}

export interface Summary {
  id: Uuid;
  periodType: SummaryPeriod;
  periodKey: string; // 'YYYY-MM-DD' | 'YYYY-Www' | 'YYYY-MM'
  narrative: string;
  totalsJson?: string | null;
  model?: string | null;
  source: SummarySource;
  generatedAt: EpochMs;
}

export interface Exclusion {
  id: Uuid;
  matchType: RuleMatchType;
  pattern: string;
  note?: string | null;
  enabled: boolean;
}

// --- View / aggregation DTOs (computed in Rust, consumed by the UI) ---------

/** One contiguous block on the daily timeline, already joined to its category. */
export interface TimelineBlock {
  startTs: EpochMs;
  endTs: EpochMs;
  durationMs: number;
  state: SessionState;
  label: string; // app or doc title for display
  appName?: string | null;
  categoryId?: Uuid | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  urlDomain?: string | null;
}

/** A continuous on/off span derived from system_events + sessions. */
export interface OnOffBand {
  startTs: EpochMs;
  endTs: EpochMs;
  kind: "on" | "idle" | "locked" | "off";
}

export interface CategoryTotal {
  categoryId: Uuid | null;
  categoryName: string;
  categoryColor: string;
  activeMs: number;
  share: number; // 0..1 of tracked active time
}

export interface AppUsage {
  appName: string;
  activeMs: number;
  categoryName?: string | null;
  categoryColor?: string | null;
  share: number; // 0..1 of tracked active time
}

export interface DayView {
  day: string; // YYYY-MM-DD (local)
  firstActivityTs?: EpochMs | null;
  lastActivityTs?: EpochMs | null;
  activeMs: number;
  idleMs: number;
  onMs: number; // machine on (unlocked) time
  meetingMs: number;
  blocks: TimelineBlock[];
  bands: OnOffBand[];
  categories: CategoryTotal[];
  apps: AppUsage[];
  meetings: CalendarEvent[];
  summary?: Summary | null;
}

export interface PeriodDayBucket {
  day: string; // YYYY-MM-DD
  activeMs: number;
  idleMs: number;
  meetingMs: number;
  categories: CategoryTotal[];
}

export interface PeriodView {
  periodType: SummaryPeriod;
  periodKey: string;
  startDay: string;
  endDay: string;
  activeMs: number;
  idleMs: number;
  meetingMs: number;
  days: PeriodDayBucket[];
  categories: CategoryTotal[];
  apps: AppUsage[];
  summary?: Summary | null;
}

// --- Settings & status ------------------------------------------------------

export interface Settings {
  tracking: {
    enabled: boolean;
    pollIntervalMs: number;
    idleThresholdSec: number;
    captureBrowserUrls: boolean; // domain always; full URL only when true
    captureDocNames: boolean;
  };
  ai: {
    localEnabled: boolean; // Ollama categorization
    ollamaModel: string;
    cloudSummariesEnabled: boolean; // opt-in Claude
    cloudSendDetail: boolean; // send raw titles vs aggregates only
  };
  calendar: {
    connected: boolean;
    account?: string | null;
    syncIntervalMin: number;
  };
  startup: {
    autostart: boolean;
    startMinimized: boolean;
  };
}

export interface TrackingStatus {
  running: boolean;
  paused: boolean;
  currentApp?: string | null;
  currentTitle?: string | null;
  state: SessionState;
  todayActiveMs: number;
  lastFlushTs?: EpochMs | null;
}

export interface OllamaStatus {
  installed: boolean;
  running: boolean;
  models: string[];
  recommendedModel: string;
}

export interface CalendarStatus {
  connected: boolean;
  account?: string | null;
  lastSyncTs?: EpochMs | null;
}
