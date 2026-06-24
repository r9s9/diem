# Loads the native build environment diem needs to COMPILE the Rust core:
#   - MSVC (cl/link/nmake) via vcvars64  — for Tauri + the windows crate
#   - Strawberry Perl + its gcc, and NASM — to build SQLCipher's vendored OpenSSL
#   - Rust/Cargo on PATH
# Dot-source this from another script:  . "$PSScriptRoot\load-build-env.ps1"
$ErrorActionPreference = "Stop"

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vs = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vs) { throw "VS Build Tools with the C++ (VCTools) workload not found. Install: winget install Microsoft.VisualStudio.2022.BuildTools" }

# Pull the full MSVC environment (nmake/cl/link) into this session.
cmd /c "call `"$vs\VC\Auxiliary\Build\vcvars64.bat`" >nul && set" | ForEach-Object {
  if ($_ -match '^(?<n>[A-Za-z_][^=]*)=(?<v>.*)$') { Set-Item -Path "Env:$($matches.n)" -Value $matches.v }
}

# Prepend Rust, Perl (+gcc) and NASM. NASM installs per-user under LOCALAPPDATA.
$extra = @(
  "$env:USERPROFILE\.cargo\bin",
  "C:\Strawberry\perl\bin",
  "C:\Strawberry\c\bin",
  "$env:LOCALAPPDATA\bin\NASM"
)
$env:Path = ($extra -join ';') + ';' + $env:Path
