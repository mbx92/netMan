import prisma from '../../../utils/prisma'
import { clearClientCache } from '../../../utils/mikrotik'

// DELETE /api/mikrotik/[id] - Delete a MikroTik device
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'MikroTik device ID is required',
        })
    }

    const existing = await prisma.mikrotikDevice.findUnique({
        where: { id },
    })

    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'MikroTik device not found',
        })
    }

    await prisma.mikrotikDevice.delete({
        where: { id },
    })

    // Clear client cache
    clearClientCache(id)

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'DELETE_MIKROTIK',
            target: id,
            details: { name: existing.name, host: existing.host },
            result: 'success',
        },
    })

    return { success: true }
})
