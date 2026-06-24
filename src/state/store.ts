import { create } from "zustand";
import {
  addDays,
  parseDayLocal,
  toDayKey,
  todayKey,
} from "../lib/format";

export type ViewId = "today" | "week" | "month" | "settings";
export type ThemeMode = "system" | "light" | "dark";

interface AppState {
  view: ViewId;
  anchorDay: string; // YYYY-MM-DD currently in focus
  theme: ThemeMode;
  /** Bumped by the refresh button; views include it in their data deps. */
  refreshNonce: number;

  setView: (v: ViewId) => void;
  setAnchorDay: (d: string) => void;
  goToToday: () => void;
  /** Step the focused period backward/forward based on the active view. */
  shift: (dir: -1 | 1) => void;
  setTheme: (t: ThemeMode) => void;
  refresh: () => void;
}

function shiftAnchor(view: ViewId, anchor: string, dir: -1 | 1): string {
  switch (view) {
    case "week":
      return addDays(anchor, 7 * dir);
    case "month": {
      const d = parseDayLocal(anchor);
      return toDayKey(new Date(d.getFullYear(), d.getMonth() + dir, 1));
    }
    default:
      return addDays(anchor, dir);
  }
}

export const useApp = create<AppState>((set, get) => ({
  view: "today",
  anchorDay: todayKey(),
  theme: (localStorage.getItem("diem.theme") as ThemeMode) || "system",
  refreshNonce: 0,

  setView: (view) => set({ view }),
  setAnchorDay: (anchorDay) => set({ anchorDay }),
  goToToday: () => set({ anchorDay: todayKey() }),
  shift: (dir) => set({ anchorDay: shiftAnchor(get().view, get().anchorDay, dir) }),
  setTheme: (theme) => {
    localStorage.setItem("diem.theme", theme);
    set({ theme });
  },
  refresh: () => set((s) => ({ refreshNonce: s.refreshNonce + 1 })),
}));

/** Apply the chosen theme to <html>, reacting to system changes when in "system". */
export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && prefersDark);
  root.classList.toggle("dark", dark);
}
