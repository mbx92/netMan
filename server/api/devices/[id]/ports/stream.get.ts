import prisma, { withPrismaRetry } from '../../../../utils/prisma'
import { agentReachability } from '../../../../utils/device-presence'

// GET /api/devices/[id]/ports/stream - SSE of connected-device agent presence (no ICMP).
export default defineEventHandler((event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Device ID is required',
        })
    }

    setHeader(event, 'Content-Type', 'text/event-stream')
    setHeader(event, 'Cache-Control', 'no-cache')
    setHeader(event, 'Connection', 'keep-alive')
    setHeader(event, 'Access-Control-Allow-Origin', '*')

    const response = event.node.res
    let isConnected = true
    let intervalId: ReturnType<typeof setInterval> | null = null
    let heartbeatId: ReturnType<typeof setInterval> | null = null

    event.node.req.on('close', () => {
        isConnected = false
        if (intervalId) clearInterval(intervalId)
        if (heartbeatId) clearInterval(heartbeatId)
        console.log(`[SSE] Client disconnected from port stream for device ${id}`)
    })

    console.log(`[SSE] Client connected to port stream for device ${id}`)

    const sendPortStatus = async () => {
        if (!isConnected) return

        try {
            const device = await withPrismaRetry(() =>
                prisma.device.findUnique({
                    where: { id },
                    include: {
                        ports: {
                            include: {
                                connectedDevice: {
                                    select: {
                                        id: true,
                                        name: true,
                                        ip: true,
                                        typeCode: true,
                                        status: true,
                                        agent: { select: { id: true, status: true } },
                                    },
                                },
                            },
                            orderBy: { portNumber: 'asc' },
                        },
                    },
                }),
            )

            if (!device) {
                response.write(`event: error\ndata: ${JSON.stringify({ message: 'Device not found' })}\n\n`)
                return
            }

            const portsWithStatus = device.ports.map((port) => ({
                id: port.id,
                portNumber: port.portNumber,
                portName: port.portName,
                connectedDeviceId: port.connectedDeviceId,
                connectedDeviceName: port.connectedDevice?.name,
                connectedDeviceIp: port.connectedDevice?.ip,
                pingStatus: agentReachability(port.connectedDevice?.agent),
            }))

            if (!isConnected) return

            response.write(`event: portStatus\ndata: ${JSON.stringify({
                timestamp: new Date().toISOString(),
                deviceId: id,
                ports: portsWithStatus,
            })}\n\n`)
        } catch (error) {
            console.error('[SSE] Error fetching port status:', error)
            if (isConnected) {
                response.write(`event: error\ndata: ${JSON.stringify({ message: 'Failed to fetch status' })}\n\n`)
            }
        }
    }

    sendPortStatus()

    intervalId = setInterval(() => {
        if (!isConnected) {
            if (intervalId) clearInterval(intervalId)
            return
        }
        sendPortStatus()
    }, 5000)

    heartbeatId = setInterval(() => {
        if (!isConnected) {
            if (heartbeatId) clearInterval(heartbeatId)
            return
        }
        response.write(`: heartbeat\n\n`)
    }, 30000)

    event._handled = true
})
