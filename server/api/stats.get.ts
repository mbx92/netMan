import prisma from '../utils/prisma'

// GET /api/stats - Dashboard statistics
export default defineEventHandler(async () => {
    // Get device counts by status
    const statusCounts = await prisma.device.groupBy({
        by: ['status'],
        _count: { id: true },
    })

    // Get device counts by type
    const typeCounts = await prisma.device.groupBy({
        by: ['typeCode'],
        _count: { id: true },
    })

    // Get total counts
    const totalDevices = await prisma.device.count()
    const totalPorts = await prisma.networkPort.count()
    const totalSessions = await prisma.remoteSession.count()

    // Get recent activity
    const recentLogs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
    })

    // Get recent offline devices
    const recentOffline = await prisma.device.findMany({
        where: { status: 'OFFLINE' },
        orderBy: { lastSeen: 'desc' },
        take: 5,
        select: {
            id: true,
            name: true,
            typeCode: true,
            ip: true,
            lastSeen: true,
        },
    })

    // Format status counts into object
    const byStatus = Object.fromEntries(
        statusCounts.map((s) => [s.status, s._count.id])
    )

    // Format type counts into object
    const byType = Object.fromEntries(
        typeCounts.map((t) => [t.typeCode, t._count.id])
    )

    return {
        totals: {
            devices: totalDevices,
            ports: totalPorts,
            sessions: totalSessions,
            online: byStatus['ONLINE'] || 0,
            offline: byStatus['OFFLINE'] || 0,
            unknown: byStatus['UNKNOWN'] || 0,
            maintenance: byStatus['MAINTENANCE'] || 0,
        },
        byStatus,
        byType,
        recentLogs,
        recentOffline,
    }
})
