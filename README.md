# diem

> Private, on-device work-activity tracker that turns what you actually did into a
> timesheet narrative you can paste anywhere.

**diem** runs quietly in your Windows tray, records which apps, windows, sites and
documents you work in (and when you're idle or away), pulls your Outlook/Teams meetings,
and uses **local AI** to categorize the day and write a plain-language summary — so filling
in a client timesheet takes seconds instead of guesswork. All data stays **encrypted on
your laptop**. See [PRIVACY.md](PRIVACY.md).

---

## Status

🚧 **Pre-alpha / under active construction.** Building per the plan in
`~/.claude/plans/`. Phase 0 (scaffold) in progress.

## Highlights

- **Daily / weekly / monthly** views of activity and on/off time.
- **Local-first AI**: rules + a local LLM (Ollama) categorize activity; optional, opt-in
  Claude API for richer weekly/monthly summaries.
- **Calendar-aware**: Outlook + Teams meetings via Microsoft Graph, overlaid on your
  timeline and reconciled with tracked time.
- **Private by design**: encrypted SQLite (SQLCipher), key sealed with Windows DPAPI;
  no server, no automatic upload.
- **Minimal, modern UI**: React + Tailwind, tray-first, low footprint.

## Architecture

| Layer | Tech |
|-------|------|
| Shell / system access | **Tauri 2** + **Rust** (`windows` crate, UI Automation) |
| UI | **React + TypeScript + Tailwind** (Vite) |
| Storage | **SQLite + SQLCipher**, key via Windows DPAPI / Credential Manager |
| Local AI | **Ollama** (categorization + summaries) |
| Cloud AI (opt-in) | **Claude API** (weekly/monthly narratives only) |
| Calendar | **Microsoft Graph** (OAuth 2.0 + PKCE) |

```
src-tauri/            Rust core (system access, DB, AI, Graph)
  src/
    tracker/          foreground / idle / session / browser / aggregate
    db/               schema, repository, encryption (DPAPI)
    categorize/       rule engine + local-LLM fallback
    calendar/         Graph OAuth + calendar pull
    ai_summary/       local (Ollama) + opt-in cloud (Claude)
    commands.rs       Tauri commands exposed to the UI
  migrations/         SQL schema migrations
src/                  React UI (views, components, lib)
```

The data layer is **sync-ready**: every row carries `id` (UUID), `device_id`,
`updated_at`, and a soft-delete `deleted_at`, so an optional end-to-end-encrypted sync
can be added later without a schema migration. v1 ships fully standalone.

## Prerequisites (Windows dev)

- **Node.js** ≥ 20 and npm — ✅ present
- **Rust** (rustup, stable-msvc) — installed via `winget install Rustlang.Rustup`
- **Visual Studio 2022 Build Tools** with the **Desktop C++ (VCTools)** workload +
  Windows SDK — `winget install Microsoft.VisualStudio.2022.BuildTools` (needs admin)
- **WebView2 Runtime** — ✅ present (ships with Windows 11)
- **Ollama** (optional, for local AI) — https://ollama.com ; then `ollama pull llama3.2:3b`

## Develop

```powershell
npm install
pwsh scripts\dev.ps1     # loads the MSVC+Perl+NASM build env, then `tauri dev`
```

`scripts\dev.ps1` exists because the Rust core links SQLCipher's vendored OpenSSL,
which needs the MSVC toolchain (`vcvars64`), Strawberry Perl and NASM all on `PATH`.
The script wires that up; a plain `npm run tauri dev` from a vanilla shell will fail to
find `nmake`/`perl`/`nasm`. (`scripts\load-build-env.ps1` is the reusable env loader.)

## Build

```powershell
pwsh scripts\build.ps1   # release installer in src-tauri\target\release\bundle
```

## Configuration

- **Microsoft Graph**: requires a one-time Azure AD app registration (public client,
  redirect `http://localhost`, scopes `Calendars.Read offline_access User.Read`). The
  client ID goes in `src-tauri/diem.config.json` (see `diem.config.example.json`).
- **Cloud summaries**: paste a Claude API key in Settings (stored in Windows Credential
  Manager). Off by default.

## License

Proprietary — internal company tool. © 2026.
