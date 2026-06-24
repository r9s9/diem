// Typed bridge to the Rust core. Every call maps to a #[tauri::command].
// When running outside Tauri (e.g. `vite` in a browser for UI work), each call
// transparently falls back to deterministic mock data so the UI is reviewable.
import { invoke } from "@tauri-apps/api/core";
import type {
  CalendarStatus,
  Category,
  DayView,
  Exclusion,
  OllamaStatus,
  PeriodView,
  Settings,
  Summary,
  SummaryPeriod,
  TrackingStatus,
} from "./types";
import {
  MOCK_CALENDAR_STATUS,
  MOCK_CATEGORIES,
  MOCK_OLLAMA_STATUS,
  MOCK_SETTINGS,
  MOCK_TRACKING_STATUS,
  buildDayView,
  buildPeriodView,
} from "./mock";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function call<T>(
  cmd: string,
  args: Record<string, unknown>,
  mock: () => T,
): Promise<T> {
  if (!isTauri()) return mock();
  return invoke<T>(cmd, args);
}

function mockSummary(periodType: SummaryPeriod, periodKey: string): Summary {
  return {
    id: `sum-${periodType}-${periodKey}`,
    periodType,
    periodKey,
    narrative:
      "Generated locally on your device. Connect a model in Settings for richer summaries.",
    model: "llama3.2:3b",
    source: "local",
    generatedAt: Date.now(),
  };
}

export const api = {
  getDayView: (day: string) =>
    call<DayView>("get_day_view", { day }, () => buildDayView(day)),

  getPeriodView: (periodType: SummaryPeriod, anchorDay: string) =>
    call<PeriodView>(
      "get_period_view",
      { periodType, anchorDay },
      () => buildPeriodView(periodType, anchorDay),
    ),

  getTrackingStatus: () =>
    call<TrackingStatus>("get_tracking_status", {}, () => MOCK_TRACKING_STATUS),

  setTrackingPaused: (paused: boolean) =>
    call<void>("set_tracking_paused", { paused }, () => undefined),

  listCategories: () =>
    call<Category[]>("list_categories", {}, () => MOCK_CATEGORIES),

  setSessionCategory: (sessionId: string, categoryId: string) =>
    call<void>(
      "set_session_category",
      { sessionId, categoryId },
      () => undefined,
    ),

  getSettings: () => call<Settings>("get_settings", {}, () => MOCK_SETTINGS),

  updateSettings: (settings: Settings) =>
    call<void>("update_settings", { settings }, () => undefined),

  generateSummary: (
    periodType: SummaryPeriod,
    periodKey: string,
    force = false,
  ) =>
    call<Summary>(
      "generate_summary",
      { periodType, periodKey, force },
      () => mockSummary(periodType, periodKey),
    ),

  getOllamaStatus: () =>
    call<OllamaStatus>("get_ollama_status", {}, () => MOCK_OLLAMA_STATUS),

  getCalendarStatus: () =>
    call<CalendarStatus>(
      "get_calendar_status",
      {},
      () => MOCK_CALENDAR_STATUS,
    ),

  connectCalendar: () =>
    call<CalendarStatus>("connect_calendar", {}, () => ({
      connected: true,
      account: "you@company.com",
      lastSyncTs: Date.now(),
    })),

  syncCalendar: () =>
    call<CalendarStatus>("sync_calendar", {}, () => MOCK_CALENDAR_STATUS),

  listExclusions: () =>
    call<Exclusion[]>("list_exclusions", {}, () => []),

  addExclusion: (matchType: string, pattern: string, note?: string) =>
    call<void>("add_exclusion", { matchType, pattern, note }, () => undefined),

  removeExclusion: (id: string) =>
    call<void>("remove_exclusion", { id }, () => undefined),
};

export type DiemApi = typeof api;
