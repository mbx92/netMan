import prisma from '../../utils/prisma'

// GET /api/device-types - List all device types
export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const includeInactive = query.includeInactive === 'true'

    const types = await prisma.deviceType.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: { sortOrder: 'asc' },
    })

    return types
})
