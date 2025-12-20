import prisma from '../../../../utils/prisma'

// POST /api/ipam/ranges/[id]/allocations - Add IP allocation
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const body = await readBody(event)

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Range ID is required',
        })
    }

    if (!body.ip) {
        throw createError({
            statusCode: 400,
            statusMessage: 'IP address is required',
        })
    }

    // Validate IP format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(body.ip)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid IP address format',
        })
    }

    // Check range exists
    const range = await prisma.iPRange.findUnique({
        where: { id }
    })

    if (!range) {
        throw createError({
            statusCode: 404,
            statusMessage: 'IP range not found',
        })
    }

    // Validate IP is within range
    const [networkBase, cidr] = range.network.split('/')
    const prefix = parseInt(cidr) || 24
    const networkOctets = networkBase.split('.').map(Number)
    const networkInt = (networkOctets[0] << 24) + (networkOctets[1] << 16) + (networkOctets[2] << 8) + networkOctets[3]
    const mask = ~((1 << (32 - prefix)) - 1)

    const ipOctets = body.ip.split('.').map(Number)
    const ipInt = (ipOctets[0] << 24) + (ipOctets[1] << 16) + (ipOctets[2] << 8) + ipOctets[3]

    if ((ipInt & mask) !== (networkInt & mask)) {
        throw createError({
            statusCode: 400,
            statusMessage: `IP ${body.ip} is not within range ${range.network}`,
        })
    }

    // Check for existing allocation
    const existing = await prisma.iPAllocation.findFirst({
        where: {
            rangeId: id,
            ip: body.ip,
        }
    })

    if (existing) {
        throw createError({
            statusCode: 409,
            statusMessage: `IP ${body.ip} is already allocated`,
        })
    }

    // Create allocation
    const allocation = await prisma.iPAllocation.create({
        data: {
            rangeId: id,
            ip: body.ip,
            mac: body.mac || null,
            hostname: body.hostname || null,
            type: body.type || 'STATIC',
        }
    })

    return {
        success: true,
        message: `IP ${body.ip} allocated successfully`,
        allocation,
    }
})
