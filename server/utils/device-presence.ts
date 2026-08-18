/**
 * Device presence for agent-backed machines.
 *
 * ICMP ping (devices/stream) cannot see PCs behind NAT or a host firewall.
 * The agent's outbound WebSocket is the authoritative "this machine is up"
 * signal — ping must not overwrite that with OFFLINE.
 */
import { agentManager } from './agent-manager'

export type LinkedAgent = { id: string; status: string } | null | undefined

export function isLinkedAgentOnline(agent: LinkedAgent): boolean {
    if (!agent) return false
    return agentManager.isOnline(agent.id)
}

export function deviceStatusWithAgent(deviceStatus: string, agent: LinkedAgent): string {
    if (deviceStatus === 'MAINTENANCE') return deviceStatus
    if (isLinkedAgentOnline(agent)) return 'ONLINE'
    return deviceStatus
}
