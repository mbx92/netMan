import prisma from '../../../../utils/prisma'
import { getMikroTikClientById } from '../../../../utils/mikrotik'

// DELETE /api/mikrotik/[id]/hotspot-bindings/[bindingId] - Remove a hotspot IP binding
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const bindingId = getRouterParam(event, 'bindingId')

    if (!id || !bindingId) {
        throw createError({
            statusCode: 400,
            statusMessage: 'MikroTik device ID and binding ID are required',
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
        await client.removeHotspotIpBinding(bindingId)

        await prisma.auditLog.create({
            data: {
                actor: 'system',
                action: 'REMOVE_HOTSPOT_IP_BINDING',
                target: id,
                details: { name: device.name, bindingId },
                result: 'success',
            },
        })

        return { success: true }
    } catch (error) {
        await prisma.auditLog.create({
            data: {
                actor: 'system',
                action: 'REMOVE_HOTSPOT_IP_BINDING',
                target: id,
                details: { name: device.name, bindingId, error: (error as Error).message },
                result: 'failed',
            },
        })
        throw createError({
            statusCode: 502,
            statusMessage: `Failed to remove hotspot IP binding: ${(error as Error).message}`,
        })
    }
})
