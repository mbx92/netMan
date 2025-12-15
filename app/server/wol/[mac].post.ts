import prisma from '~/server/utils/prisma'
import dgram from 'dgram'

// POST /api/wol/[mac] - Send Wake-on-LAN magic packet
export default defineEventHandler(async (event) => {
    const mac = getRouterParam(event, 'mac')

    if (!mac) {
        throw createError({
            statusCode: 400,
            statusMessage: 'MAC address is required',
        })
    }

    // Normalize MAC address
    const cleanMac = mac.toLowerCase().replace(/[:-]/g, '')

    if (!/^[0-9a-f]{12}$/.test(cleanMac)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid MAC address format',
        })
    }

    // Find device by MAC
    const device = await prisma.device.findFirst({
        where: {
            OR: [
                { mac: cleanMac },
                { mac: mac },
            ]
        }
    })

    if (device && !device.wakeable) {
        throw createError({
            statusCode: 400,
            statusMessage: 'This device is not marked as WoL-capable',
        })
    }

    // Create magic packet
    const macBytes = Buffer.from(cleanMac, 'hex')
    const magicPacket = Buffer.alloc(102)

    // 6 bytes of 0xFF
    for (let i = 0; i < 6; i++) {
        magicPacket[i] = 0xff
    }

    // 16 repetitions of MAC address
    for (let i = 0; i < 16; i++) {
        macBytes.copy(magicPacket, 6 + i * 6)
    }

    // Send packet via UDP broadcast
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket('udp4')

        socket.on('error', (err) => {
            socket.close()
            reject(createError({
                statusCode: 500,
                statusMessage: `Failed to send WoL packet: ${err.message}`,
            }))
        })

        socket.bind(() => {
            socket.setBroadcast(true)
            socket.send(magicPacket, 0, magicPacket.length, 9, '255.255.255.255', async (err) => {
                socket.close()

                if (err) {
                    reject(createError({
                        statusCode: 500,
                        statusMessage: `Failed to send WoL packet: ${err.message}`,
                    }))
                    return
                }

                // Log the action
                await prisma.auditLog.create({
                    data: {
                        actor: 'system', // TODO: Replace with actual user
                        action: 'WAKE_ON_LAN',
                        target: device?.id || mac,
                        details: { mac: cleanMac, deviceName: device?.name },
                        result: 'sent',
                    },
                })

                resolve({
                    success: true,
                    message: `Wake-on-LAN packet sent to ${cleanMac}`,
                    device: device ? { id: device.id, name: device.name } : null,
                })
            })
        })
    })
})
