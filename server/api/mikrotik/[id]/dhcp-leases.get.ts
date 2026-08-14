import prisma from '../../../utils/prisma'
import { getMikroTikClientById } from '../../../utils/mikrotik'

// GET /api/mikrotik/[id]/dhcp-leases - Live list of DHCP leases from the router
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'MikroTik device ID is required',
        })
    }

    const device = await prisma.mikrotikDevice.findUnique({ where: { id } })
    if (!device) {
        throw createError({
            statusCode: 404,
            statusMessage: 'MikroTik device not found',
        })
    }

    const client = await getMikroTikClientById(id)
    if (!client) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to create MikroTik client',
        })
    }

    try {
        const leases = await client.getDhcpLeases()
        return {
            success: true,
            total: leases.length,
            leases: leases.map(lease => ({
                id: lease['.id'],
                address: lease.address,
                mac: lease['mac-address'],
                hostname: lease['host-name'] || null,
                server: lease.server,
                status: lease.status,
                dynamic: lease.dynamic === true || lease.dynamic === 'true',
            })),
        }
    } catch (error) {
        throw createError({
            statusCode: 502,
            statusMessage: `Failed to fetch DHCP leases from ${device.name}: ${(error as Error).message}`,
        })
    }
})
