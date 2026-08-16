/**
 * Request/response commands sent down an agent's persistent WebSocket
 * (server/api/agents/connect.ts) — unlike the tunnel channels in
 * agent-tunnel.ts, these are one-shot: send a JSON control frame tagged
 * with a requestId, and resolve a pending Promise when the matching
 * `*-result` frame comes back.
 */
import { randomUUID } from 'node:crypto'
import { agentManager } from './agent-manager'

export interface KillProcessResult {
    success: boolean
    error?: string
}

interface PendingKill {
    resolve: (result: KillProcessResult) => void
    timeout: NodeJS.Timeout
}

const pendingKills = new Map<string, PendingKill>()

const KILL_TIMEOUT_MS = 10_000

export function killProcess(agentId: string, pid: number): Promise<KillProcessResult> {
    const connected = agentManager.get(agentId)
    if (!connected) {
        return Promise.reject(new Error('Agent is not connected'))
    }

    const requestId = randomUUID()

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pendingKills.delete(requestId)
            reject(new Error('Agent did not respond in time'))
        }, KILL_TIMEOUT_MS)

        pendingKills.set(requestId, { resolve, timeout })

        try {
            connected.peer.send(JSON.stringify({ type: 'kill-process', requestId, pid }))
        } catch (err) {
            clearTimeout(timeout)
            pendingKills.delete(requestId)
            reject(err instanceof Error ? err : new Error('Failed to send kill-process command'))
        }
    })
}

/** Called by connect.ts's message handler when a kill-process-result frame arrives. */
export function resolveKillProcess(requestId: string, result: KillProcessResult): void {
    const entry = pendingKills.get(requestId)
    if (!entry) return
    clearTimeout(entry.timeout)
    pendingKills.delete(requestId)
    entry.resolve(result)
}
