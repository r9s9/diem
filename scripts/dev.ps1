# Run diem in development (Vite + Tauri, hot-reload). Usage:  pwsh scripts\dev.ps1
. "$PSScriptRoot\load-build-env.ps1"
Set-Location (Split-Path $PSScriptRoot -Parent)
npm run tauri dev
