#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$InstallDir = Join-Path $env:USERPROFILE ".openagent\app"
$BinDir     = Join-Path $env:USERPROFILE ".openagent\bin"
$BinShim    = Join-Path $BinDir "openagent.cmd"

Write-Host ""
Write-Host "  Installing OpenAgent..." -ForegroundColor Cyan
Write-Host ""

function Test-Command($name) {
  $null = Get-Command $name -ErrorAction SilentlyContinue
  $?
}

if (-not (Test-Command "node")) {
  Write-Host "  Node.js not found." -ForegroundColor Yellow
  if (Test-Command "winget") {
    Write-Host "  Installing Node.js LTS via winget..."
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements | Out-Null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  } elseif (Test-Command "choco") {
    Write-Host "  Installing Node.js via Chocolatey..."
    choco install nodejs-lts -y | Out-Null
  } else {
    Write-Host "  Please install Node.js 20+ manually: https://nodejs.org" -ForegroundColor Red
    exit 1
  }
}

$nodeVer = (& node -v).TrimStart("v").Split(".")[0]
if ([int]$nodeVer -lt 18) {
  Write-Host "  Node.js 18+ required. You have v$nodeVer." -ForegroundColor Red
  exit 1
}

if (Test-Path $InstallDir) {
  Write-Host "  Removing previous installation..."
  Remove-Item -Recurse -Force $InstallDir
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $BinDir     | Out-Null

$ScriptDir = Resolve-Path (Join-Path $PSScriptRoot "..")

Copy-Item (Join-Path $ScriptDir "package.json") $InstallDir
Copy-Item (Join-Path $ScriptDir "tsconfig.json") $InstallDir
Copy-Item -Recurse (Join-Path $ScriptDir "src") (Join-Path $InstallDir "src")
Copy-Item -Recurse (Join-Path $ScriptDir "bin") (Join-Path $InstallDir "bin")

Push-Location $InstallDir
try {
  Write-Host "  Installing dependencies..."
  & npm install --loglevel=error 2>&1 | Select-Object -Last 5
  & npm install tsx --loglevel=error 2>&1 | Select-Object -Last 1
} finally {
  Pop-Location
}

$tsxBin = Join-Path $InstallDir "node_modules\.bin\tsx.cmd"
$entry  = Join-Path $InstallDir "src\entrypoints\cli.tsx"

@"
@echo off
"$tsxBin" "$entry" %*
"@ | Set-Content -Encoding ASCII $BinShim

$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
if (-not $userPath) { $userPath = "" }
if ($userPath -notlike "*$BinDir*") {
  $newPath = if ($userPath) { "$userPath;$BinDir" } else { $BinDir }
  [System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")
  Write-Host "  Added $BinDir to user PATH" -ForegroundColor Green
  $env:Path = "$env:Path;$BinDir"
}

Write-Host ""
Write-Host "  OpenAgent installed!" -ForegroundColor Green
Write-Host ""
Write-Host "  Run: openagent"
Write-Host ""
Write-Host "  If 'openagent' isn't found, open a new PowerShell window so the updated PATH takes effect."
Write-Host ""
