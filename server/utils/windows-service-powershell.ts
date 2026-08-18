/**
 * Shared PowerShell for Windows agent install/update.
 *
 * Windows 11 Smart App Control / SmartScreen treat a downloaded .exe as
 * "from the internet" (Mark of the Web). Start-Service from the same admin
 * session often still works; after reboot services.exe launches it and Win11
 * blocks the unsigned binary. Unblock-File + stripping Zone.Identifier
 * clears that.
 *
 * Delayed-auto start waits until after the network stack is up (Win11 Fast
 * Startup otherwise races the WebSocket hello and the SCM marks the service
 * failed).
 *
 * Keep this ASCII-only: the installer is served as UTF-8 without BOM and
 * Windows PowerShell 5.1 may decode it as ANSI.
 */
export const WINDOWS_SERVICE_PS = `
function Unblock-NetManFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return }
    Unblock-File -LiteralPath $Path -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath ($Path + ":Zone.Identifier") -ErrorAction SilentlyContinue
}

function Grant-NetManDataAcl([string]$Dir) {
    New-Item -ItemType Directory -Force -Path $Dir | Out-Null
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    icacls $Dir /grant "*S-1-5-18:(OI)(CI)F" /grant "*S-1-5-32-544:(OI)(CI)F" /T | Out-Null
    $ErrorActionPreference = $prev
}

function Install-NetManService([string]$ExePath) {
    Unblock-NetManFile $ExePath
    $name = "netman-agent"
    if (Get-Service -Name $name -ErrorAction SilentlyContinue) {
        Stop-Service -Name $name -Force -ErrorAction SilentlyContinue
        sc.exe delete $name | Out-Null
        $deadline = (Get-Date).AddSeconds(15)
        while (Get-Service -Name $name -ErrorAction SilentlyContinue) {
            if ((Get-Date) -gt $deadline) { break }
            Start-Sleep -Milliseconds 400
        }
    }
    New-Service -Name $name -BinaryPathName ('"{0}"' -f $ExePath) -DisplayName "netMan Agent" -StartupType Automatic | Out-Null
    sc.exe description $name "netMan monitoring and remote-access agent" | Out-Null
    sc.exe config $name start= delayed-auto | Out-Null
    sc.exe failure $name reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null
    sc.exe failureflag $name 1 | Out-Null
    Start-Service $name
    $svc = Get-Service -Name $name
    if ($svc.Status -ne "Running") {
        throw "netman-agent service failed to start (status: $($svc.Status))"
    }
}

function Repair-NetManService([string]$ExePath) {
    Unblock-NetManFile $ExePath
    $name = "netman-agent"
    sc.exe config $name start= delayed-auto | Out-Null
    sc.exe failure $name reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null
    sc.exe failureflag $name 1 | Out-Null
    Start-Service $name
    $svc = Get-Service -Name $name
    if ($svc.Status -ne "Running") {
        throw "netman-agent service failed to start (status: $($svc.Status))"
    }
}
`

/** In-memory PowerShell invoke: no .ps1 on disk, so no ExecutionPolicy / MOTW prompt. */
export function windowsScriptCommand(appUrl: string, script: string, args: string) {
    const origin = appUrl.replace(/\/$/, '')
    return `& ([scriptblock]::Create((irm -useb '${origin}/api/agents/install/${script}'))) ${args}`
}
