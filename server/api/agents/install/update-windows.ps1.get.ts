// GET /api/agents/install/update-windows.ps1 - Re-downloads the binary, re-verifies/
// reconfigures the TightVNC server (including resetting its password - see below), and
// restarts the service. No token needed - the existing enrollment credentials in
// ProgramData are untouched. Re-checking VNC here (not just at initial install) matters
// for agents enrolled before that step existed, or whose TightVNC config was broken by
// the missing SET_PASSWORD/AllowLoopback properties bug this fixed.
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

# Always regenerate + reconfigure - this deliberately resets the VNC password
# on every run, which is fine: the new one gets written locally and reported
# to the server on the very next reconnect below, so the netMan UI always
# shows the password that's actually current. An MSI reinstall (not just a
# registry poke) is the only reliable way to change an already-installed
# TightVNC's password - uninstall first if it's already there.
$vncPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 8 | ForEach-Object { [char]$_ })
$vncMsi = Join-Path $env:TEMP "tightvnc-setup.msi"

Write-Host "Downloading TightVNC server..."
Invoke-WebRequest -Uri "https://www.tightvnc.com/download/2.8.85/tightvnc-2.8.85-gpl-setup-64bit.msi" -OutFile $vncMsi

if (Get-Service -Name "tvnserver" -ErrorAction SilentlyContinue) {
    Write-Host "Removing existing TightVNC server (reinstalling to apply the new password)..."
    Start-Process msiexec.exe -ArgumentList @("/x", "\`"$vncMsi\`"", "/quiet", "/norestart") -Wait
}

Write-Host "Installing TightVNC server (loopback-only, generated password)..."
Start-Process msiexec.exe -ArgumentList @(
    "/i", "\`"$vncMsi\`"",
    "/quiet", "/norestart",
    "ADDLOCAL=Server",
    "SERVER_REGISTER_AS_SERVICE=1",
    "SERVER_START_SERVICE=1",
    "SERVER_ADD_FIREWALL_EXCEPTION=0",
    "SET_USEVNCAUTHENTICATION=1",
    "VALUE_OF_USEVNCAUTHENTICATION=1",
    "SET_PASSWORD=1",
    "VALUE_OF_PASSWORD=$vncPassword"
) -Wait

New-Item -Path "HKLM:\\SOFTWARE\\TightVNC\\Server" -Force | Out-Null
Set-ItemProperty -Path "HKLM:\\SOFTWARE\\TightVNC\\Server" -Name "LoopbackOnly" -Value 1 -Type DWord
Set-ItemProperty -Path "HKLM:\\SOFTWARE\\TightVNC\\Server" -Name "AllowLoopback" -Value 1 -Type DWord
Restart-Service -Name "tvnserver" -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Force -Path "$env:ProgramData\\netMan-agent" | Out-Null
Set-Content -Path "$env:ProgramData\\netMan-agent\\vnc-password.txt" -Value $vncPassword -NoNewline

Write-Host "Starting netman-agent service..."
Start-Service netman-agent

$version = & $exePath -version
Write-Host "netMan agent updated to v$version and running. New VNC password saved - view it in the agent's page in netMan."
`
})
