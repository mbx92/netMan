import prisma from '../../../utils/prisma'

// POST /api/ipam/ranges - Create new IP range
export default defineEventHandler(async (event) => {
    const body = await readBody(event)

    // Validate required fields
    if (!body.name || !body.network) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Name and network are required',
        })
    }

    // Validate network format (CIDR notation)
    const networkRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    if (!networkRegex.test(body.network)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid network format. Use CIDR notation (e.g., 192.168.1.0/24)',
        })
    }

    // Check for duplicate network in same site
    const existing = await prisma.iPRange.findFirst({
        where: {
            network: body.network,
            siteId: body.siteId || null,
        }
    })

    if (existing) {
        throw createError({
            statusCode: 409,
            statusMessage: 'This network already exists in the same site',
        })
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

    const range = await prisma.iPRange.create({
        data: {
            name: body.name,
            network: body.network,
            gateway: body.gateway || null,
            vlan: body.vlan || null,
            description: body.description || null,
            siteId: body.siteId || null,
        },
        include: {
            site: {
                select: { id: true, name: true }
            }
        }
    })

    return {
        success: true,
        message: `IP range ${range.name} created successfully`,
        range,
    }
})
