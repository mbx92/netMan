/**
 * Guacamole VNC WebSocket Proxy
 * Bridges WebSocket from browser to guacd daemon
 * Uses raw TCP socket for guacd communication with Guacamole protocol
 */
import { Socket } from 'net'
import { remoteManager } from '../../utils/remote-manager'
import prisma from '../../utils/prisma'

export default defineWebSocketHandler({
    async open(peer) {
        console.log(`[Guacamole] WebSocket opened: ${peer.id}`)
        console.log(`[Guacamole] peer.request.url:`, peer.request?.url)

        // Get connection params from URL
        const url = new URL(peer.request?.url || '', 'http://localhost')
        console.log(`[Guacamole] Parsed URL object:`, url.href)
        console.log(`[Guacamole] Search params:`, url.search)

        const host = url.searchParams.get('host')
        const port = parseInt(url.searchParams.get('port') || '5900', 10)
        const deviceId = url.searchParams.get('deviceId')
        const password = url.searchParams.get('password') || ''

        console.log('[Guacamole] Extracted values:')
        console.log('  - host:', JSON.stringify(host))
        console.log('  - port:', port)
        console.log('  - deviceId:', JSON.stringify(deviceId))
        console.log('  - password:', JSON.stringify(password))

        if (!host || !deviceId) {
            console.log('[Guacamole] Missing host or deviceId')
            peer.send('0.,10.disconnect;')
            return
        }

        await startGuacConnection(peer, { host, port, deviceId, password })
    },

    async message(peer, rawMessage) {
        // Forward Guacamole protocol messages from client to guacd
        const socket = guacdSockets.get(peer.id)
        if (socket && socket.writable) {
            const message = typeof rawMessage === 'string' ? rawMessage : rawMessage.text()
            socket.write(message)
        }
    },

    close(peer) {
        console.log(`[Guacamole] WebSocket closed:`, peer.id)
        cleanup(peer.id)
    },

    error(peer, error) {
        console.error(`[Guacamole] WebSocket error:`, error)
        cleanup(peer.id)
    }
})

// Store TCP sockets to guacd by peer ID
const guacdSockets = new Map<string, Socket>()

interface ConnectionParams {
    host: string
    port: number
    deviceId: string
    password: string
}

async function startGuacConnection(peer: any, params: ConnectionParams) {
    const { host, port, deviceId, password } = params

    console.log(`[Guacamole] Connecting to guacd for VNC ${host}:${port}`)

    // Check connection limit 
    if (!remoteManager.canAccept()) {
        peer.send('0.,10.disconnect;')
        return
    }

    // Get device info
    let deviceName = 'Unknown'
    try {
        const device = await prisma.device.findUnique({
            where: { id: deviceId },
            select: { name: true }
        })
        if (device) deviceName = device.name
    } catch (e) {
        console.error('[Guacamole] Failed to get device info:', e)
    }

    const connectionId = `guac-vnc-${peer.id}`

    // Connect to guacd daemon (localhost:4822)
    const socket = new Socket()
    guacdSockets.set(peer.id, socket)

    socket.connect(4822, '127.0.0.1', () => {
        console.log('[Guacamole] Connected to guacd daemon')

        // Send select instruction to choose VNC protocol
        const selectInstruction = `6.select,3.vnc;`
        console.log('[Guacamole] Sending select instruction:', selectInstruction)
        socket.write(selectInstruction)

        // Wait for 'args' response from guacd before sending connect
        let receivedData = ''
        let argsReceived = false

        const dataHandler = (data: Buffer) => {
            receivedData += data.toString('utf8')
            console.log('[Guacamole] Received from guacd:', receivedData.substring(0, 200))

            // Check if we received 'args' instruction
            if (!argsReceived && receivedData.includes('4.args')) {
                argsReceived = true
                console.log('[Guacamole] Received args instruction, sending connect...')

                // Send connect with just 3 parameters like test-guacd.mjs that works
                // Don't parse all args - just send hostname, port, password
                console.log('[Guacamole] About to build connectArgs with:')
                console.log('  - host:', JSON.stringify(host))
                console.log('  - port:', port)
                console.log('  - password:', JSON.stringify(password))

                const connectArgs = [
                    host,
                    port.toString(),
                    password || ''
                ]

                console.log('[Guacamole] connectArgs array:', connectArgs.map(v => JSON.stringify(v)))

                const connectParts = connectArgs.map(val => `${val.length}.${val}`).join(',')
                const connectInstruction = `7.connect,${connectParts};`

                console.log('[Guacamole] Sending connect:', connectInstruction)
                socket.write(connectInstruction)

                // Remove this handler and set up the main data forwarding
                socket.off('data', dataHandler)
                socket.on('data', (data: Buffer) => {
                    try {
                        const text = data.toString('utf8')
                        peer.send(text)
                    } catch (e) {
                        console.error('[Guacamole] Failed to send to WebSocket:', e)
                    }
                })
            }
        }

        socket.on('data', dataHandler)
    })

    socket.on('error', (err) => {
        console.error('[Guacamole] guacd socket error:', err.message)
        try {
            peer.send(`0.,10.disconnect;`)
        } catch { }
        cleanup(peer.id, connectionId)
    })

    socket.on('close', () => {
        console.log('[Guacamole] guacd socket closed')
        cleanup(peer.id, connectionId)
    })

    // Register connection
    remoteManager.add({
        id: connectionId,
        type: 'vnc',
        deviceId,
        deviceName,
        targetIp: host,
        targetPort: port,
        user: 'guac-user',
        startedAt: new Date()
    })
}

function cleanup(peerId: string, connectionId?: string) {
    const socket = guacdSockets.get(peerId)
    if (socket) {
        try {
            socket.destroy()
        } catch (e) {
            console.error('[Guacamole] Error closing socket:', e)
        }
        guacdSockets.delete(peerId)
    }

    if (connectionId) {
        remoteManager.remove(connectionId)
    }
}
