import prisma from '../../../../utils/prisma'
import { pingHost } from '../../../../utils/discovery'

// GET /api/devices/[id]/ports/stream - SSE endpoint for real-time port status
export default defineEventHandler((event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Device ID is required',
        })
    }

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
        console.log(`[SSE] Client disconnected from port stream for device ${id}`)
    })

    console.log(`[SSE] Client connected to port stream for device ${id}`)

    // Send port status updates
    const sendPortStatus = async () => {
        if (!isConnected) return

        try {
            // Get device with ports
            const device = await prisma.device.findUnique({
                where: { id },
                include: {
                    ports: {
                        include: {
                            connectedDevice: {
                                select: {
                                    id: true,
                                    name: true,
                                    ip: true,
                                    type: true,
                                    status: true,
                                },
                            },
                        },
                        orderBy: { portNumber: 'asc' },
                    },
                },
            })

            if (!device) {
                response.write(`event: error\ndata: ${JSON.stringify({ message: 'Device not found' })}\n\n`)
                return
            }

            // Ping all connected devices in parallel
            const portsWithStatus = await Promise.all(
                device.ports.map(async (port) => {
                    let pingStatus: 'online' | 'offline' | 'unknown' = 'unknown'
                    let responseTime: number | undefined

                    if (port.connectedDevice?.ip) {
                        try {
                            const result = await pingHost(port.connectedDevice.ip, 2000)
                            pingStatus = result.alive ? 'online' : 'offline'
                            responseTime = result.responseTime
                        } catch {
                            pingStatus = 'offline'
                        }
                    }

                    return {
                        id: port.id,
                        portNumber: port.portNumber,
                        portName: port.portName,
                        connectedDeviceId: port.connectedDeviceId,
                        connectedDeviceName: port.connectedDevice?.name,
                        connectedDeviceIp: port.connectedDevice?.ip,
                        pingStatus,
                        responseTime,
                    }
                })
            )

            if (!isConnected) return

            // Send SSE event
            const data = {
                timestamp: new Date().toISOString(),
                deviceId: id,
                ports: portsWithStatus,
            }

            response.write(`event: portStatus\ndata: ${JSON.stringify(data)}\n\n`)

        } catch (error) {
            console.error('[SSE] Error fetching port status:', error)
            if (isConnected) {
                response.write(`event: error\ndata: ${JSON.stringify({ message: 'Failed to fetch status' })}\n\n`)
            }
        }
    }

    // Start sending data
    sendPortStatus()

    // Set up interval for continuous pinging (every 10 seconds)
    intervalId = setInterval(() => {
        if (!isConnected) {
            if (intervalId) clearInterval(intervalId)
            return
        }
        sendPortStatus()
    }, 10000)

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
