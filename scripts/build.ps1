# Build a release installer (src-tauri\target\release\bundle). Usage:  pwsh scripts\build.ps1
. "$PSScriptRoot\load-build-env.ps1"
Set-Location (Split-Path $PSScriptRoot -Parent)
npm run tauri build
