import prisma, { withPrismaRetry } from '../../utils/prisma'
import { loadConfigManagedHosts, resolveDeviceStatus } from '../../utils/device-presence'

interface DeviceStatus {
    id: string
    status: string
    lastSeen: string | null
}

// GET /api/devices/stream - SSE of agent-backed device presence (no ICMP).
export default defineEventHandler((event) => {
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
        console.log('[SSE] Client disconnected from device status stream')
    })

    console.log('[SSE] Client connected to device status stream')

    const sendDeviceStatus = async () => {
        if (!isConnected) return

        try {
            const [devices, configHosts] = await Promise.all([
                withPrismaRetry(() =>
                    prisma.device.findMany({
                        select: {
                            id: true,
                            ip: true,
                            isApiActive: true,
                            status: true,
                            lastSeen: true,
                            agent: { select: { id: true, status: true } },
                        },
                    }),
                ),
                loadConfigManagedHosts(),
            ])

            const now = new Date()
            const results: DeviceStatus[] = []

            for (const device of devices) {
                if (!isConnected) break

                const status = resolveDeviceStatus({
                    status: device.status,
                    agent: device.agent,
                    isApiActive: device.isApiActive,
                    ip: device.ip,
                    configHosts,
                })
                const lastSeen = status === 'ONLINE' && device.agent ? now : device.lastSeen

                if (device.agent && status !== device.status) {
                    await prisma.device.update({
                        where: { id: device.id },
                        data: {
                            status: status as 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'MAINTENANCE',
                            lastSeen: status === 'ONLINE' ? now : device.lastSeen,
                        },
                    }).catch(() => { })
                }

                results.push({
                    id: device.id,
                    status,
                    lastSeen: lastSeen ? lastSeen.toISOString() : null,
                })
            }

            if (!isConnected) return

            response.write(`event: deviceStatus\ndata: ${JSON.stringify({
                timestamp: now.toISOString(),
                devices: results,
                totalOnline: results.filter(d => d.status === 'ONLINE').length,
                totalOffline: results.filter(d => d.status === 'OFFLINE').length,
            })}\n\n`)
        } catch (error) {
            console.error('[SSE] Error fetching device status:', error)
            if (isConnected) {
                response.write(`event: error\ndata: ${JSON.stringify({ message: 'Failed to fetch status' })}\n\n`)
            }
        }
    }

    sendDeviceStatus()

    intervalId = setInterval(() => {
        if (!isConnected) {
            if (intervalId) clearInterval(intervalId)
            return
        }
        sendDeviceStatus()
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
