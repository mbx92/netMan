/**
 * Get active remote connections status
 */
import { remoteManager } from '../../utils/remote-manager'

export default defineEventHandler(() => {
    const connections = remoteManager.getAll()

    return {
        count: remoteManager.getCount(),
        max: remoteManager.getMaxConnections(),
        canAccept: remoteManager.canAccept(),
        connections: connections.map(c => ({
            id: c.id,
            type: c.type,
            deviceId: c.deviceId,
            deviceName: c.deviceName,
            targetIp: c.targetIp,
            targetPort: c.targetPort,
            user: c.user,
            startedAt: c.startedAt.toISOString(),
            duration: Math.floor((Date.now() - c.startedAt.getTime()) / 1000)
        }))
    }
})
