import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { Today } from "./views/Today";
import { Period } from "./views/Period";
import { Settings } from "./views/Settings";
import { useInterval } from "./lib/hooks";
import { applyTheme, useApp } from "./state/store";

export default function App() {
  const { view, theme, refresh } = useApp();

  // Apply theme on mount and whenever it changes; react to system changes too.
  useEffect(() => {
    applyTheme(theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme(theme);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Live auto-refresh: pull fresh activity every few seconds so the views stay
  // current without a manual refresh. Cheap (local SQLite) and won't flash the
  // spinner since data is already present.
  useInterval(() => refresh(), 3000);

  return (
    <div className="app-noselect relative flex min-h-screen flex-col text-text">
      <div className="bg-ambient" aria-hidden />
      <div className="relative z-10 flex min-h-screen flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-6">
          {view === "today" && <Today />}
          {view === "week" && <Period periodType="week" />}
          {view === "month" && <Period periodType="month" />}
          {view === "settings" && <Settings />}
        </main>
      </div>
    </div>
  );
}
