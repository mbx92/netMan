/**
 * Device presence:
 * - Agent-backed machines: live WebSocket only (no ICMP).
 * - Config/integration devices (MikroTik API, NAS, Hikvision, Proxmox):
 *   online while that integration is active, otherwise keep stored status.
 */
import prisma from './prisma'
import { agentManager } from './agent-manager'
import { normalizeIpv4 } from './ipam-enrich'

export type LinkedAgent = { id: string; status: string } | null | undefined

export function isLinkedAgentOnline(agent: LinkedAgent): boolean {
    if (!agent) return false
    return agentManager.isOnline(agent.id)
}

export async function loadConfigManagedHosts(): Promise<Set<string>> {
    const [mikrotik, nas, hikvision, proxmox] = await Promise.all([
        prisma.mikrotikDevice.findMany({ where: { isActive: true }, select: { host: true } }),
        prisma.nAS.findMany({ where: { isActive: true }, select: { ipAddress: true } }),
        prisma.hikvisionDevice.findMany({ where: { isActive: true }, select: { host: true } }),
        prisma.proxmoxNode.findMany({ where: { isActive: true }, select: { host: true } }),
    ])

    const hosts = new Set<string>()
    const add = (raw?: string | null) => {
        if (!raw) return
        const ip = normalizeIpv4(raw)
        hosts.add(ip || raw.trim().toLowerCase())
    }
    for (const row of mikrotik) add(row.host)
    for (const row of nas) add(row.ipAddress)
    for (const row of hikvision) add(row.host)
    for (const row of proxmox) add(row.host)
    return hosts
}

function hostKey(ip?: string | null): string | null {
    if (!ip) return null
    return normalizeIpv4(ip) || ip.trim().toLowerCase()
}

export function resolveDeviceStatus(opts: {
    status: string
    agent?: LinkedAgent
    isApiActive?: boolean | null
    ip?: string | null
    configHosts?: Set<string>
}): string {
    if (opts.status === 'MAINTENANCE') return 'MAINTENANCE'
    if (opts.agent) return isLinkedAgentOnline(opts.agent) ? 'ONLINE' : 'OFFLINE'
    if (opts.isApiActive) return 'ONLINE'
    const key = hostKey(opts.ip)
    if (key && opts.configHosts?.has(key)) return 'ONLINE'
    return opts.status
}

/** @deprecated use resolveDeviceStatus */
export function deviceStatusWithAgent(
    deviceStatus: string,
    agent: LinkedAgent,
    extra?: { isApiActive?: boolean | null; ip?: string | null; configHosts?: Set<string> },
): string {
    return resolveDeviceStatus({ status: deviceStatus, agent, ...extra })
}

export function agentReachability(
    agent: LinkedAgent,
    deviceStatus?: string | null,
): 'online' | 'offline' | 'unknown' {
    if (agent) return isLinkedAgentOnline(agent) ? 'online' : 'offline'
    const status = String(deviceStatus || '').toUpperCase()
    if (status === 'ONLINE') return 'online'
    if (status === 'OFFLINE') return 'offline'
    return 'unknown'
}
