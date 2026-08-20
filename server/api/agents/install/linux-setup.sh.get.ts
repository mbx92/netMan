// GET /api/agents/install/linux-setup.sh — downloadable interactive installer.
import { publicAppUrl } from '../../../utils/agent-install'
import { requireSession } from '../../../utils/require-session'

export default defineEventHandler(async (event) => {
    await requireSession(event)
    const server = publicAppUrl()
    setResponseHeader(event, 'Content-Type', 'text/x-shellscript; charset=utf-8')
    setResponseHeader(event, 'Content-Disposition', 'attachment; filename="netman-agent-setup.sh"')
    return `#!/usr/bin/env bash
set -euo pipefail
SERVER="${server}"

if [[ \${EUID} -ne 0 ]]; then
  exec sudo -E bash "$0" "$@"
fi

echo "NetMan Agent Setup"
echo "Server: $SERVER"
echo
read -r -p "Enrollment token (from NetMan → Add Agent): " TOKEN
if [[ -z "\${TOKEN}" ]]; then
  echo "Token is required." >&2
  exit 1
fi

curl -fsSL "$SERVER/api/agents/install/linux.sh" | bash -s -- --token "$TOKEN" --server "$SERVER"
`
})
