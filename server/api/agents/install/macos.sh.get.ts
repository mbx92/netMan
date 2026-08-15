// GET /api/agents/install/macos.sh - Installer script the "Add Agent" install command curls and pipes to bash.
export default defineEventHandler((event) => {
    setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    return `#!/usr/bin/env bash
set -euo pipefail

TOKEN=""
SERVER=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    --server) SERVER="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$TOKEN" || -z "$SERVER" ]]; then
  echo "Usage: install-agent.sh --token <token> --server <url>" >&2
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "This installer must be run as root (sudo)." >&2
  exit 1
fi

BIN_PATH="/usr/local/bin/netman-agent"
echo "Downloading netman-agent..."
curl -fsSL "$SERVER/api/agents/download/macos" -o "$BIN_PATH"
chmod 755 "$BIN_PATH"

echo "Enrolling..."
"$BIN_PATH" -enroll -token "$TOKEN" -server "$SERVER"

mkdir -p /etc/netman-agent
chmod 700 /etc/netman-agent

PLIST_PATH="/Library/LaunchDaemons/com.netman.agent.plist"
cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.netman.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$BIN_PATH</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/netman-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/netman-agent.log</string>
</dict>
</plist>
PLIST
chmod 644 "$PLIST_PATH"

launchctl bootout system "$PLIST_PATH" 2>/dev/null || true
launchctl bootstrap system "$PLIST_PATH"

echo "netMan agent installed and running."
`
})
