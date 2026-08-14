import prisma from '../../../utils/prisma'
import { getMikroTikClientById, type HotspotBindingType } from '../../../utils/mikrotik'

interface CreateHotspotBindingBody {
    address: string
    mac?: string
    type?: HotspotBindingType
    toAddress?: string
    server?: string
    comment?: string
}

const VALID_TYPES: HotspotBindingType[] = ['bypassed', 'regular', 'blocked']
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/

// POST /api/mikrotik/[id]/hotspot-bindings - Add a hotspot IP binding (e.g. bypass IP for a known device)
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'MikroTik device ID is required',
        })
    }

    const body = await readBody<CreateHotspotBindingBody>(event)

    if (!body.address || !IPV4_RE.test(body.address)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'A valid IPv4 address is required',
        })
    }

    if (body.type && !VALID_TYPES.includes(body.type)) {
        throw createError({
            statusCode: 400,
            statusMessage: `Type must be one of: ${VALID_TYPES.join(', ')}`,
        })
    }

    const device = await prisma.mikrotikDevice.findUnique({ where: { id } })
    if (!device) {
        throw createError({
            statusCode: 404,
            statusMessage: 'MikroTik device not found',
        })
    }

    const client = await getMikroTikClientById(id)
    if (!client) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to create MikroTik client',
        })
    }

    try {
        const binding = await client.addHotspotIpBinding({
            address: body.address,
            mac: body.mac || undefined,
            type: body.type || 'bypassed',
            toAddress: body.toAddress || undefined,
            server: body.server || undefined,
            comment: body.comment || undefined,
        })

        await prisma.auditLog.create({
            data: {
                actor: 'system',
                action: 'ADD_HOTSPOT_IP_BINDING',
                target: id,
                details: { name: device.name, address: body.address, mac: body.mac, type: binding.type },
                result: 'success',
            },
        })

        return { success: true, binding }
    } catch (error) {
        await prisma.auditLog.create({
            data: {
                actor: 'system',
                action: 'ADD_HOTSPOT_IP_BINDING',
                target: id,
                details: { name: device.name, address: body.address, error: (error as Error).message },
                result: 'failed',
            },
        })
        throw createError({
            statusCode: 502,
            statusMessage: `Failed to add hotspot IP binding: ${(error as Error).message}`,
        })
    }
})
