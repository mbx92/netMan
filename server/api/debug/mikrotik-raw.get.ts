import { getAllMikroTikClients } from '../../utils/mikrotik'

// GET /api/debug/mikrotik-raw - Debug endpoint to see RAW MikroTik API responses
export default defineEventHandler(async () => {
    const clients = await getAllMikroTikClients()

    if (clients.length === 0) {
        throw createError({
            statusCode: 500,
            statusMessage: 'No MikroTik clients configured. Add one in Settings -> MikroTik',
        })
    }

    const results: any[] = []

    for (const { config, client } of clients) {
        try {
            const identity = await client.getIdentity()
            const arpEntries = await client.getArpTable()
            const dhcpLeases = await client.getDhcpLeases()
            const networkDevices = await client.getNetworkDevices()

            results.push({
                source: config.name || config.host,
                host: config.host,
                apiVersion: config.apiVersion,
                identity,
                arp: {
                    total: arpEntries.length,
                    entries: arpEntries.slice(0, 10),
                },
                dhcp: {
                    total: dhcpLeases.length,
                    withHostname: dhcpLeases.filter(l => l['host-name']).length,
                    leases: dhcpLeases.slice(0, 10),
                },
                combined: {
                    total: networkDevices.length,
                    devices: networkDevices.slice(0, 10),
                },
            })
        } catch (error) {
            results.push({
                source: config.name || config.host,
                host: config.host,
                apiVersion: config.apiVersion,
                error: (error as Error).message,
            })
        }
    }

    return {
        totalRouters: clients.length,
        results,
    }
})
