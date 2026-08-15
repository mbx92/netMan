// GET /api/agents/install/update-macos.sh - Re-downloads the binary, re-verifies Remote
// Login (SSH) is on, and restarts the LaunchDaemon. No token needed — the existing
// enrollment credentials in /etc/netman-agent are untouched. Re-checking Remote Login
// here (not just at initial install) matters for agents enrolled before that step
// existed, or where it was toggled off after install — the check is idempotent either way.
export default defineEventHandler((event) => {
    setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    return `#!/usr/bin/env bash
set -euo pipefail

SERVER=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --server) SERVER="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$SERVER" ]]; then
  echo "Usage: update-agent.sh --server <url>" >&2
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "This updater must be run as root (sudo)." >&2
  exit 1
fi

BIN_PATH="/usr/local/bin/netman-agent"
echo "Downloading latest netman-agent..."
curl -fsSL "$SERVER/api/agents/download/macos" -o "$BIN_PATH.new"
chmod 755 "$BIN_PATH.new"
mv "$BIN_PATH.new" "$BIN_PATH"

# systemsetup -setremotelogin is unreliable on modern macOS — it can exit 0
# while silently doing nothing (ssh.plist ships with Disabled=1 baked in).
# Drive launchctl directly, and verify against the real listening port.
echo "Enabling Remote Login (SSH)..."
systemsetup -setremotelogin on >/dev/null 2>&1 || true
launchctl enable system/com.openssh.sshd 2>/dev/null || true
launchctl bootstrap system /System/Library/LaunchDaemons/ssh.plist 2>/dev/null || true
sleep 1
if nc -z 127.0.0.1 22 2>/dev/null; then
  echo "Remote Login (SSH) is on."
else
  echo "Warning: Remote Login still isn't listening on :22 — enable it manually in System Settings > General > Sharing > Remote Login." >&2
fi

echo "Restarting netman-agent service..."
launchctl kickstart -k "system/com.netman.agent"

VERSION=$("$BIN_PATH" -version)
echo "netMan agent updated to v$VERSION and running."
`
})
