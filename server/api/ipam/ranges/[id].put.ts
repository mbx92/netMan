import prisma from '../../../utils/prisma'

// PUT /api/ipam/ranges/[id] - Update IP range
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const body = await readBody(event)

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Range ID is required',
        })
    }

    // Check range exists
    const existing = await prisma.iPRange.findUnique({
        where: { id }
    })

    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'IP range not found',
        })
    }

    // Validate network format if provided
    if (body.network) {
        const networkRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
        if (!networkRegex.test(body.network)) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Invalid network format. Use CIDR notation (e.g., 192.168.1.0/24)',
            })
        }

        // Check for duplicate network if changed
        if (body.network !== existing.network || body.siteId !== existing.siteId) {
            const duplicate = await prisma.iPRange.findFirst({
                where: {
                    network: body.network,
                    siteId: body.siteId ?? existing.siteId,
                    id: { not: id }
                }
            })
            if (duplicate) {
                throw createError({
                    statusCode: 409,
                    statusMessage: 'This network already exists in the same site',
                })
            }
        }
    }

    // Validate site exists if provided
    if (body.siteId) {
        const site = await prisma.site.findUnique({
            where: { id: body.siteId }
        })
        if (!site) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Site not found',
            })
        }
    }

    const range = await prisma.iPRange.update({
        where: { id },
        data: {
            name: body.name ?? existing.name,
            network: body.network ?? existing.network,
            gateway: body.gateway !== undefined ? body.gateway : existing.gateway,
            vlan: body.vlan !== undefined ? body.vlan : existing.vlan,
            description: body.description !== undefined ? body.description : existing.description,
            siteId: body.siteId !== undefined ? (body.siteId || null) : existing.siteId,
        },
        include: {
            site: {
                select: { id: true, name: true }
            }
        }
    })

    return {
        success: true,
        message: `IP range ${range.name} updated successfully`,
        range,
    }
})
