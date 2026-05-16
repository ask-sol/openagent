#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$InstallDir = Join-Path $env:USERPROFILE ".openagent\app"
$BinDir     = Join-Path $env:USERPROFILE ".openagent\bin"
$BinShim    = Join-Path $BinDir "openagent.cmd"

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

Write-Host ""
Write-Step "Installing OpenAgent..."
Write-Host ""

if (-not (Test-Cmd "node")) {
  Write-Warn "Node.js not found."
  if (Test-Cmd "winget") {
    Write-Step "Installing Node.js LTS via winget..."
    winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements | Out-Null
    Update-EnvPath
  } elseif (Test-Cmd "choco") {
    Write-Step "Installing Node.js LTS via Chocolatey..."
    choco install nodejs-lts -y | Out-Null
    Update-EnvPath
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
  $npmOut = & npm install --loglevel=error 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Err "npm install failed:"
    $npmOut | Select-Object -Last 20 | ForEach-Object { Write-Host "    $_" }
    exit 1
  }
  $tsxOut = & npm install tsx --loglevel=error 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Err "Installing tsx failed:"
    $tsxOut | Select-Object -Last 10 | ForEach-Object { Write-Host "    $_" }
    exit 1
  }
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
