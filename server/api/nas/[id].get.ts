import prisma from '../../utils/prisma'

// GET /api/nas/:id - Get single NAS device
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'NAS ID is required',
        })
    }

    const device = await prisma.nAS.findUnique({
        where: { id },
        include: {
            site: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    })

    if (!device) {
        throw createError({
            statusCode: 404,
            statusMessage: 'NAS device not found',
        })
    }

    return device
})
