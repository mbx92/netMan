// GET /api/agents/install/linux.sh - Installer script the "Add Agent" install command curls and pipes to bash.
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
curl -fsSL "$SERVER/api/agents/download/linux" -o "$BIN_PATH"
chmod 755 "$BIN_PATH"

echo "Enrolling..."
"$BIN_PATH" -enroll -token "$TOKEN" -server "$SERVER"

mkdir -p /etc/netman-agent
chmod 700 /etc/netman-agent

cat > /etc/systemd/system/netman-agent.service <<UNIT
[Unit]
Description=netMan monitoring & remote-access agent
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=$BIN_PATH
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now netman-agent

echo "netMan agent installed and running."
`
})
