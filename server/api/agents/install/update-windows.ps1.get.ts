// GET /api/agents/install/update-windows.ps1 - Re-downloads the binary, re-applies the full
// TightVNC configuration (loopback + password, written straight to the registry so it also
// repairs an already-installed TightVNC), and restarts the service. No token needed - the
// existing enrollment credentials in ProgramData are untouched.
import { VNC_CONFIGURE_PS } from '../../../utils/vnc-setup-powershell'
import { WINDOWS_SERVICE_PS } from '../../../utils/windows-service-powershell'

export default defineEventHandler((event) => {
    setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    // Keep this script pure ASCII - see the note in windows.ps1.get.ts.
    return `param(
    [Parameter(Mandatory=$true)][string]$Server
)

$ErrorActionPreference = "Stop"
${WINDOWS_SERVICE_PS}
$exePath = "$env:ProgramFiles\\netMan Agent\\netman-agent.exe"

Write-Host "Stopping netman-agent service..."
Stop-Service -Name netman-agent -ErrorAction SilentlyContinue

Write-Host "Downloading latest netman-agent..."
Invoke-WebRequest -Uri "$Server/api/agents/download/windows" -OutFile "$exePath.new"
Unblock-NetManFile "$exePath.new"
Move-Item -Force "$exePath.new" $exePath
Unblock-NetManFile $exePath

# Regenerate and re-apply the VNC password on every update. The new value is
# written to the registry directly (see vnc-setup-powershell.ts) rather than
# via MSI properties, which only take effect on a fresh install - that is what
# made previously-broken agents impossible to repair by re-running this.
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
    if ($msi.ExitCode -ne 0 -and $msi.ExitCode -ne 3010) {
        throw "TightVNC install failed with msiexec exit code $($msi.ExitCode)"
    }
} else {
    Write-Host "TightVNC server already installed, reconfiguring it in place."
}

${VNC_CONFIGURE_PS}

Grant-NetManDataAcl "$env:ProgramData\\netMan-agent"
Set-Content -Path "$env:ProgramData\\netMan-agent\\vnc-password.txt" -Value $vncPassword -NoNewline

Write-Host "Starting netman-agent service..."
if (Get-Service -Name netman-agent -ErrorAction SilentlyContinue) {
    Repair-NetManService $exePath
} else {
    Install-NetManService $exePath
}

Install-NetManTray $exePath

$version = & $exePath -version
Write-Host "netMan agent updated to v$version and running. New VNC password is visible on the agent's page in netMan."
`
})
