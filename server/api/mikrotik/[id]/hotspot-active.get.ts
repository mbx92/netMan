import prisma from '../../../utils/prisma'
import { getMikroTikClientById } from '../../../utils/mikrotik'

// GET /api/mikrotik/[id]/hotspot-active - Live list of currently active hotspot hosts from the router
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
        const hosts = await client.getActiveHotspotHosts()
        return {
            success: true,
            total: hosts.length,
            hosts,
        }
    } catch (error) {
        throw createError({
            statusCode: 502,
            statusMessage: `Failed to fetch active hotspot hosts from ${device.name}: ${(error as Error).message}`,
        })
    }
})
