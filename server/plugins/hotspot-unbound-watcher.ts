import prisma, { withPrismaRetry } from '../utils/prisma'
import { getAllMikroTikClients, type MikroTikConfig } from '../utils/mikrotik'
import { publishNotification } from '../utils/notification-bus'
import { isLgDevice, parseMacPrefixList } from '../../shared/utils/device-vendor'

const INTERVAL_MS = Number(process.env.HOTSPOT_WATCH_INTERVAL_MS) || 60_000
const EXTRA_LG_MAC_PREFIXES = parseMacPrefixList(process.env.LG_MAC_PREFIXES)

export default defineNitroPlugin((nitroApp) => {
    let running = false
    const timer = setInterval(() => {
        if (running) return
        running = true
        scanAllRouters().finally(() => {
            running = false
        })
    }, INTERVAL_MS)

    nitroApp.hooks.hook('close', () => clearInterval(timer))
})

async function scanAllRouters() {
    const clients = await getAllMikroTikClients()

    // The hotspot binding page and its APIs (hotspot-active, hotspot-bindings) only
    // resolve routers from the MikrotikDevice table — a router sourced from Device
    // (typeCode ROUTER, isApiActive) has no working /settings/mikrotik/[id]/hotspot
    // page, so its notification link would 404. Scope the watcher the same way.
    const mikrotikDeviceIds = new Set(
        (await prisma.mikrotikDevice.findMany({ select: { id: true } })).map((d) => d.id),
    )

    for (const { config, client } of clients) {
        if (!config.id || !mikrotikDeviceIds.has(config.id)) continue
        try {
            const [activeHosts, bindings, leases] = await Promise.all([
                client.getActiveHotspotHosts(),
                client.getHotspotIpBindings(),
                client.getDhcpLeases(),
            ])
            if (!activeHosts.length) continue

            const hostnameByMac = new Map(
                leases
                    .filter((l) => l['mac-address'])
                    .map((l) => [l['mac-address'].toLowerCase(), l['host-name']]),
            )

            const boundMacs = new Set(
                bindings.map((b) => b.mac?.toLowerCase()).filter((m): m is string => !!m),
            )
            const unbound = activeHosts.filter((h) => {
                if (!h.mac || boundMacs.has(h.mac.toLowerCase())) return false
                const hostname = hostnameByMac.get(h.mac.toLowerCase())
                return isLgDevice(h.mac, hostname, EXTRA_LG_MAC_PREFIXES)
            })
            const unboundMacs = new Set(unbound.map((h) => h.mac.toLowerCase()))

            await createNotificationsForUnbound(config, unbound)
            await resolveClearedNotifications(config, unboundMacs)
        } catch (error) {
            console.error(`[HotspotWatcher] Scan failed for ${config.name || config.host}:`, error)
        }
    }
}

async function createNotificationsForUnbound(
    config: MikroTikConfig,
    unbound: { id: string; address: string; mac: string; server?: string; uptime?: string }[],
) {
    for (const host of unbound) {
        const mac = host.mac.toLowerCase()
        const dedupeKey = `hotspot-unbound:${config.id}:${mac}`

        const existing = await withPrismaRetry(() =>
            prisma.notification.findFirst({ where: { dedupeKey, resolvedAt: null } }),
        )
        if (existing) continue

        const notification = await withPrismaRetry(() =>
            prisma.notification.create({
                data: {
                    type: 'HOTSPOT_UNBOUND_ACTIVE',
                    severity: 'warning',
                    title: `Unbound LG device active on ${config.name || config.host}`,
                    message: `${host.mac} (${host.address}) is an LG device connected to the hotspot but has no IP binding.`,
                    link: `/settings/mikrotik/${config.id}/hotspot`,
                    dedupeKey,
                    routerId: config.id,
                    mac,
                    metadata: {
                        routerName: config.name,
                        host: config.host,
                        address: host.address,
                        server: host.server,
                        uptime: host.uptime,
                    },
                },
            }),
        )
        publishNotification(notification)
    }
}

async function resolveClearedNotifications(config: MikroTikConfig, unboundMacs: Set<string>) {
    if (unboundMacs.size === 0) {
        await withPrismaRetry(() =>
            prisma.notification.updateMany({
                where: { type: 'HOTSPOT_UNBOUND_ACTIVE', resolvedAt: null, routerId: config.id },
                data: { resolvedAt: new Date() },
            }),
        )
        return
    }

    await withPrismaRetry(() =>
        prisma.notification.updateMany({
            where: {
                type: 'HOTSPOT_UNBOUND_ACTIVE',
                resolvedAt: null,
                routerId: config.id,
                mac: { notIn: Array.from(unboundMacs) },
            },
            data: { resolvedAt: new Date() },
        }),
    )
}
