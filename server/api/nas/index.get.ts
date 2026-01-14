import prisma from '../../utils/prisma'

// GET /api/nas - List all NAS devices
export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const siteId = query.siteId as string | undefined

    const where = siteId ? { siteId } : {}

    const devices = await prisma.nAS.findMany({
        where,
        include: {
            site: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        orderBy: { name: 'asc' },
    })

    return {
        devices,
        total: devices.length,
    }
})
