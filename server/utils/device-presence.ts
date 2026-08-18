/**
 * Device presence is agent WebSocket only — ICMP ping is not used.
 * Machines without an agent stay UNKNOWN (or MAINTENANCE if set).
 */
import { agentManager } from './agent-manager'

export type LinkedAgent = { id: string; status: string } | null | undefined

export function isLinkedAgentOnline(agent: LinkedAgent): boolean {
    if (!agent) return false
    return agentManager.isOnline(agent.id)
}

export function deviceStatusWithAgent(deviceStatus: string, agent: LinkedAgent): string {
    if (deviceStatus === 'MAINTENANCE') return 'MAINTENANCE'
    if (!agent) return 'UNKNOWN'
    return isLinkedAgentOnline(agent) ? 'ONLINE' : 'OFFLINE'
}

export function agentReachability(agent: LinkedAgent): 'online' | 'offline' | 'unknown' {
    if (!agent) return 'unknown'
    return isLinkedAgentOnline(agent) ? 'online' : 'offline'
}
