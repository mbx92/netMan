import prisma from '../../utils/prisma'

// GET /api/sites - List all sites
export default defineEventHandler(async () => {
    const sites = await prisma.site.findMany({
        include: {
            _count: {
                select: {
                    devices: true,
                    mikrotikDevices: true,
                },
            },
        },
        orderBy: { name: 'asc' },
    })

    return {
        sites: sites.map(site => ({
            ...site,
            deviceCount: site._count.devices,
            mikrotikCount: site._count.mikrotikDevices,
        })),
        total: sites.length,
    }
})
