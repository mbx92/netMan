// GET /api/agents/install/windows.ps1 - Installer script the "Add Agent" install command downloads and runs.
export default defineEventHandler((event) => {
    setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    return `param(
    [Parameter(Mandatory=$true)][string]$Token,
    [Parameter(Mandatory=$true)][string]$Server
)

$ErrorActionPreference = "Stop"

$installDir = "$env:ProgramFiles\\netMan Agent"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

$exePath = Join-Path $installDir "netman-agent.exe"
Write-Host "Downloading netman-agent..."
Invoke-WebRequest -Uri "$Server/api/agents/download/windows" -OutFile $exePath

Write-Host "Enrolling..."
& $exePath -enroll -token $Token -server $Server
if ($LASTEXITCODE -ne 0) { throw "Enrollment failed" }

# --- VNC server (remote desktop over the agent tunnel) ---
# Windows has no built-in VNC server (unlike RDP), so remote desktop access
# through this agent requires one. Installed bound to loopback only with a
# generated password: it is never reachable except through this agent's own
# tunnel, never exposed on the LAN.
#
# NOTE: the TightVNC MSI properties and download URL below match TightVNC's
# documented 2.8.x installer options at the time this was written — TightVNC
# releases change over time, so verify the download URL and that the
# LoopbackOnly + password settings actually took effect (check
# HKLM:\\SOFTWARE\\TightVNC\\Server) before relying on this in production.
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

Write-Host "Installing netman-agent service..."
sc.exe create netman-agent binPath= "\`"$exePath\`"" start= auto DisplayName= "netMan Agent" | Out-Null
sc.exe description netman-agent "netMan monitoring & remote-access agent" | Out-Null
sc.exe failure netman-agent reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null
Start-Service netman-agent

Write-Host "netMan agent installed and running."
`
})
