// GET /api/agents/install/update-windows.ps1 - Re-downloads the binary and restarts the
// service. No token needed — the existing enrollment credentials in ProgramData are untouched.
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

Write-Host "Starting netman-agent service..."
Start-Service netman-agent

$version = & $exePath -version
Write-Host "netMan agent updated to v$version and running."
`
})
