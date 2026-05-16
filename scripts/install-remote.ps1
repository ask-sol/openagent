#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Repo = "https://github.com/ask-sol/openagent.git"

function Write-Step($msg) { Write-Host "  $msg" -ForegroundColor Cyan }
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

if (-not (Test-Cmd "git")) {
  Write-Warn "Git not found."
  if (Test-Cmd "winget") {
    Write-Step "Installing Git via winget..."
    winget install -e --id Git.Git --silent --accept-source-agreements --accept-package-agreements | Out-Null
    Update-EnvPath
  } elseif (Test-Cmd "choco") {
    Write-Step "Installing Git via Chocolatey..."
    choco install git -y | Out-Null
    Update-EnvPath
  } else {
    Write-Err "Install Git first: https://git-scm.com/download/win"
    exit 1
  }
}

if (-not (Test-Cmd "git")) {
  Write-Err "Git installed but not on PATH. Open a new terminal and rerun."
  exit 1
}

$TmpDir = Join-Path $env:TEMP ("openagent-install-" + [System.Guid]::NewGuid().ToString("N").Substring(0, 8))
$RepoDir = Join-Path $TmpDir "openagent"
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null

try {
  Write-Step "Cloning repository..."
  & git clone --depth 1 $Repo $RepoDir 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Err "git clone failed."
    exit 1
  }

  $UserScript = Join-Path $RepoDir "scripts\install-user.ps1"
  if (-not (Test-Path $UserScript)) {
    Write-Err "install-user.ps1 not found in cloned repo: $UserScript"
    exit 1
  }

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $UserScript
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $TmpDir
}
