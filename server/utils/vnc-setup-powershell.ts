/**
 * Shared PowerShell used by both windows.ps1 and update-windows.ps1 to put
 * TightVNC into the exact state the agent tunnel needs.
 *
 * Why this writes the password to the registry rather than relying on the
 * MSI's SET_PASSWORD/VALUE_OF_PASSWORD properties (which ARE the correct
 * property names - verified against TightVNC's official "Installing from MSI
 * Packages" documentation): those properties only apply on a fresh install.
 * They are silently ignored when the product is already installed, so an
 * agent whose TightVNC was configured by an earlier, buggy version of this
 * script could never be repaired by re-running it. Writing the registry
 * value directly is deterministic, needs no reinstall, and is the same thing
 * the MSI itself ultimately does.
 *
 * Password format: VNC stores an 8-byte DES-ECB ciphertext of the password
 * (truncated/zero-padded to 8 bytes) under a fixed, publicly known key. The
 * key bytes below are the bit-reversed form of VNC's canonical fixed key
 * (0x17 52 6B 06 23 4E 58 07), which is what .NET's standard DES expects.
 * Verified locally against Go's crypto/des: the reversal is exact and the
 * encrypt/decrypt round-trip matches.
 *
 * Every step is verified and reported, so a failure says which step failed
 * instead of silently "succeeding" with a password the server records but
 * TightVNC never received.
 */
export const VNC_CONFIGURE_PS = `
function Set-VncPassword {
    param([Parameter(Mandatory=$true)][string]$Password)
    $key = [byte[]](0xE8,0x4A,0xD6,0x60,0xC4,0x72,0x1A,0xE0)
    $buf = New-Object byte[] 8
    $pwBytes = [System.Text.Encoding]::ASCII.GetBytes($Password)
    $n = [Math]::Min(8, $pwBytes.Length)
    [Array]::Copy($pwBytes, $buf, $n)
    $des = [System.Security.Cryptography.DES]::Create()
    $des.Mode = [System.Security.Cryptography.CipherMode]::ECB
    $des.Padding = [System.Security.Cryptography.PaddingMode]::None
    $des.Key = $key
    $enc = $des.CreateEncryptor()
    $out = $enc.TransformFinalBlock($buf, 0, 8)
    $enc.Dispose()
    $des.Dispose()
    return $out
}

function Get-VncPasswordPlain {
    param([Parameter(Mandatory=$true)][byte[]]$Blob)
    $key = [byte[]](0xE8,0x4A,0xD6,0x60,0xC4,0x72,0x1A,0xE0)
    $des = [System.Security.Cryptography.DES]::Create()
    $des.Mode = [System.Security.Cryptography.CipherMode]::ECB
    $des.Padding = [System.Security.Cryptography.PaddingMode]::None
    $des.Key = $key
    $dec = $des.CreateDecryptor()
    $out = $dec.TransformFinalBlock($Blob, 0, 8)
    $dec.Dispose()
    $des.Dispose()
    return ([System.Text.Encoding]::ASCII.GetString($out)).TrimEnd([char]0)
}

$vncReg = "HKLM:\\SOFTWARE\\TightVNC\\Server"
New-Item -Path $vncReg -Force | Out-Null

# LoopbackOnly and AllowLoopback are independent: LoopbackOnly restricts the
# server to loopback, AllowLoopback is what actually permits loopback at all.
# Without both, the tunnel gets "Sorry, loopback connections are not enabled".
Set-ItemProperty -Path $vncReg -Name "LoopbackOnly" -Value 1 -Type DWord
Set-ItemProperty -Path $vncReg -Name "AllowLoopback" -Value 1 -Type DWord
Set-ItemProperty -Path $vncReg -Name "UseVncAuthentication" -Value 1 -Type DWord
Set-ItemProperty -Path $vncReg -Name "Password" -Value (Set-VncPassword -Password $vncPassword) -Type Binary

Write-Host "Restarting TightVNC service..."
Restart-Service -Name "tvnserver" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Verify what actually landed, rather than assuming the writes took effect.
$vncOk = $true
try {
    $props = Get-ItemProperty -Path $vncReg -ErrorAction Stop
    $stored = Get-VncPasswordPlain -Blob $props.Password
    if ($stored -ne $vncPassword) {
        Write-Host "ERROR: VNC password in registry does not match what was generated."
        $vncOk = $false
    }
    if ($props.AllowLoopback -ne 1 -or $props.LoopbackOnly -ne 1) {
        Write-Host "ERROR: VNC loopback settings did not apply."
        $vncOk = $false
    }
    $svc = Get-Service -Name "tvnserver" -ErrorAction SilentlyContinue
    if ($null -eq $svc) {
        Write-Host "ERROR: tvnserver service is not installed."
        $vncOk = $false
    } elseif ($svc.Status -ne "Running") {
        Write-Host "ERROR: tvnserver service is not running (status: $($svc.Status))."
        $vncOk = $false
    }
} catch {
    Write-Host "ERROR: could not verify VNC configuration: $($_.Exception.Message)"
    $vncOk = $false
}

if ($vncOk) {
    Write-Host "VNC configured and verified (loopback-only, password set, service running)."
} else {
    Write-Host "WARNING: VNC configuration could not be fully verified - remote desktop may not work."
}
`
