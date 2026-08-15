// GET /api/agents/install/update-linux.sh - Re-downloads the binary and restarts the
// service. No token needed — the existing enrollment credentials in /etc/netman-agent are untouched.
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
curl -fsSL "$SERVER/api/agents/download/linux" -o "$BIN_PATH.new"
chmod 755 "$BIN_PATH.new"
mv "$BIN_PATH.new" "$BIN_PATH"

echo "Restarting netman-agent service..."
systemctl restart netman-agent

VERSION=$("$BIN_PATH" -version)
echo "netMan agent updated to v$VERSION and running."
`
})
