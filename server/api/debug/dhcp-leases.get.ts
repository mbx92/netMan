import { getAllMikroTikClients } from '../../utils/mikrotik'

// GET /api/debug/dhcp-leases - Debug endpoint to view MikroTik DHCP leases
export default defineEventHandler(async () => {
    const clients = await getAllMikroTikClients()

    if (clients.length === 0) {
        throw createError({
            statusCode: 500,
            statusMessage: 'No MikroTik clients configured. Add one in Settings -> MikroTik',
        })
    }

    const allLeases: any[] = []

    for (const { config, client } of clients) {
        try {
            const leases = await client.getDhcpLeases()
            leases.forEach(lease => {
                allLeases.push({
                    source: config.name || config.host,
                    id: lease['.id'],
                    address: lease.address,
                    macAddress: lease['mac-address'],
                    hostName: lease['host-name'] || null,
                    server: lease.server,
                    status: lease.status,
                })
            })
        } catch (error) {
            console.error(`[Debug] Failed to fetch from ${config.host}:`, error)
        }
    }

    return {
        total: allLeases.length,
        withHostname: allLeases.filter(l => l.hostName).length,
        leases: allLeases,
    }
})
