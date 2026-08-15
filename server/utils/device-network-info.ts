/**
 * Syncs an agent-backed Device's network fields (ip, mac) from whatever the
 * agent last reported — called from both enroll.post.ts (once, at initial
 * enrollment) and connect.ts's hello handler (every reconnect, so it also
 * catches agents that were enrolled before mac reporting existed and just
 * got updated to a newer binary without re-enrolling).
 */
import prisma from './prisma'

export async function updateDeviceNetworkInfo(
    deviceId: string,
    fields: { name?: string; hostname?: string; ip?: string | null; mac?: string | null },
): Promise<void> {
    const mac = fields.mac?.trim().toLowerCase() || undefined
    const ip = fields.ip || undefined
    const data = { name: fields.name, hostname: fields.hostname, ip, mac }

    await prisma.device.update({ where: { id: deviceId }, data }).catch(async () => {
        // mac is unique — if another device already claims it (e.g. a stale
        // entry from network discovery for the same physical machine), retry
        // without it rather than losing the name/hostname/ip update too.
        if (!mac) return
        await prisma.device.update({
            where: { id: deviceId },
            data: { name: fields.name, hostname: fields.hostname, ip },
        }).catch(() => { /* device may have been deleted independently */ })
    })
}
