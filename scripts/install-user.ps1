#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$InstallRoot = Join-Path $env:USERPROFILE ".openagent"
$InstallDir  = Join-Path $InstallRoot "app"
$BinDir      = Join-Path $InstallRoot "bin"
$BinShim     = Join-Path $BinDir "openagent.cmd"

function Write-Step($msg) { Write-Host "  $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  $msg" -ForegroundColor Red }

function Test-Cmd($name) {
  $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Update-EnvPath {
  $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
  $user    = [System.Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = (@($machine, $user) | Where-Object { $_ } ) -join ";"
}

function Invoke-Native {
  param(
    [Parameter(Mandatory)][scriptblock]$Script,
    [switch]$Quiet
  )
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    if ($Quiet) {
      & $Script 2>&1 | Out-Null
    } else {
      & $Script
    }
  } finally {
    $ErrorActionPreference = $prev
  }
  return $LASTEXITCODE
}

function Read-Choice {
  param([string]$Prompt, [string[]]$Keys)
  while ($true) {
    $resp = (Read-Host $Prompt).Trim().ToLower()
    if ($resp -and $Keys -contains $resp) { return $resp }
    Write-Warn "Please enter one of: $($Keys -join ', ')"
  }
}

function Remove-FromUserPath($dir) {
  $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
  if (-not $userPath) { return }
  $parts = $userPath.Split(";") | Where-Object { $_ -and ($_ -ne $dir) }
  $newPath = ($parts -join ";")
  if ($newPath -ne $userPath) {
    [System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")
  }
}

function Uninstall-OpenAgent {
  Write-Step "Uninstalling OpenAgent..."
  if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
  if (Test-Path $BinDir)     { Remove-Item -Recurse -Force $BinDir }
  Remove-FromUserPath $BinDir
  if ((Test-Path $InstallRoot) -and -not (Get-ChildItem -Force $InstallRoot)) {
    Remove-Item -Force $InstallRoot
  }
  Write-Ok "OpenAgent removed."
  Write-Host "  (Sessions and config under $InstallRoot were preserved if present.)"
}

Write-Host ""
Write-Step "Installing OpenAgent..."
Write-Host ""

if (Test-Path $InstallDir) {
  Write-Host ""
  Write-Warn "OpenAgent is already installed at $InstallDir"
  Write-Host ""
  Write-Host "    [u] Update    — reinstall over existing"
  Write-Host "    [r] Remove    — uninstall"
  Write-Host "    [c] Cancel"
  Write-Host ""
  $choice = Read-Choice "  Choice [u/r/c]" @("u", "r", "c", "update", "remove", "cancel")
  switch -Regex ($choice) {
    "^(u|update)$" { Write-Step "Updating..."; Write-Host "" }
    "^(r|remove)$" { Uninstall-OpenAgent; exit 0 }
    "^(c|cancel)$" { Write-Host "  Cancelled."; exit 0 }
  }
}

if (-not (Test-Cmd "node")) {
  Write-Warn "Node.js not found."
  if (Test-Cmd "winget") {
    Write-Step "Installing Node.js LTS via winget..."
    $code = Invoke-Native -Quiet { winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements }
    Update-EnvPath
    if ($code -ne 0) { Write-Err "winget install failed (exit $code)"; exit 1 }
  } elseif (Test-Cmd "choco") {
    Write-Step "Installing Node.js LTS via Chocolatey..."
    $code = Invoke-Native -Quiet { choco install nodejs-lts -y }
    Update-EnvPath
    if ($code -ne 0) { Write-Err "choco install failed (exit $code)"; exit 1 }
  } else {
    Write-Err "Install Node.js 20+ manually: https://nodejs.org/en/download"
    exit 1
  }
}

if (-not (Test-Cmd "node")) {
  Write-Err "Node.js installed but not on PATH. Open a new terminal and rerun."
  exit 1
}

$nodeVerRaw = (& node -v).Trim()
$nodeMajor  = [int]($nodeVerRaw.TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 18) {
  Write-Err "Node.js 18+ required. Found $nodeVerRaw."
  exit 1
}

if (-not (Test-Cmd "npm")) {
  Write-Err "npm not on PATH. Reinstall Node.js from https://nodejs.org."
  exit 1
}

if (Test-Path $InstallDir) {
  Write-Step "Removing previous installation..."
  Remove-Item -Recurse -Force $InstallDir
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $BinDir     | Out-Null

$ScriptDir = Resolve-Path (Join-Path $PSScriptRoot "..")

Copy-Item (Join-Path $ScriptDir "package.json")  $InstallDir
Copy-Item (Join-Path $ScriptDir "tsconfig.json") $InstallDir
Copy-Item -Recurse (Join-Path $ScriptDir "src")  (Join-Path $InstallDir "src")
Copy-Item -Recurse (Join-Path $ScriptDir "bin")  (Join-Path $InstallDir "bin")

Push-Location $InstallDir
try {
  Write-Step "Installing dependencies (this can take a minute)..."
  $code = Invoke-Native -Quiet { npm install --loglevel=error }
  if ($code -ne 0) { Write-Err "npm install failed (exit $code). Rerun and watch output for the cause."; exit 1 }
  $code = Invoke-Native -Quiet { npm install tsx --loglevel=error }
  if ($code -ne 0) { Write-Err "Installing tsx failed (exit $code)."; exit 1 }
} finally {
  Pop-Location
}

$tsxBin = Join-Path $InstallDir "node_modules\.bin\tsx.cmd"
$entry  = Join-Path $InstallDir "src\entrypoints\cli.tsx"

if (-not (Test-Path $tsxBin)) {
  Write-Err "tsx binary missing after install: $tsxBin"
  exit 1
}

$shim = "@echo off`r`n`"$tsxBin`" `"$entry`" %*`r`n"
Set-Content -Path $BinShim -Value $shim -Encoding ASCII -NoNewline

$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
if (-not $userPath) { $userPath = "" }
$pathParts = $userPath.Split(";") | Where-Object { $_ -ne "" }
if ($pathParts -notcontains $BinDir) {
  $newPath = if ($userPath) { "$userPath;$BinDir" } else { $BinDir }
  [System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")
  $env:Path = "$env:Path;$BinDir"
  Write-Ok "Added $BinDir to user PATH"
}

Write-Host ""
Write-Ok "OpenAgent installed!"
Write-Host ""
Write-Host "  Run: openagent"
Write-Host ""
Write-Host "  If 'openagent' isn't found, open a new terminal so PATH refreshes."
Write-Host ""
