/**
 * Remote Connection Manager
 * Tracks active SSH and VNC connections with max limit enforcement
 */

interface ActiveConnection {
    id: string
    type: 'ssh' | 'vnc'
    deviceId: string
    deviceName: string
    targetIp: string
    targetPort: number
    user: string
    startedAt: Date
    sessionId?: string // RemoteSession ID from database
}

class RemoteConnectionManager {
    private connections: Map<string, ActiveConnection> = new Map()
    private maxConnections: number = 5

    /**
     * Check if we can accept a new connection
     */
    canAccept(): boolean {
        return this.connections.size < this.maxConnections
    }

    /**
     * Get current connection count
     */
    getCount(): number {
        return this.connections.size
    }

    /**
     * Get max allowed connections
     */
    getMaxConnections(): number {
        return this.maxConnections
    }

    /**
     * Add a new connection
     */
    add(connection: ActiveConnection): boolean {
        if (!this.canAccept()) {
            return false
        }
        this.connections.set(connection.id, connection)
        console.log(`[RemoteManager] Connection added: ${connection.id} (${connection.type} to ${connection.targetIp}:${connection.targetPort})`)
        console.log(`[RemoteManager] Active connections: ${this.connections.size}/${this.maxConnections}`)
        return true
    }

    /**
     * Remove a connection
     */
    remove(connectionId: string): ActiveConnection | undefined {
        const connection = this.connections.get(connectionId)
        if (connection) {
            this.connections.delete(connectionId)
            console.log(`[RemoteManager] Connection removed: ${connectionId}`)
            console.log(`[RemoteManager] Active connections: ${this.connections.size}/${this.maxConnections}`)
        }
        return connection
    }

    /**
     * Get a connection by ID
     */
    get(connectionId: string): ActiveConnection | undefined {
        return this.connections.get(connectionId)
    }

    /**
     * Get all active connections
     */
    getAll(): ActiveConnection[] {
        return Array.from(this.connections.values())
    }

    /**
     * Get connections by device ID
     */
    getByDevice(deviceId: string): ActiveConnection[] {
        return this.getAll().filter(c => c.deviceId === deviceId)
    }

    /**
     * Get connections by type
     */
    getByType(type: 'ssh' | 'vnc'): ActiveConnection[] {
        return this.getAll().filter(c => c.type === type)
    }
}

// Singleton instance
export const remoteManager = new RemoteConnectionManager()
export type { ActiveConnection }
