/**
 * Relays bytes between code that only knows how to `net.Socket.connect(host, port)`
 * (ssh2, noVNC's raw TCP passthrough) and a machine that isn't directly
 * reachable — because it's behind NAT and only reachable via its agent's
 * outbound WebSocket (see server/api/agents/connect.ts).
 *
 * Mechanism: for each session, open a real local TCP listener on
 * 127.0.0.1:<ephemeral port> and hand that loopback address to the caller
 * exactly like it hands the real device IP today. The first (and only)
 * socket that connects to that listener is paused immediately and only
 * resumed once the agent confirms (`tunnel-ready`) it has dialed its own
 * loopback SSH/VNC port — this avoids a race between ssh2/noVNC dialing in
 * and the agent's tunnel actually being ready. From then on, bytes are
 * shuttled 1:1 between that local socket and channelId-tagged binary frames
 * on the agent's single persistent WebSocket (multiple tunnels to the same
 * agent share that one connection, demuxed by channelId).
 *
 * The server only ever tells the agent a *symbolic* target ("ssh" / "vnc"),
 * never an arbitrary host:port — the agent maps that itself to a hardcoded
 * loopback port. This is the least-privilege boundary that stops a
 * compromised netMan server from turning agents into an open relay into
 * whatever network they sit on.
 */
import { randomInt } from 'node:crypto'
import { createServer, type Socket } from 'node:net'
import { agentManager } from './agent-manager'

export type TunnelTarget = 'ssh' | 'vnc'

interface TunnelChannel {
    channelId: number
    agentId: string
    localSocket: Socket | null
    ready: boolean
    onReady: (() => void) | null
}

const channels = new Map<number, TunnelChannel>()

export interface OpenTunnelResult {
    localPort: number
    close: () => void
}

export function openTunnel(agentId: string, target: TunnelTarget): Promise<OpenTunnelResult> {
    const connected = agentManager.get(agentId)
    if (!connected) {
        return Promise.reject(new Error('Agent is not connected'))
    }

    return new Promise((resolve, reject) => {
        const channelId = randomInt(1, 2 ** 31)
        const server = createServer()

        server.once('error', (err) => {
            channels.delete(channelId)
            reject(err)
        })

        server.once('connection', (socket) => {
            // Backpressure the first byte until the agent's own loopback dial is ready.
            socket.pause()
            const channel = channels.get(channelId)
            if (!channel) {
                socket.destroy()
                return
            }
            channel.localSocket = socket

            socket.on('data', (chunk) => sendTunnelData(connected.peer, channelId, chunk))
            socket.on('close', () => closeChannel(channelId))
            socket.on('error', () => socket.destroy())

            if (channel.ready) socket.resume()
            else channel.onReady = () => socket.resume()
        })

        // ssh2 / the VNC dial each open exactly one connection per session.
        server.maxConnections = 1

        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            if (!address || typeof address === 'string') {
                server.close()
                channels.delete(channelId)
                reject(new Error('Failed to allocate local relay port'))
                return
            }

            channels.set(channelId, { channelId, agentId, localSocket: null, ready: false, onReady: null })
            sendControl(connected.peer, { type: 'tunnel-open', channelId, target })

            resolve({
                localPort: address.port,
                close: () => {
                    closeChannel(channelId)
                    server.close()
                },
            })
        })
    })
}

/** Called by agents/connect.ts when the agent sends a tunnel-ready/tunnel-error/tunnel-close control frame. */
export function handleTunnelControl(agentId: string, msg: { type: string; channelId: number; message?: string }) {
    const channel = channels.get(msg.channelId)
    if (!channel || channel.agentId !== agentId) return

    if (msg.type === 'tunnel-ready') {
        channel.ready = true
        channel.onReady?.()
        channel.onReady = null
    } else if (msg.type === 'tunnel-error' || msg.type === 'tunnel-close') {
        if (msg.type === 'tunnel-error') {
            console.error(`[AgentTunnel] Agent reported tunnel error for channel ${msg.channelId}: ${msg.message}`)
        }
        destroySocket(channel.localSocket)
        channels.delete(msg.channelId)
    }
}

/** Called by agents/connect.ts for binary frames — payload flowing agent -> local socket. */
export function handleTunnelData(agentId: string, channelId: number, data: Buffer) {
    const channel = channels.get(channelId)
    if (!channel || channel.agentId !== agentId || !channel.localSocket) return
    channel.localSocket.write(data)
}

/** Called when an agent's WebSocket drops (clean close or offline-watcher sweep) — orphaned tunnels must not leak. */
export function closeAllForAgent(agentId: string) {
    for (const [channelId, channel] of channels) {
        if (channel.agentId === agentId) {
            channels.delete(channelId)
            destroySocket(channel.localSocket)
        }
    }
}

function closeChannel(channelId: number) {
    const channel = channels.get(channelId)
    if (!channel) return
    channels.delete(channelId)
    destroySocket(channel.localSocket)
    const connected = agentManager.get(channel.agentId)
    if (connected) sendControl(connected.peer, { type: 'tunnel-close', channelId })
}

// Forcibly destroying a socket that a consumer library (ssh2, noVNC's raw
// passthrough) is actively using can surface as an error on that consumer's
// side on a later tick — outside any try/catch around this call. A one-time
// no-op 'error' listener here is cheap insurance against this specific
// socket re-emitting something we're not set up to observe/care about
// (the consumer library has its own error handling for the connection it's
// actually driving).
function destroySocket(socket: Socket | null | undefined) {
    if (!socket) return
    socket.once('error', () => { })
    socket.destroy()
}

function sendControl(peer: any, msg: Record<string, unknown>) {
    try { peer.send(JSON.stringify(msg)) } catch { }
}

function sendTunnelData(peer: any, channelId: number, chunk: Buffer) {
    const header = Buffer.alloc(4)
    header.writeUInt32BE(channelId, 0)
    try { peer.send(Buffer.concat([header, chunk])) } catch { }
}
