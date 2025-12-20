import prisma from '../../utils/prisma'
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

    // Broadcast addresses to try - include common subnet broadcasts
    const broadcastAddresses = [
        '255.255.255.255',      // Global broadcast
        '192.168.1.255',        // Common home subnet
        '192.168.0.255',        // Common home subnet
        '10.0.0.255',           // Common private subnet
        '10.5.50.255',          // User's subnet
        '10.255.255.255',       // Class A broadcast
    ]

    // If device has an IP, calculate its subnet broadcast address
    if (device?.ip) {
        const ipParts = device.ip.split('.')
        if (ipParts.length === 4) {
            // Assume /24 subnet, replace last octet with 255
            const subnetBroadcast = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.255`
            if (!broadcastAddresses.includes(subnetBroadcast)) {
                broadcastAddresses.unshift(subnetBroadcast) // Add at the beginning
            }
        }
    }

    console.log(`[WoL] Sending magic packet to ${cleanMac} via broadcasts:`, broadcastAddresses)

    // Send packet via UDP broadcast to all addresses
    const sendPromises = broadcastAddresses.map(address => {
        return new Promise<void>((resolve) => {
            const socket = dgram.createSocket('udp4')

            socket.on('error', (err) => {
                console.log(`[WoL] Error sending to ${address}:`, err.message)
                socket.close()
                resolve() // Don't reject, just continue with other addresses
            })

            socket.bind(() => {
                socket.setBroadcast(true)

                // Send to port 9 (standard WoL port)
                socket.send(magicPacket, 0, magicPacket.length, 9, address, (err) => {
                    if (err) {
                        console.log(`[WoL] Failed to send to ${address}:`, err.message)
                    } else {
                        console.log(`[WoL] Successfully sent to ${address}`)
                    }

                    // Also try port 7 (alternate WoL port)
                    socket.send(magicPacket, 0, magicPacket.length, 7, address, () => {
                        socket.close()
                        resolve()
                    })
                })
            })
        })
    })

    await Promise.all(sendPromises)

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'WAKE_ON_LAN',
            target: device?.id || mac,
            details: { mac: cleanMac, deviceName: device?.name, broadcasts: broadcastAddresses.length },
            result: 'sent',
        },
    })

    return {
        success: true,
        message: `Wake-on-LAN packet sent to ${cleanMac} via ${broadcastAddresses.length} broadcast addresses`,
        device: device ? { id: device.id, name: device.name } : null,
    }
})

