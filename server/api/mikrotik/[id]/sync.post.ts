import prisma from '../../../utils/prisma'
import { getMikroTikClientById } from '../../../utils/mikrotik'

// POST /api/mikrotik/[id]/sync - Sync ARP/DHCP data from MikroTik
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'MikroTik device ID is required',
        })
    }

    const device = await prisma.mikrotikDevice.findUnique({
        where: { id },
    })

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
        // Fetch network devices from MikroTik
        const networkDevices = await client.getNetworkDevices()
        const identity = await client.getIdentity()

        // Update last sync time
        await prisma.mikrotikDevice.update({
            where: { id },
            data: { lastSync: new Date() },
        })

        // Log the action
        await prisma.auditLog.create({
            data: {
                actor: 'system',
                action: 'SYNC_MIKROTIK',
                target: id,
                details: {
                    name: device.name,
                    identity,
                    deviceCount: networkDevices.length,
                },
                result: 'success',
            },
        })

        return {
            success: true,
            identity,
            devices: networkDevices.length,
            data: networkDevices,
            message: `Synced ${networkDevices.length} devices from ${identity || device.host}`,
        }
    } catch (error) {
        // Log failure
        await prisma.auditLog.create({
            data: {
                actor: 'system',
                action: 'SYNC_MIKROTIK',
                target: id,
                details: { error: (error as Error).message },
                result: 'failed',
            },
        })

        throw createError({
            statusCode: 500,
            statusMessage: `Sync failed: ${(error as Error).message}`,
        })
    }
})
