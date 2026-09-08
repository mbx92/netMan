# Zimbra and Fail2Ban monitoring

The Linux agent collects read-only snapshots in `internal/telemetry`, using the
existing Collector and heartbeat WebSocket. Each enabled module has a background
worker: it samples immediately, then waits its configured interval after each
completed sample. Workers never overlap themselves or block heartbeat commands.
The latest completed snapshot is repeated on heartbeats; `checkedAt` identifies
the sample time (UTC). Before the first sample completes the field is omitted.
The server stores both fields in the existing `Agent.lastMetrics` JSON, exposed
by the agent API. No database migration is needed. Daily aggregates, historical
queue charts and attacker rankings are not computed or persisted by the agent.
The server's existing resource-history table does not store these new snapshots.

## Monitoring pages

Open **Zimbra** or **Fail2Ban** immediately below Proxmox in the sidebar.
The `/zimbra` and `/fail2ban` pages display hosts that have reported the respective
snapshot, with host search, connection filters, and automatic refresh every 30s.
Zimbra shows services, queue counts, version and filesystem storage. Fail2Ban
shows jail counters and expandable banned IP lists. Unreadable counters display
as unavailable, and partial totals are labelled. Disconnected agents and snapshots
older than five minutes are flagged; the timestamp remains visible for deployments
using longer monitoring intervals. Refresh retrieves the latest stored snapshot;
it does not trigger commands on the agent.

## Configuration

Merge the following into `/etc/netman-agent/config.json`, preserving `serverUrl`,
`agentId` and `authKey`. This is the agent's local configuration, not the Nuxt
server `.env`. Both modules default to disabled. Restart the agent after editing
its configuration using your normal deployment procedure.

```json
{
  "monitoring": {
    "zimbra": { "enabled": true, "interval": "60s", "timeout": "10s", "sudo": true },
    "fail2ban": { "enabled": true, "interval": "60s", "timeout": "10s", "sudo": true }
  }
}
```

Each module can be disabled independently with `enabled: false`. Durations use
Go syntax. Missing/invalid durations or values outside 1s–24h fall back to 60s
for interval and 10s for timeout. Non-Linux systems log unsupported platform and
omit these modules. Heartbeat frequency still uses `NETMAN_HEARTBEAT_INTERVAL_SEC`.

## Commands and privilege

### Zimbra SSL certificate and mail port checks

Updated agents automatically include `zimbra.ssl` when Zimbra monitoring is enabled.
The default certificate is `/opt/zimbra/ssl/zimbra/commercial/commercial.crt`.
Override it with `monitoring.zimbra.certificatePath` for self-signed certificates
or a different deployed certificate location. The agent reads the first PEM
certificate directly as its service account; it does not read private keys or
use sudo for this check. Ensure the configured file contains the leaf certificate first.

```json
{
  "monitoring": {
    "zimbra": {
      "enabled": true,
      "interval": "60s",
      "timeout": "10s",
      "sudo": false,
      "certificatePath": "/opt/zimbra/ssl/zimbra/commercial/commercial.crt"
    },
    "fail2ban": { "enabled": true, "interval": "60s", "timeout": "10s", "sudo": false }
  }
}
```

Merge this into the existing config, preserving the top-level `serverUrl`,
`agentId`, and `authKey`. Install the updated Linux binary and restart the agent.
SSL reports subject, issuer, DNS names, validity dates, and remaining full days.
Statuses are `valid`, `expiring` (30 days or less), `expired`, `not_yet_valid`,
and `unknown` on read/parse errors. This checks local validity dates, not trust,
hostname matching, or the certificate actually served by SMTP/IMAP/HTTPS.

On the Zimbra page, **Check ports** connects from the netMan backend to the
registered hostname or last reported IP. It checks TCP ports 25, 465, 587, 143,
993, 110, 995, 443, and 7071 with a three-second deadline per connection.
The authenticated endpoint `POST /api/agents/:id/mail-ports` accepts
`{"target":"hostname"}` or `{"target":"ip"}` only; destinations and ports
cannot be supplied arbitrarily. Checks are limited to one per agent per 10 seconds
per backend process. Results show open/closed/timeout/error and elapsed milliseconds.
TCP success does not verify TLS, authentication, or mail delivery. DNS and routing
use the netMan server/container network; disabled services or firewall-restricted
ports can legitimately fail. Results are on demand and not persisted.

No ban, unban, reload, restart, queue flush or configuration mutation is exposed.
Every external command has a timeout and 1 MiB output limit. Linux timeouts kill
the command process group. Fail2Ban also has a whole-sweep deadline equal to the
module interval, so a large number of failing jails cannot hold a worker forever.
Errors contain sanitized codes, never raw stderr or command output in logs.

With `zimbra.sudo: false`, service/version queries execute `su - zimbra -c`
with the fixed commands `/opt/zimbra/bin/zmcontrol status` and
`/opt/zimbra/bin/zmcontrol -v`. This generally requires root or an existing
noninteractive PAM policy. The queue query directly executes
`/opt/zimbra/libexec/zmqstat`; its spool access often requires root.

For a restricted agent account, `sudo: true` instead uses noninteractive
`sudo -n -i -u zimbra -- /opt/zimbra/bin/zmcontrol status` (or `-v`), and
`sudo -n -- /opt/zimbra/libexec/zmqstat`. It never asks for a password.
With `fail2ban.sudo: false`, the command is `fail2ban-client status [jail]`
resolved through PATH. Socket access usually requires additional privilege.
With sudo enabled, the executable is fixed to `/usr/bin/fail2ban-client`.

An administrator can review these minimal sudoers entries (example agent
account `netman`). Enumerate the actual jail names; do not grant arbitrary
`fail2ban-client` arguments or a shell. No sudoers file is changed by the agent.

```sudoers
netman ALL=(zimbra) NOPASSWD: /opt/zimbra/bin/zmcontrol status, /opt/zimbra/bin/zmcontrol -v
netman ALL=(root) NOPASSWD: /opt/zimbra/libexec/zmqstat ""
netman ALL=(root) NOPASSWD: /usr/bin/fail2ban-client status, /usr/bin/fail2ban-client status sshd, /usr/bin/fail2ban-client status zimbra-auth
```

Check that the installed binaries and parent directories are owned by trusted
administrators. Verify installed executable paths and sudoers using `visudo -c`.
New jails require corresponding status-only entries. Granting direct access to
the Fail2Ban control socket can permit mutation; prefer the explicit commands.
`systemctl is-active fail2ban.service` is a nonprivileged fallback when the client
query fails; systems without systemd retain `status: "unknown"`.

## Interpretation and cost

Zimbra services are discovered from output, including version-specific services.
`healthy` describes successful service status with every reported service running;
it does not assert mailbox delivery or storage health. A stopped service yields
`status: "degraded"`. Missing service output, timeout and privilege failures are
reported in `errors`. `available` means installation evidence was found, not that
all queries succeeded; false with permission errors does not prove absence.

Queue summary uses `zmqstat` only, with no mailq/postqueue/qshape detail fallback.
Total sums hold, corrupt, deferred, active, incoming and maildrop if emitted.
Missing or malformed required counts omit the queue instead of inventing zeros.
Summary counting still has cost proportional to spool entries on the installed
Zimbra implementation; increase the interval for large queues. It never reads
message bodies through the agent. Non-MTA hosts can legitimately lack queue data.
Storage is filesystem usage at `/opt/zimbra/store` and `/opt/zimbra/index`, which
may share a filesystem. These are filesystem capacities, not directory sizes or
per-mailbox quotas. Custom storage volumes remain visible in host partitions.
Host uptime remains the existing heartbeat `uptimeSec`.

Fail2Ban reports each jail's current counters and banned IPs. Jail names are
validated and passed as individual argv values. Unknown or unreadable status is
`running: false, status: "unknown"`, with an error; confirmed inactive systemd
state is `status: "stopped"`. Failed jail entries carry `error`; their numeric
zeros must not be interpreted as observations. `partial: true` means aggregate
counters sum only successful jails. Counters can reset when Fail2Ban restarts.

## Example heartbeat (host metrics abbreviated)

```json
{
  "type": "heartbeat",
  "cpuPercent": 4.2,
  "memPercent": 35,
  "diskPercent": 42,
  "uptimeSec": 86400,
  "zimbra": {
    "available": true,
    "healthy": false,
    "status": "degraded",
    "version": "Release 10.0.0.GA",
    "services": { "ldap": { "status": "running" }, "antivirus": { "status": "stopped" } },
    "queue": { "total": 18, "deferred": 3, "active": 10, "counts": { "hold": 1, "corrupt": 0, "deferred": 3, "active": 10, "incoming": 4 } },
    "checkedAt": "2026-09-08T02:00:00Z"
  },
  "fail2ban": {
    "available": true,
    "running": true,
    "status": "running",
    "jailCount": 1,
    "currentlyBanned": 1,
    "totalBanned": 271,
    "jails": [{ "name": "sshd", "currentlyFailed": 2, "totalFailed": 514, "currentlyBanned": 1, "totalBanned": 271, "bannedIps": ["192.0.2.1"] }],
    "checkedAt": "2026-09-08T02:00:00Z"
  }
}
```

## Verification

From `agent/`: `go test ./...`, `go vet ./...`. Parser fixtures and injected
command failures need neither Zimbra nor Fail2Ban. Linux cross-compilation from
Windows can be checked with `GOOS=linux GOARCH=amd64 go build ./...` (set environment
variables using the syntax of your shell). Validate actual privileges and command
output on your deployment host before enabling these optional modules there.

References: [Zimbra zmcontrol](https://wiki.zimbra.com/wiki/Zmcontrol),
[Zimbra queue summary](https://wiki.zimbra.com/index.php?title=Managing-The-Postfix-Queues),
[Fail2Ban counters](https://github.com/fail2ban/fail2ban/discussions/3413).
