import prisma from '../../utils/prisma'
import { pingHost } from '../../utils/discovery'

interface DeviceStatus {
    id: string
    status: 'ONLINE' | 'OFFLINE'
    lastSeen: string | null
    responseTime?: number
}

// GET /api/devices/stream - SSE endpoint for real-time device status
export default defineEventHandler((event) => {
    // Set SSE headers
    setHeader(event, 'Content-Type', 'text/event-stream')
    setHeader(event, 'Cache-Control', 'no-cache')
    setHeader(event, 'Connection', 'keep-alive')
    setHeader(event, 'Access-Control-Allow-Origin', '*')

    const response = event.node.res
    let isConnected = true
    let intervalId: ReturnType<typeof setInterval> | null = null
    let heartbeatId: ReturnType<typeof setInterval> | null = null

    // Handle client disconnect
    event.node.req.on('close', () => {
        isConnected = false
        if (intervalId) clearInterval(intervalId)
        if (heartbeatId) clearInterval(heartbeatId)
        console.log('[SSE] Client disconnected from device status stream')
    })

    console.log('[SSE] Client connected to device status stream')

    // Send device status updates
    const sendDeviceStatus = async () => {
        if (!isConnected) return

        try {
            // Get all devices with IP addresses
            const devices = await prisma.device.findMany({
                where: {
                    ip: { not: null },
                },
                select: {
                    id: true,
                    ip: true,
                    status: true,
                    lastSeen: true,
                },
            })

            // Ping all devices in parallel (with concurrency limit)
            const batchSize = 10
            const results: DeviceStatus[] = []

            for (let i = 0; i < devices.length; i += batchSize) {
                if (!isConnected) break

                const batch = devices.slice(i, i + batchSize)

                const batchResults = await Promise.all(
                    batch.map(async (device) => {
                        let status: 'ONLINE' | 'OFFLINE' = 'OFFLINE'
                        let responseTime: number | undefined

                        if (device.ip) {
                            try {
                                const result = await pingHost(device.ip, 2000)
                                status = result.alive ? 'ONLINE' : 'OFFLINE'
                                responseTime = result.responseTime
                            } catch {
                                status = 'OFFLINE'
                            }
                        }

                        // Update device status in database if changed
                        const now = new Date()
                        if (status !== device.status || status === 'ONLINE') {
                            try {
                                await prisma.device.update({
                                    where: { id: device.id },
                                    data: {
                                        status,
                                        lastSeen: status === 'ONLINE' ? now : device.lastSeen,
                                    },
                                })
                            } catch (e) {
                                // Ignore update errors
                            }
                        }

                        return {
                            id: device.id,
                            status,
                            lastSeen: status === 'ONLINE' ? now.toISOString() : device.lastSeen?.toISOString() ?? null,
                            responseTime,
                        }
                    })
                )

                results.push(...batchResults)
            }

            if (!isConnected) return

            // Send SSE event
            const data = {
                timestamp: new Date().toISOString(),
                devices: results,
                totalOnline: results.filter(d => d.status === 'ONLINE').length,
                totalOffline: results.filter(d => d.status === 'OFFLINE').length,
            }

            response.write(`event: deviceStatus\ndata: ${JSON.stringify(data)}\n\n`)

        } catch (error) {
            console.error('[SSE] Error fetching device status:', error)
            if (isConnected) {
                response.write(`event: error\ndata: ${JSON.stringify({ message: 'Failed to fetch status' })}\n\n`)
            }
        }
    }

    // Start sending data
    sendDeviceStatus()

    // Set up interval for continuous pinging (every 15 seconds)
    intervalId = setInterval(() => {
        if (!isConnected) {
            if (intervalId) clearInterval(intervalId)
            return
        }
        sendDeviceStatus()
    }, 15000)

    // Keep connection alive with heartbeat
    heartbeatId = setInterval(() => {
        if (!isConnected) {
            if (heartbeatId) clearInterval(heartbeatId)
            return
        }
        response.write(`: heartbeat\n\n`)
    }, 30000)

    // Return nothing - connection stays open
    event._handled = true
})
