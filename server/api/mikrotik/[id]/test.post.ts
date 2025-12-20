import prisma from '../../../utils/prisma'
import { createMikroTikClient, clearClientCache } from '../../../utils/mikrotik'

// POST /api/mikrotik/[id]/test - Test connection to MikroTik
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

    try {
        const client = createMikroTikClient({
            host: device.host,
            port: device.port,
            username: device.username,
            password: device.password,
            apiVersion: device.apiVersion as 'v6' | 'v7',
        })

        const connected = await client.testConnection()
        const identity = connected ? await client.getIdentity() : undefined

        // Clear cache to ensure fresh client on next use
        clearClientCache(device.id)

        return {
            success: connected,
            identity,
            message: connected
                ? `Successfully connected to ${identity || device.host}`
                : 'Connection failed',
        }
    } catch (error) {
        return {
            success: false,
            message: `Connection failed: ${(error as Error).message}`,
        }
    }
})
