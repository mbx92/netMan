import prisma from '../../../../../utils/prisma'
import { getMikroTikClientById } from '../../../../../utils/mikrotik'

// POST /api/mikrotik/[id]/dhcp-leases/[leaseId]/make-static - Convert a dynamic DHCP lease to static
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const leaseId = getRouterParam(event, 'leaseId')

    if (!id || !leaseId) {
        throw createError({
            statusCode: 400,
            statusMessage: 'MikroTik device ID and lease ID are required',
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
        await client.makeDhcpLeaseStatic(leaseId)

        await prisma.auditLog.create({
            data: {
                actor: 'system',
                action: 'MAKE_DHCP_LEASE_STATIC',
                target: id,
                details: { name: device.name, leaseId },
                result: 'success',
            },
        })

        return { success: true }
    } catch (error) {
        await prisma.auditLog.create({
            data: {
                actor: 'system',
                action: 'MAKE_DHCP_LEASE_STATIC',
                target: id,
                details: { name: device.name, leaseId, error: (error as Error).message },
                result: 'failed',
            },
        })
        throw createError({
            statusCode: 502,
            statusMessage: `Failed to make DHCP lease static: ${(error as Error).message}`,
        })
    }
})
