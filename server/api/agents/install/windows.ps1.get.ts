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

Write-Host "Installing service..."
sc.exe create netman-agent binPath= "\`"$exePath\`"" start= auto DisplayName= "netMan Agent" | Out-Null
sc.exe description netman-agent "netMan monitoring & remote-access agent" | Out-Null
sc.exe failure netman-agent reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null
Start-Service netman-agent

Write-Host "netMan agent installed and running."
`
})
