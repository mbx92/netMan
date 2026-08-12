import prisma from '../../../utils/prisma'
import { createHikvisionClientById } from '../../../utils/hikvision'

// POST /api/hikvision/[id]/sync - Sync device info and channels from Hikvision ISAPI
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Hikvision device ID is required',
        })
    }

    const device = await prisma.hikvisionDevice.findUnique({
        where: { id },
    })

    if (!device) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Hikvision device not found',
        })
    }

    const client = await createHikvisionClientById(id)
    if (!client) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to create Hikvision client',
        })
    }

    try {
        const snapshot = await client.getFullSnapshot()
        const { info, network, time, rtsp, storage, channels, events } = snapshot

        // Also enrich channels with RTSP URLs
        for (const ch of channels) {
            if (!ch.rtspUrl && ch.ipAddress) {
                ch.rtspUrl = `rtsp://${ch.ipAddress}:554/Streaming/Channels/${String(ch.channelIndex).padStart(2, '0')}1`
            }
        }

        const now = new Date()

        console.log('[Hikvision] Sync info:', JSON.stringify(info))
        console.log('[Hikvision] Sync network:', JSON.stringify(network))
        console.log('[Hikvision] Sync time:', JSON.stringify(time))
        console.log('[Hikvision] Sync channels count:', channels.length)
        console.log('[Hikvision] Sync storage:', JSON.stringify(storage))
        if (channels.length > 0) console.log('[Hikvision] First channel:', JSON.stringify(channels[0]))

        // Update device metadata and last sync
        await prisma.hikvisionDevice.update({
            where: { id },
            data: {
                model: info.model || device.model,
                serialNumber: info.serialNumber || device.serialNumber,
                macAddress: info.macAddress || device.macAddress,
                firmware: info.firmwareVersion || device.firmware,
                deviceType: info.deviceType || device.deviceType,
                lastSync: now,
                lastSnapshot: snapshot as unknown as Record<string, unknown>,
            },
        })

        // Sync channels: delete old, recreate new
        await prisma.hikvisionChannel.deleteMany({
            where: { hikvisionDeviceId: id },
        })

        for (const ch of channels) {
            await prisma.hikvisionChannel.create({
                data: {
                    hikvisionDeviceId: id,
                    channelIndex: ch.channelIndex,
                    name: ch.name || `Channel ${ch.channelIndex}`,
                    ipAddress: ch.ipAddress || null,
                    managePort: ch.managePort || 80,
                    protocol: ch.protocol || null,
                    macAddress: ch.macAddress || null,
                    status: ch.status || 'UNKNOWN',
                    model: ch.model || null,
                    firmware: ch.firmware || null,
                },
            })

            // Enrich IPAM: create or update IPAllocation if IP is known and site has matching range
            if (ch.ipAddress) {
                await enrichIpam(device.siteId, ch.ipAddress, ch.macAddress, ch.name || `Channel ${ch.channelIndex}`)
            }
        }

        await prisma.auditLog.create({
            data: {
                actor: 'system',
                action: 'SYNC_HIKVISION',
                target: id,
                details: {
                    name: device.name,
                    host: device.host,
                    channelCount: channels.length,
                },
                result: 'success',
            },
        })

        return {
            success: true,
            info,
            channels: channels.length,
            message: `Synced ${channels.length} channels from ${device.name}`,
        }
    } catch (error) {
        await prisma.auditLog.create({
            data: {
                actor: 'system',
                action: 'SYNC_HIKVISION',
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

/**
 * Try to enrich IPAM by finding the matching IPRange for the site and creating/updating an allocation.
 */
async function enrichIpam(
    siteId: string | null,
    ip: string,
    mac: string | undefined,
    hostname: string,
): Promise<void> {
    if (!siteId) return

    // Find an IPRange in the same site whose network contains this IP
    const ranges = await prisma.iPRange.findMany({
        where: { siteId },
    })

    const matchingRange = ranges.find(range => ipInCidr(ip, range.network))
    if (!matchingRange) return

    const existing = await prisma.iPAllocation.findUnique({
        where: {
            rangeId_ip: {
                rangeId: matchingRange.id,
                ip,
            },
        },
    })

    if (existing) {
        // Only enrich hostname/mac if not already set, to avoid overwriting manual data
        const data: Record<string, unknown> = {}
        if (!existing.hostname && hostname) data.hostname = hostname
        if (!existing.mac && mac) data.mac = mac
        if (Object.keys(data).length > 0) {
            await prisma.iPAllocation.update({
                where: { id: existing.id },
                data,
            })
        }
    } else {
        await prisma.iPAllocation.create({
            data: {
                rangeId: matchingRange.id,
                ip,
                mac: mac || null,
                hostname: hostname || null,
                type: 'STATIC',
            },
        })
    }
}

function ipToLong(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

function ipInCidr(ip: string, cidr: string): boolean {
    const [network, bits] = cidr.split('/')
    const mask = parseInt(bits, 10)
    if (Number.isNaN(mask) || mask < 0 || mask > 32) return false
    const ipLong = ipToLong(ip)
    const netLong = ipToLong(network)
    const maskLong = (0xFFFFFFFF << (32 - mask)) >>> 0
    return (ipLong & maskLong) === (netLong & maskLong)
}
