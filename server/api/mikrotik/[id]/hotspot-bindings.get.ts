import prisma from '../../../utils/prisma'
import { getMikroTikClientById } from '../../../utils/mikrotik'

// GET /api/mikrotik/[id]/hotspot-bindings - Live list of hotspot IP bindings from the router
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
        const bindings = await client.getHotspotIpBindings()
        return {
            success: true,
            total: bindings.length,
            bindings,
        }
    } catch (error) {
        throw createError({
            statusCode: 502,
            statusMessage: `Failed to fetch hotspot IP bindings from ${device.name}: ${(error as Error).message}`,
        })
    }
})
