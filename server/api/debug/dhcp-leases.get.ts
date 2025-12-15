import { getMikroTikClient } from '../../utils/mikrotik'

// GET /api/debug/dhcp-leases - Debug endpoint to view MikroTik DHCP leases
export default defineEventHandler(async () => {
    const client = getMikroTikClient()

    if (!client) {
        throw createError({
            statusCode: 500,
            statusMessage: 'MikroTik client not configured',
        })
    }

    try {
        const leases = await client.getDhcpLeases()

        // Log to console as well
        console.log('\n========== DHCP LEASES ==========')
        console.log('Total leases:', leases.length)
        leases.forEach((lease, i) => {
            console.log(`[${i + 1}] ${lease.address} | MAC: ${lease['mac-address']} | Hostname: ${lease['host-name'] || '-'} | Status: ${lease.status}`)
        })
        console.log('==================================\n')

        return {
            total: leases.length,
            withHostname: leases.filter(l => l['host-name']).length,
            leases: leases.map(lease => ({
                id: lease['.id'],
                address: lease.address,
                macAddress: lease['mac-address'],
                hostName: lease['host-name'] || null,
                clientId: lease['client-id'] || null,
                server: lease.server,
                status: lease.status,
                lastSeen: lease['last-seen'] || null,
                dynamic: lease.dynamic,
            })),
        }
    } catch (error) {
        console.error('[Debug] Failed to fetch DHCP leases:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to fetch DHCP leases',
        })
    }
})
