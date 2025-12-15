import prisma from '../../utils/prisma'
import type { DeviceType } from '@prisma/client'

interface ImportDeviceRequest {
    ip: string
    hostname?: string
    mac?: string
    deviceType: string
    name?: string
    location?: string
}

interface ImportBody {
    devices: ImportDeviceRequest[]
}

// POST /api/discovery/import - Import discovered devices into the database
export default defineEventHandler(async (event) => {
    const body = await readBody<ImportBody>(event)

    if (!body.devices || !Array.isArray(body.devices) || body.devices.length === 0) {
        throw createError({
            statusCode: 400,
            statusMessage: 'At least one device is required',
        })
    }

    const results = {
        imported: 0,
        skipped: 0,
        errors: [] as { ip: string; reason: string }[],
    }

    for (const device of body.devices) {
        try {
            // Check if device with this IP already exists
            const existingByIp = await prisma.device.findFirst({
                where: { ip: device.ip },
            })

            if (existingByIp) {
                results.skipped++
                results.errors.push({ ip: device.ip, reason: 'Device with this IP already exists' })
                continue
            }

            // Check if device with this MAC already exists
            if (device.mac) {
                const normalizedMac = device.mac.toLowerCase().replace(/[:-]/g, '')
                const existingByMac = await prisma.device.findUnique({
                    where: { mac: normalizedMac },
                })

                if (existingByMac) {
                    results.skipped++
                    results.errors.push({ ip: device.ip, reason: 'Device with this MAC already exists' })
                    continue
                }
            }

            // Map device type string to enum
            const typeMap: Record<string, DeviceType> = {
                ROUTER: 'ROUTER',
                SWITCH: 'SWITCH',
                ACCESS_POINT: 'ACCESS_POINT',
                SERVER_LINUX: 'SERVER_LINUX',
                PC_LINUX: 'PC_LINUX',
                PC_WINDOWS: 'PC_WINDOWS',
                PRINTER: 'PRINTER',
                SMART_TV: 'SMART_TV',
                VM: 'VM',
                OTHER: 'OTHER',
            }

            const deviceType = typeMap[device.deviceType] || 'OTHER'

            // Create the device
            const createdDevice = await prisma.device.create({
                data: {
                    name: device.name || device.hostname || `Device-${device.ip}`,
                    type: deviceType,
                    ip: device.ip,
                    mac: device.mac?.toLowerCase().replace(/[:-]/g, ''),
                    hostname: device.hostname,
                    location: device.location,
                    status: 'ONLINE',
                    lastSeen: new Date(),
                    wakeable: deviceType === 'PC_WINDOWS',
                },
            })

            // Log the action
            await prisma.auditLog.create({
                data: {
                    actor: 'system',
                    action: 'IMPORT_DEVICE',
                    target: createdDevice.id,
                    details: {
                        name: createdDevice.name,
                        ip: createdDevice.ip,
                        type: createdDevice.type,
                        source: 'discovery',
                    },
                    result: 'success',
                },
            })

            results.imported++
        } catch (error) {
            results.errors.push({
                ip: device.ip,
                reason: error instanceof Error ? error.message : 'Unknown error',
            })
        }
    }

    return results
})
