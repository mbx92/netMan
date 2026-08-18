import prisma, { withPrismaRetry } from '../utils/prisma'
import { loadConfigManagedHosts, resolveDeviceStatus } from '../utils/device-presence'

const STALE_MS = 24 * 60 * 60 * 1000
const IPAM_HOT_PERCENT = 80
const NAS_HOT_PERCENT = 90
const ATTENTION_LIMIT = 10

type SyncKind = 'mikrotik' | 'proxmox' | 'nas' | 'hikvision'
type SyncStatus = 'ok' | 'stale' | 'never' | 'inactive'
type AttentionSeverity = 'error' | 'warning'
type AttentionKind = 'offline' | 'ipam' | 'sync' | 'ports' | 'storage'

type AttentionItem = {
    id: string
    kind: AttentionKind
    severity: AttentionSeverity
    title: string
    detail: string
    href: string
    at: Date
}

type IntegrationItem = {
    kind: SyncKind
    id: string
    name: string
    host: string | null
    lastSync: Date | null
    createdAt: Date
    isActive: boolean
    status: SyncStatus
    href: string
}

function siteFilter(siteId?: string) {
    return siteId ? { siteId } : {}
}

function cidrUsableHosts(network: string): number {
    const [, cidr] = network.split('/')
    const prefix = Number.parseInt(cidr || '24', 10)
    if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) return 0
    const raw = 2 ** (32 - prefix) - 2
    return Math.max(0, raw)
}

function syncStatus(lastSync: Date | null, isActive: boolean): SyncStatus {
    if (!isActive) return 'inactive'
    if (!lastSync) return 'never'
    if (Date.now() - lastSync.getTime() > STALE_MS) return 'stale'
    return 'ok'
}

function logTargetLabel(log: { target: string; details: unknown }): string {
    const details = log.details && typeof log.details === 'object'
        ? log.details as Record<string, unknown>
        : null
    const name = details && typeof details.name === 'string' ? details.name : null
    const deviceName = details && typeof details.deviceName === 'string' ? details.deviceName : null
    const identity = details && typeof details.identity === 'string' ? details.identity : null
    const hostname = details && typeof details.hostname === 'string' ? details.hostname : null
    const label = name || deviceName || identity || hostname
    if (label) return label
    if (log.target.length === 36) return log.target.slice(0, 8)
    return log.target
}

function hrefForKind(kind: SyncKind, id: string): string {
    if (kind === 'mikrotik') return `/settings/mikrotik/${id}`
    if (kind === 'proxmox') return `/proxmox/${id}`
    if (kind === 'nas') return `/nas/${id}`
    return `/hikvision/${id}`
}

function severityRank(severity: AttentionSeverity): number {
    return severity === 'error' ? 0 : 1
}

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const siteId = typeof query.siteId === 'string' && query.siteId ? query.siteId : undefined
    const whereSite = siteFilter(siteId)
    const portWhere = siteId ? { device: { siteId } } : {}
    const staleBefore = new Date(Date.now() - STALE_MS)

    return withPrismaRetry(async () => {
        const [
            devicesForPresence,
            configHosts,
            typeCounts,
            deviceTypes,
            totalDevices,
            portsTotal,
            portsAssigned,
            unassignedByDevice,
            recentLogs,
            ipRanges,
            mikrotikDevices,
            proxmoxNodes,
            nasDevices,
            hikvisionDevices,
            failedSyncs,
        ] = await Promise.all([
            prisma.device.findMany({
                where: whereSite,
                select: {
                    id: true,
                    name: true,
                    typeCode: true,
                    ip: true,
                    lastSeen: true,
                    status: true,
                    agent: { select: { id: true, status: true } },
                    isApiActive: true,
                },
            }),
            loadConfigManagedHosts(),
            prisma.device.groupBy({
                by: ['typeCode'],
                where: whereSite,
                _count: { id: true },
            }),
            prisma.deviceType.findMany({
                select: { code: true, name: true, color: true },
            }),
            prisma.device.count({ where: whereSite }),
            prisma.networkPort.count({ where: portWhere }),
            prisma.networkPort.count({
                where: { ...portWhere, connectedDeviceId: { not: null } },
            }),
            prisma.networkPort.groupBy({
                by: ['deviceId'],
                where: { ...portWhere, connectedDeviceId: null },
                _count: { id: true },
            }),
            prisma.auditLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: 8,
            }),
            prisma.iPRange.findMany({
                where: whereSite,
                include: {
                    site: { select: { id: true, name: true } },
                    _count: { select: { allocations: true } },
                },
                orderBy: { name: 'asc' },
            }),
            prisma.mikrotikDevice.findMany({
                where: whereSite,
                select: { id: true, name: true, host: true, isActive: true, lastSync: true, createdAt: true },
                orderBy: { name: 'asc' },
            }),
            prisma.proxmoxNode.findMany({
                where: whereSite,
                select: { id: true, name: true, host: true, isActive: true, lastSync: true, createdAt: true },
                orderBy: { name: 'asc' },
            }),
            prisma.nAS.findMany({
                where: whereSite,
                select: {
                    id: true,
                    name: true,
                    ipAddress: true,
                    isActive: true,
                    lastCapturedAt: true,
                    createdAt: true,
                    totalCapacityGB: true,
                    usedCapacityGB: true,
                },
                orderBy: { name: 'asc' },
            }),
            prisma.hikvisionDevice.findMany({
                where: whereSite,
                select: { id: true, name: true, host: true, isActive: true, lastSync: true, createdAt: true },
                orderBy: { name: 'asc' },
            }),
            prisma.auditLog.findMany({
                where: {
                    OR: [
                        { result: 'failed', createdAt: { gte: staleBefore } },
                        { action: 'FAIL_DISCOVERY', createdAt: { gte: staleBefore } },
                    ],
                },
                orderBy: { createdAt: 'desc' },
                take: 8,
            }),
        ])

        const typeMeta = Object.fromEntries(deviceTypes.map(t => [t.code, t]))
        const byStatus: Record<string, number> = {}
        for (const device of devicesForPresence) {
            const status = resolveDeviceStatus({
                status: device.status,
                agent: device.agent,
                isApiActive: device.isApiActive,
                ip: device.ip,
                configHosts,
            })
            byStatus[status] = (byStatus[status] || 0) + 1
        }
        const offlineDevices = devicesForPresence
            .filter(d => resolveDeviceStatus({
                status: d.status,
                agent: d.agent,
                isApiActive: d.isApiActive,
                ip: d.ip,
                configHosts,
            }) === 'OFFLINE')
            .sort((a, b) => (b.lastSeen?.getTime() || 0) - (a.lastSeen?.getTime() || 0))
            .slice(0, 8)
        const byType = typeCounts
            .map(t => ({
                code: t.typeCode,
                name: typeMeta[t.typeCode]?.name || t.typeCode,
                color: typeMeta[t.typeCode]?.color || null,
                count: t._count.id,
            }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

        const portsFree = portsTotal - portsAssigned

        const unassignedDeviceIds = unassignedByDevice
            .sort((a, b) => b._count.id - a._count.id)
            .slice(0, 3)
            .map(row => row.deviceId)
        const unassignedDevices = unassignedDeviceIds.length
            ? await prisma.device.findMany({
                where: { id: { in: unassignedDeviceIds } },
                select: { id: true, name: true },
            })
            : []
        const unassignedName = Object.fromEntries(unassignedDevices.map(d => [d.id, d.name]))

        const ipamRanges = ipRanges.map((range) => {
            const totalIps = cidrUsableHosts(range.network)
            const usedIps = range._count.allocations
            const freeIps = Math.max(0, totalIps - usedIps)
            const usagePercent = totalIps > 0 ? Math.round((usedIps / totalIps) * 100) : 0
            return {
                id: range.id,
                name: range.name,
                network: range.network,
                site: range.site,
                totalIps,
                usedIps,
                freeIps,
                usagePercent,
                updatedAt: range.updatedAt,
            }
        })
        const ipamUsed = ipamRanges.reduce((sum, r) => sum + r.usedIps, 0)
        const ipamTotal = ipamRanges.reduce((sum, r) => sum + r.totalIps, 0)
        const ipamFree = Math.max(0, ipamTotal - ipamUsed)

        const integrations: IntegrationItem[] = [
            ...mikrotikDevices.map(d => ({
                kind: 'mikrotik' as const,
                id: d.id,
                name: d.name,
                host: d.host,
                lastSync: d.lastSync,
                createdAt: d.createdAt,
                isActive: d.isActive,
                status: syncStatus(d.lastSync, d.isActive),
                href: hrefForKind('mikrotik', d.id),
            })),
            ...proxmoxNodes.map(d => ({
                kind: 'proxmox' as const,
                id: d.id,
                name: d.name,
                host: d.host,
                lastSync: d.lastSync,
                createdAt: d.createdAt,
                isActive: d.isActive,
                status: syncStatus(d.lastSync, d.isActive),
                href: hrefForKind('proxmox', d.id),
            })),
            ...nasDevices.map(d => ({
                kind: 'nas' as const,
                id: d.id,
                name: d.name,
                host: d.ipAddress,
                lastSync: d.lastCapturedAt,
                createdAt: d.createdAt,
                isActive: d.isActive,
                status: syncStatus(d.lastCapturedAt, d.isActive),
                href: hrefForKind('nas', d.id),
            })),
            ...hikvisionDevices.map(d => ({
                kind: 'hikvision' as const,
                id: d.id,
                name: d.name,
                host: d.host,
                lastSync: d.lastSync,
                createdAt: d.createdAt,
                isActive: d.isActive,
                status: syncStatus(d.lastSync, d.isActive),
                href: hrefForKind('hikvision', d.id),
            })),
        ]

        const attention: AttentionItem[] = []

        for (const device of offlineDevices) {
            attention.push({
                id: `offline-${device.id}`,
                kind: 'offline',
                severity: 'error',
                title: `${device.name} is offline`,
                detail: device.ip ? device.ip : 'No IP recorded',
                href: `/devices/${device.id}`,
                at: device.lastSeen || new Date(0),
            })
        }

        for (const log of failedSyncs) {
            attention.push({
                id: `fail-${log.id}`,
                kind: 'sync',
                severity: 'error',
                title: `${log.action.replace(/_/g, ' ').toLowerCase()} failed`,
                detail: logTargetLabel(log),
                href: '/audit',
                at: log.createdAt,
            })
        }

        for (const item of integrations) {
            if (item.status === 'never') {
                attention.push({
                    id: `never-${item.kind}-${item.id}`,
                    kind: 'sync',
                    severity: 'warning',
                    title: `${item.name} has never synced`,
                    detail: item.kind,
                    href: item.href,
                    at: item.createdAt,
                })
            } else if (item.status === 'stale') {
                attention.push({
                    id: `stale-${item.kind}-${item.id}`,
                    kind: 'sync',
                    severity: 'warning',
                    title: `${item.name} sync is stale`,
                    detail: item.kind,
                    href: item.href,
                    at: item.lastSync || item.createdAt,
                })
            }
        }

        for (const range of ipamRanges.filter(r => r.usagePercent >= IPAM_HOT_PERCENT)) {
            attention.push({
                id: `ipam-${range.id}`,
                kind: 'ipam',
                severity: 'warning',
                title: `${range.name} is ${range.usagePercent}% allocated`,
                detail: `${range.usedIps}/${range.totalIps} · ${range.network}`,
                href: '/ipam',
                at: range.updatedAt,
            })
        }

        for (const nas of nasDevices) {
            if (!nas.totalCapacityGB || nas.totalCapacityGB <= 0 || nas.usedCapacityGB == null) continue
            const pct = Math.round((nas.usedCapacityGB / nas.totalCapacityGB) * 100)
            if (pct < NAS_HOT_PERCENT) continue
            attention.push({
                id: `nas-${nas.id}`,
                kind: 'storage',
                severity: 'warning',
                title: `${nas.name} storage is ${pct}% used`,
                detail: `${Math.round(nas.usedCapacityGB)} / ${Math.round(nas.totalCapacityGB)} GB`,
                href: `/nas/${nas.id}`,
                at: nas.lastCapturedAt || nas.createdAt,
            })
        }

        if (portsFree > 0) {
            const top = unassignedByDevice[0]
            const topName = top ? unassignedName[top.deviceId] : null
            attention.push({
                id: 'ports-unassigned',
                kind: 'ports',
                severity: 'warning',
                title: `${portsFree} unassigned port${portsFree === 1 ? '' : 's'}`,
                detail: topName
                    ? `${top._count.id} free on ${topName}`
                    : `Across ${unassignedByDevice.length} device${unassignedByDevice.length === 1 ? '' : 's'}`,
                href: top ? `/devices/${top.deviceId}` : '/devices',
                at: new Date(0),
            })
        }

        attention.sort((a, b) => {
            const time = b.at.getTime() - a.at.getTime()
            if (time !== 0) return time
            return severityRank(a.severity) - severityRank(b.severity)
        })

        const online = byStatus.ONLINE || 0
        const offline = byStatus.OFFLINE || 0

        return {
            siteId: siteId || null,
            totals: {
                devices: totalDevices,
                online,
                offline,
                unknown: byStatus.UNKNOWN || 0,
                maintenance: byStatus.MAINTENANCE || 0,
                reachability: totalDevices > 0 ? Math.round((online / totalDevices) * 100) : 0,
            },
            ports: {
                total: portsTotal,
                assigned: portsAssigned,
                free: portsFree,
                utilization: portsTotal > 0 ? Math.round((portsAssigned / portsTotal) * 100) : 0,
            },
            ipam: {
                ranges: ipamRanges.length,
                used: ipamUsed,
                free: ipamFree,
                total: ipamTotal,
                utilization: ipamTotal > 0 ? Math.round((ipamUsed / ipamTotal) * 100) : 0,
                items: ipamRanges
                    .slice()
                    .sort((a, b) => b.usagePercent - a.usagePercent)
                    .slice(0, 6),
            },
            byType,
            integrations: integrations.map(({ createdAt: _createdAt, ...item }) => item),
            attention: attention.slice(0, ATTENTION_LIMIT).map(({ at, ...item }) => ({
                ...item,
                at,
            })),
            recentLogs: recentLogs.map(log => ({
                id: log.id,
                actor: log.actor,
                action: log.action,
                target: logTargetLabel(log),
                result: log.result,
                createdAt: log.createdAt,
            })),
        }
    })
})
