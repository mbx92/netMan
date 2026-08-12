import prisma from '../../../utils/prisma'
import { resolveNasAdapter, defaultNasPort } from '../../../utils/nas-adapter'
import { normalizeNasModelId, resolveNasModel } from '../../../utils/nas-models'

// POST /api/nas/[id]/capture - Capture live data from NAS device
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'NAS device ID is required',
        })
    }

    const device = await prisma.nAS.findUnique({
        where: { id },
    })

    if (!device) {
        throw createError({
            statusCode: 404,
            statusMessage: 'NAS device not found',
        })
    }

    if (!device.type || !device.ipAddress) {
        throw createError({
            statusCode: 400,
            statusMessage: 'NAS type and IP address are required for capture',
        })
    }

    if (!device.username || !device.password) {
        throw createError({
            statusCode: 400,
            statusMessage: 'NAS credentials (username/password) are required for capture',
        })
    }

    const adapter = resolveNasAdapter(device.type)
    if (!adapter) {
        throw createError({
            statusCode: 400,
            statusMessage: `Unsupported NAS type: ${device.type}. Supported: Synology, QNAP`,
        })
    }

    const port = defaultNasPort(device.type)

    try {
        const snapshot = await adapter.capture(device.ipAddress, port, device.username, device.password)

        // Aggregate storage totals from volumes
        const totalBytes = snapshot.volumes.reduce((sum, v) => sum + v.totalBytes, 0)
        const usedBytes = snapshot.volumes.reduce((sum, v) => sum + v.usedBytes, 0)

        const detectedModel = normalizeNasModelId(snapshot.model)
        const known = resolveNasModel(detectedModel || device.model)
        if (detectedModel) snapshot.model = detectedModel

        const hddCount = snapshot.disks.filter(d => d.kind !== 'nvme').length
        const nextBayCount = (() => {
            const current = Number(device.bayCount)
            if (Number.isFinite(current) && current > 0) return current
            if (known?.bayCount) return known.bayCount
            if (hddCount > 0) return hddCount
            return undefined
        })()

        // Update NAS record with captured values, fetch updated with relations
        const updated = await prisma.nAS.update({
            where: { id },
            data: {
                totalCapacityGB: totalBytes > 0 ? Math.round(totalBytes / 1_073_741_824 * 100) / 100 : device.totalCapacityGB,
                usedCapacityGB: totalBytes > 0 ? Math.round(usedBytes / 1_073_741_824 * 100) / 100 : device.usedCapacityGB,
                lastCapturedAt: new Date(),
                lastSnapshot: snapshot as object,
                ...(detectedModel ? { model: detectedModel } : {}),
                ...(nextBayCount != null && nextBayCount !== device.bayCount ? { bayCount: nextBayCount } : {}),
            },
            include: { site: { select: { id: true, name: true } } },
        })

        // Strip password
        const { password: _, ...deviceSafe } = updated

        // Audit log
        await prisma.auditLog.create({
            data: {
                actor: 'system',
                action: 'CAPTURE_NAS',
                target: id,
                details: {
                    name: device.name,
                    host: device.ipAddress,
                    type: device.type,
                    model: detectedModel || device.model,
                    volumes: snapshot.volumes.length,
                    disks: snapshot.disks.length,
                },
                result: 'success',
            },
        })

        return {
            success: true,
            snapshot,
            updated: deviceSafe,
            summary: {
                volumes: snapshot.volumes.length,
                disks: snapshot.disks.length,
                storageTotalGB: totalBytes > 0 ? Math.round(totalBytes / 1_073_741_824 * 100) / 100 : 0,
                storageUsedGB: totalBytes > 0 ? Math.round(usedBytes / 1_073_741_824 * 100) / 100 : 0,
                storageFreeGB: totalBytes > 0 ? Math.round((totalBytes - usedBytes) / 1_073_741_824 * 100) / 100 : 0,
                model: detectedModel || device.model,
            },
            capturedAt: new Date().toISOString(),
        }
    } catch (error) {
        console.error(`[NAS Capture] Failed for ${device.name} (${device.type}):`, error)

        // Audit log failure
        await prisma.auditLog.create({
            data: {
                actor: 'system',
                action: 'CAPTURE_NAS',
                target: id,
                details: {
                    name: device.name,
                    host: device.ipAddress,
                    type: device.type,
                    error: (error as Error).message,
                },
                result: 'failure',
            },
        })

        throw createError({
            statusCode: 502,
            statusMessage: `Failed to capture data from ${device.name}: ${String((error as Error).message || error).replace(device.password || '', '***')}`,
        })
    }
})
