import prisma from '../../../utils/prisma'
import { createHikvisionClientById } from '../../../utils/hikvision'
import { enrichIpam } from '../../../utils/ipam-enrich'

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

        let ipamCreated = 0
        let ipamUpdated = 0
        let ipamSkipped = 0

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

            const result = await enrichIpam(
                device.siteId,
                ch.ipAddress,
                ch.macAddress,
                ch.name || `Channel ${ch.channelIndex}`,
            )
            if (result === 'created') ipamCreated++
            else if (result === 'updated') ipamUpdated++
            else if (result === 'skipped') ipamSkipped++
        }

        const nvrIpam = await enrichIpam(
            device.siteId,
            device.host,
            info.macAddress || device.macAddress,
            device.name,
        )
        if (nvrIpam === 'created') ipamCreated++
        else if (nvrIpam === 'updated') ipamUpdated++

        await prisma.auditLog.create({
            data: {
                actor: 'system',
                action: 'SYNC_HIKVISION',
                target: id,
                details: {
                    name: device.name,
                    host: device.host,
                    channelCount: channels.length,
                    ipamCreated,
                    ipamUpdated,
                    ipamSkipped,
                },
                result: 'success',
            },
        })

        return {
            success: true,
            info,
            channels: channels.length,
            ipam: { created: ipamCreated, updated: ipamUpdated, skipped: ipamSkipped },
            message: `Synced ${channels.length} channels from ${device.name} · IPAM +${ipamCreated} / updated ${ipamUpdated}`,
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
