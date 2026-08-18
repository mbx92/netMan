// GET /api/agents/install/windows.ps1 - Installer script the "Add Agent" install command downloads and runs.
import { VNC_CONFIGURE_PS } from '../../../utils/vnc-setup-powershell'
import { WINDOWS_SERVICE_PS } from '../../../utils/windows-service-powershell'

export default defineEventHandler((event) => {
    setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    // Keep this script pure ASCII: Invoke-WebRequest -OutFile writes the raw
    // bytes we send (UTF-8, no BOM) and Windows PowerShell often reads a
    // downloaded .ps1 back using the legacy ANSI codepage, which mangles any
    // multi-byte character - previously causing "the string is missing the
    // terminator" from a single em-dash in a comment.
    return `param(
    [Parameter(Mandatory=$true)][string]$Token,
    [Parameter(Mandatory=$true)][string]$Server
)

$ErrorActionPreference = "Stop"
${WINDOWS_SERVICE_PS}

$installDir = "$env:ProgramFiles\\netMan Agent"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

$exePath = Join-Path $installDir "netman-agent.exe"
Write-Host "Downloading netman-agent..."
Invoke-WebRequest -Uri "$Server/api/agents/download/windows" -OutFile $exePath
Unblock-NetManFile $exePath

# --- VNC server (remote desktop over the agent tunnel) ---
# Windows has no built-in VNC server (unlike RDP), so remote desktop access
# through this agent requires one. Bound to loopback only with a generated
# password: never reachable except through this agent's own tunnel, never
# exposed on the LAN. The password is written locally for the agent binary to
# report back to the server, so it shows up in the netMan UI instead of only
# existing in this console's scrollback. This runs BEFORE enrolling so that
# file exists by the time the agent first talks to the server.
$vncPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 8 | ForEach-Object { [char]$_ })

if (-not (Get-Service -Name "tvnserver" -ErrorAction SilentlyContinue)) {
    $vncMsi = Join-Path $env:TEMP "tightvnc-setup.msi"
    Write-Host "Downloading TightVNC server..."
    Invoke-WebRequest -Uri "https://www.tightvnc.com/download/2.8.85/tightvnc-2.8.85-gpl-setup-64bit.msi" -OutFile $vncMsi
    Unblock-NetManFile $vncMsi

    Write-Host "Installing TightVNC server..."
    $msi = Start-Process msiexec.exe -ArgumentList @(
        "/i", "\`"$vncMsi\`"",
        "/quiet", "/norestart",
        "ADDLOCAL=Server",
        "SERVER_REGISTER_AS_SERVICE=1",
        "SERVER_START_SERVICE=1",
        "SERVER_ADD_FIREWALL_EXCEPTION=0"
    ) -Wait -PassThru
    # Never assume msiexec succeeded: a silent failure here used to leave
    # TightVNC half-configured while the script still reported success.
    if ($msi.ExitCode -ne 0 -and $msi.ExitCode -ne 3010) {
        throw "TightVNC install failed with msiexec exit code $($msi.ExitCode)"
    }
} else {
    Write-Host "TightVNC server already installed."
}

${VNC_CONFIGURE_PS}

Grant-NetManDataAcl "$env:ProgramData\\netMan-agent"
Set-Content -Path "$env:ProgramData\\netMan-agent\\vnc-password.txt" -Value $vncPassword -NoNewline

Write-Host "Enrolling..."
& $exePath -enroll -token $Token -server $Server
if ($LASTEXITCODE -ne 0) { throw "Enrollment failed" }
Grant-NetManDataAcl "$env:ProgramData\\netMan-agent"

Write-Host "Installing netman-agent service..."
Install-NetManService $exePath

Write-Host "Installing tray helper for update notifications..."
Install-NetManTray $exePath

Write-Host "netMan agent installed and running. VNC password is visible on the agent's page in netMan."
`
})
