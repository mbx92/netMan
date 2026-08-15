// GET /api/agents/install/update-windows.ps1 - Re-downloads the binary, re-verifies the
// TightVNC server is installed, and restarts the service. No token needed — the existing
// enrollment credentials in ProgramData are untouched. Re-checking VNC here (not just at
// initial install) matters for agents enrolled before that step existed.
export default defineEventHandler((event) => {
    setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    return `param(
    [Parameter(Mandatory=$true)][string]$Server
)

$ErrorActionPreference = "Stop"
$exePath = "$env:ProgramFiles\\netMan Agent\\netman-agent.exe"

Write-Host "Stopping netman-agent service..."
Stop-Service -Name netman-agent -ErrorAction SilentlyContinue

Write-Host "Downloading latest netman-agent..."
Invoke-WebRequest -Uri "$Server/api/agents/download/windows" -OutFile "$exePath.new"
Move-Item -Force "$exePath.new" $exePath

if (-not (Get-Service -Name "tvnserver" -ErrorAction SilentlyContinue)) {
    $vncPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 8 | ForEach-Object { [char]$_ })
    $vncMsi = Join-Path $env:TEMP "tightvnc-setup.msi"

    Write-Host "Downloading TightVNC server..."
    Invoke-WebRequest -Uri "https://www.tightvnc.com/download/2.8.85/tightvnc-2.8.85-gpl-setup-64bit.msi" -OutFile $vncMsi

    Write-Host "Installing TightVNC server (loopback-only, generated password)..."
    Start-Process msiexec.exe -ArgumentList @(
        "/i", "\`"$vncMsi\`"",
        "/quiet", "/norestart",
        "ADDLOCAL=Server",
        "SERVER_REGISTER_AS_SERVICE=1",
        "SERVER_START_SERVICE=1",
        "SERVER_ADD_FIREWALL_EXCEPTION=0",
        "SET_USEVNCAUTHENTICATION=1",
        "VALUE_OF_VNCPASSWORD1=$vncPassword"
    ) -Wait

    Write-Host ""
    Write-Host "==============================================================="
    Write-Host " VNC password (save this now, it is not stored anywhere else):"
    Write-Host " $vncPassword"
    Write-Host "==============================================================="
    Write-Host ""
} else {
    Write-Host "A VNC server (tvnserver) is already installed."
}

# Always re-verify these registry keys, even against an already-installed
# TightVNC (e.g. one that predates the AllowLoopback fix) — LoopbackOnly
# alone does NOT permit loopback connections; without AllowLoopback too, the
# server rejects 127.0.0.1 with "loopback connections are not enabled" (the
# two keys are independent, and only setting one was the original bug).
New-Item -Path "HKLM:\\SOFTWARE\\TightVNC\\Server" -Force | Out-Null
Set-ItemProperty -Path "HKLM:\\SOFTWARE\\TightVNC\\Server" -Name "LoopbackOnly" -Value 1 -Type DWord
Set-ItemProperty -Path "HKLM:\\SOFTWARE\\TightVNC\\Server" -Name "AllowLoopback" -Value 1 -Type DWord
Restart-Service -Name "tvnserver" -ErrorAction SilentlyContinue

Write-Host "Starting netman-agent service..."
Start-Service netman-agent

$version = & $exePath -version
Write-Host "netMan agent updated to v$version and running."
`
})
