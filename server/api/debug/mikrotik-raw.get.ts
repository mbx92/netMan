import { getMikroTikClient } from '../../utils/mikrotik'

// GET /api/debug/mikrotik-raw - Debug endpoint to see RAW MikroTik API responses
export default defineEventHandler(async () => {
    const client = getMikroTikClient()

    if (!client) {
        throw createError({
            statusCode: 500,
            statusMessage: 'MikroTik client not configured',
        })
    }

    try {
        console.log('\n========== RAW MIKROTIK API DATA ==========')

        // 1. ARP Table
        const arpEntries = await client.getArpTable()
        console.log('\n--- ARP ENTRIES (First 10) ---')
        arpEntries.slice(0, 10).forEach((entry, i) => {
            console.log(`[ARP ${i + 1}]`, JSON.stringify(entry))
        })

        // 2. DHCP Leases
        const dhcpLeases = await client.getDhcpLeases()
        console.log('\n--- DHCP LEASES (First 10) ---')
        dhcpLeases.slice(0, 10).forEach((lease, i) => {
            console.log(`[DHCP ${i + 1}]`, JSON.stringify(lease))
        })

        // 3. Combined Network Devices
        const networkDevices = await client.getNetworkDevices()
        console.log('\n--- COMBINED NETWORK DEVICES (First 10) ---')
        networkDevices.slice(0, 10).forEach((device, i) => {
            console.log(`[Device ${i + 1}]`, JSON.stringify(device))
        })

        // 4. Router Identity
        const identity = await client.getIdentity()
        console.log('\n--- ROUTER IDENTITY ---')
        console.log('Identity:', identity)

        console.log('\n============================================\n')

        return {
            mikrotikHost: process.env.MIKROTIK_HOST,
            routerIdentity: identity,
            arp: {
                total: arpEntries.length,
                sampleFields: arpEntries.length > 0 ? Object.keys(arpEntries[0]) : [],
                entries: arpEntries.slice(0, 20).map(entry => ({
                    ...entry,
                })),
            },
            dhcp: {
                total: dhcpLeases.length,
                withHostname: dhcpLeases.filter(l => l['host-name']).length,
                sampleFields: dhcpLeases.length > 0 ? Object.keys(dhcpLeases[0]) : [],
                leases: dhcpLeases.slice(0, 20).map(lease => ({
                    '.id': lease['.id'],
                    address: lease.address,
                    'mac-address': lease['mac-address'],
                    'host-name': lease['host-name'],
                    'client-id': lease['client-id'],
                    'active-address': (lease as any)['active-address'],
                    'active-mac-address': (lease as any)['active-mac-address'],
                    'active-client-id': (lease as any)['active-client-id'],
                    server: lease.server,
                    status: lease.status,
                    'last-seen': lease['last-seen'],
                    dynamic: lease.dynamic,
                    // Include ALL raw fields
                    _raw: lease,
                })),
            },
            combined: {
                total: networkDevices.length,
                devices: networkDevices.slice(0, 20),
            },
        }
    } catch (error) {
        console.error('[Debug] Failed to fetch MikroTik data:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to fetch MikroTik data: ' + (error as Error).message,
        })
    }
})
