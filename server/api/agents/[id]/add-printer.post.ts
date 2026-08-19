import prisma from '../../../utils/prisma'

function looksLikeIp(host: string): boolean {
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true
    return host.includes(':') && !host.includes(' ')
}

function listedNetworkPrinter(printerInfo: unknown, name: string, host: string): boolean {
    if (!Array.isArray(printerInfo)) return false
    return printerInfo.some((p: { name?: string; host?: string; network?: boolean }) => {
        const match = (p.host && p.host === host) || (p.name && p.name === name)
        return match && !!(p.network || p.host)
    })
}

// POST /api/agents/:id/add-printer — create a PRINTER device from a network queue
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const body = await readBody<{ name?: string; host?: string }>(event)
    const host = body.host?.trim()
    const name = body.name?.trim()
    if (!id || !host || !name) {
        throw createError({ statusCode: 400, statusMessage: 'Printer name and host are required' })
    }

    const agent = await prisma.agent.findUnique({
        where: { id },
        include: { device: { select: { siteId: true } } },
    })
    if (!agent) throw createError({ statusCode: 404, statusMessage: 'Agent not found' })

    if (!listedNetworkPrinter(agent.printerInfo, name, host)) {
        throw createError({ statusCode: 400, statusMessage: 'Not a network printer on this agent' })
    }

    const existing = await prisma.device.findFirst({
        where: { OR: [{ ip: host }, { hostname: host }] },
        select: { id: true, name: true },
    })
    if (existing) {
        return { device: existing, created: false }
    }

    const asIp = looksLikeIp(host)
    const device = await prisma.device.create({
        data: {
            name,
            typeCode: 'PRINTER',
            ip: asIp ? host : undefined,
            hostname: asIp ? undefined : host,
            siteId: agent.device?.siteId || undefined,
            status: 'UNKNOWN',
            isManaged: true,
            notes: `Added from agent ${agent.hostname}`,
        },
        select: { id: true, name: true },
    })

    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'CREATE_DEVICE',
            target: device.id,
            details: { name: device.name, typeCode: 'PRINTER', fromAgentId: agent.id },
            result: 'success',
        },
    })

    return { device, created: true }
})
