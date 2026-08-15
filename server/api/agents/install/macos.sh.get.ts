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

# Remote Login (SSH) — needed so this agent's SSH tunnel has something to
# dial on 127.0.0.1:22. Same "assume/enable, don't sandbox" treatment as the
# Linux installer, which never touches sshd either: whatever LAN exposure
# your normal SSH policy already implies applies here too.
#
# NOTE: systemsetup -setremotelogin is unreliable on modern macOS — it can
# exit 0 while silently doing nothing (ssh.plist ships with Disabled=1 baked
# in, and systemsetup doesn't always clear the launchd override). Drive
# launchctl directly instead, which is the actual mechanism, and verify
# against the real listening port rather than trusting any exit code.
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
