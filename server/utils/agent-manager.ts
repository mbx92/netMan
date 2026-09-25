/**
 * Agent Connection Manager
 * Tracks which enrolled agents currently have a live outbound WebSocket
 * connection to this server, and the crossws `Peer` used to send them
 * messages (heartbeat acks now; tunnel-open/tunnel-data control frames in a
 * later phase). Modeled on remote-manager.ts's in-memory registry.
 */

interface ConnectedAgent {
    agentId: string
    peer: any
    hostname: string
    platform: 'WINDOWS' | 'LINUX' | 'MACOS'
    deviceId: string | null
    connectedAt: Date
    lastHeartbeatAt: Date
}

class AgentConnectionManager {
    private byAgentId: Map<string, ConnectedAgent> = new Map()
    private peerIdToAgentId: Map<string, string> = new Map()

    register(agentId: string, peer: any, meta: { hostname: string; platform: 'WINDOWS' | 'LINUX' | 'MACOS'; deviceId?: string | null }): void {
        const previous = this.byAgentId.get(agentId)
        if (previous && previous.peer.id !== peer.id) {
            // Remove ownership before closing the old socket. Its delayed close
            // event must not unregister or mark the replacement socket offline.
            this.peerIdToAgentId.delete(previous.peer.id)
            try { previous.peer.close() } catch { }
            console.log(`[AgentManager] Replaced stale connection for agent ${agentId}: ${previous.peer.id} -> ${peer.id}`)
        }

        const now = new Date()
        this.byAgentId.set(agentId, {
            agentId,
            peer,
            hostname: meta.hostname,
            platform: meta.platform,
            deviceId: meta.deviceId ?? null,
            connectedAt: now,
            lastHeartbeatAt: now,
        })
        this.peerIdToAgentId.set(peer.id, agentId)
        console.log(`[AgentManager] Registered agent ${agentId} (${meta.hostname}). Online: ${this.byAgentId.size}`)
    }

    unregisterByPeerId(peerId: string): string | undefined {
        const agentId = this.peerIdToAgentId.get(peerId)
        if (!agentId) return undefined
        this.peerIdToAgentId.delete(peerId)

        const current = this.byAgentId.get(agentId)
        if (!current || current.peer.id !== peerId) {
            // A newer connection already owns this agent. Ignore the stale
            // socket's close/error event instead of tearing down the new one.
            return undefined
        }
        this.byAgentId.delete(agentId)
        console.log(`[AgentManager] Unregistered agent ${agentId}. Online: ${this.byAgentId.size}`)
        return agentId
    }

    markHeartbeat(peerId: string): ConnectedAgent | undefined {
        const connected = this.getByPeerId(peerId)
        if (!connected || connected.peer.id !== peerId) return undefined
        connected.lastHeartbeatAt = new Date()
        return connected
    }

    /** Force-drops a stale registration (e.g. heartbeat timeout with no clean WS close). */
    unregisterByAgentId(agentId: string): void {
        const entry = this.byAgentId.get(agentId)
        if (!entry) return
        this.peerIdToAgentId.delete(entry.peer.id)
        this.byAgentId.delete(agentId)
        try { entry.peer.close() } catch { }
        console.log(`[AgentManager] Force-unregistered stale agent ${agentId}. Online: ${this.byAgentId.size}`)
    }

    get(agentId: string): ConnectedAgent | undefined {
        return this.byAgentId.get(agentId)
    }

    getByPeerId(peerId: string): ConnectedAgent | undefined {
        const agentId = this.peerIdToAgentId.get(peerId)
        return agentId ? this.byAgentId.get(agentId) : undefined
    }

    isOnline(agentId: string): boolean {
        return this.byAgentId.has(agentId)
    }

    getAll(): ConnectedAgent[] {
        return Array.from(this.byAgentId.values())
    }
}

// Singleton instance
export const agentManager = new AgentConnectionManager()
export type { ConnectedAgent }
