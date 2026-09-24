/**
 * Request/response commands sent down an agent's persistent WebSocket
 * (server/api/agents/connect.ts) — unlike the tunnel channels in
 * agent-tunnel.ts, these are one-shot: send a JSON control frame tagged
 * with a requestId, and resolve a pending Promise when the matching
 * `*-result` frame comes back.
 */
import { randomUUID } from 'node:crypto'
import { agentManager } from './agent-manager'

export interface CommandResult {
    success: boolean
    error?: string
    details?: {
        mode: string
        subject: string
        notAfter: string
        fingerprint: string
        backupId: string
    }
}

interface PendingCommand {
    resolve: (result: CommandResult) => void
    timeout: NodeJS.Timeout
}

const pending = new Map<string, PendingCommand>()
const activeZimbraSslAgents = new Set<string>()
const DEFAULT_TIMEOUT_MS = 10_000

function sendCommand(agentId: string, message: Record<string, unknown>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<CommandResult> {
    const connected = agentManager.get(agentId)
    if (!connected) {
        return Promise.reject(new Error('Agent is not connected'))
    }

    const requestId = randomUUID()

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pending.delete(requestId)
            reject(new Error('Agent did not respond in time'))
        }, timeoutMs)

        pending.set(requestId, { resolve, timeout })

        try {
            connected.peer.send(JSON.stringify({ ...message, requestId }))
        } catch (err) {
            clearTimeout(timeout)
            pending.delete(requestId)
            reject(err instanceof Error ? err : new Error('Failed to send command'))
        }
    })
}

export function killProcess(agentId: string, pid: number): Promise<CommandResult> {
    return sendCommand(agentId, { type: 'kill-process', pid })
}

export type PowerAction = 'restart' | 'shutdown'

export function sendPowerAction(agentId: string, action: PowerAction): Promise<CommandResult> {
    return sendCommand(agentId, { type: 'power-action', action })
}

export interface ZimbraSslDeployRequest {
    sslMode: 'letsencrypt' | 'premium'
    domains: string[]
    email?: string
    certificatePem?: string
    privateKeyPem?: string
    caChainPem?: string
}

export async function deployZimbraSsl(agentId: string, request: ZimbraSslDeployRequest): Promise<CommandResult> {
    if (activeZimbraSslAgents.has(agentId)) {
        throw new Error('An SSL deployment is already in progress for this agent')
    }
    activeZimbraSslAgents.add(agentId)
    try {
        // The agent has a 12-minute deployment deadline and may then spend up
        // to five additional minutes restoring the previous certificate.
        return await sendCommand(agentId, { type: 'zimbra-ssl-deploy', ...request }, 18 * 60_000)
    } finally {
        activeZimbraSslAgents.delete(agentId)
    }
}

/** Called by connect.ts's message handler when a *-result control frame arrives. */
export function resolveAgentCommand(requestId: string, result: CommandResult): void {
    const entry = pending.get(requestId)
    if (!entry) return
    clearTimeout(entry.timeout)
    pending.delete(requestId)
    entry.resolve(result)
}
