#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Repo        = "https://github.com/ask-sol/openagent.git"
$InstallRoot = Join-Path $env:USERPROFILE ".openagent"
$InstallDir  = Join-Path $InstallRoot "app"

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
  param([Parameter(Mandatory)][scriptblock]$Script, [switch]$Quiet)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    if ($Quiet) { & $Script 2>&1 | Out-Null } else { & $Script }
  } finally {
    $ErrorActionPreference = $prev
  }
  return $LASTEXITCODE
}

Write-Host ""
Write-Step "Installing OpenAgent..."
Write-Host ""

if (-not (Test-Cmd "git")) {
  Write-Warn "Git not found."
  if (Test-Cmd "winget") {
    Write-Step "Installing Git via winget..."
    $code = Invoke-Native -Quiet { winget install -e --id Git.Git --silent --accept-source-agreements --accept-package-agreements }
    Update-EnvPath
    if ($code -ne 0) { Write-Err "winget install failed (exit $code)"; exit 1 }
  } elseif (Test-Cmd "choco") {
    Write-Step "Installing Git via Chocolatey..."
    $code = Invoke-Native -Quiet { choco install git -y }
    Update-EnvPath
    if ($code -ne 0) { Write-Err "choco install failed (exit $code)"; exit 1 }
  } else {
    Write-Err "Install Git first: https://git-scm.com/download/win"
    exit 1
  }
}

if (-not (Test-Cmd "git")) {
  Write-Err "Git installed but not on PATH. Open a new terminal and rerun."
  exit 1
}

$TmpDir  = Join-Path $env:TEMP ("openagent-install-" + [System.Guid]::NewGuid().ToString("N").Substring(0, 8))
$RepoDir = Join-Path $TmpDir "openagent"
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null

try {
  Write-Step "Cloning repository..."
  $code = Invoke-Native -Quiet { git clone --depth 1 --quiet $Repo $RepoDir }
  if ($code -ne 0) {
    Write-Err "git clone failed (exit $code)."
    Write-Host "  Check your network connection and that $Repo is reachable."
    exit 1
  }

  $UserScript = Join-Path $RepoDir "scripts\install-user.ps1"
  if (-not (Test-Path $UserScript)) {
    Write-Err "install-user.ps1 not found at $UserScript"
    exit 1
  }

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $UserScript
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $TmpDir
}
