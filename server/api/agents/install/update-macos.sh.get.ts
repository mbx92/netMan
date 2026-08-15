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

if [[ "$(systemsetup -getremotelogin 2>/dev/null)" != "Remote Login: On" ]]; then
  echo "Enabling Remote Login (SSH)..."
  systemsetup -setremotelogin on >/dev/null 2>&1 || echo "Warning: could not enable Remote Login automatically — enable it manually in System Settings > General > Sharing." >&2
else
  echo "Remote Login (SSH) is already on."
fi

echo "Restarting netman-agent service..."
launchctl kickstart -k "system/com.netman.agent"

VERSION=$("$BIN_PATH" -version)
echo "netMan agent updated to v$VERSION and running."
`
})
