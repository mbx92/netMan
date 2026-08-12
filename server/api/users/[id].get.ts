import prisma from '../../utils/prisma'

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'User ID is required',
        })
    }

    const user = await prisma.appUser.findUnique({
        where: { id },
        select: {
            id: true,
            email: true,
            name: true,
            roleName: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
        },
    })

    if (!user) {
        throw createError({
            statusCode: 404,
            statusMessage: 'User not found',
        })
    }

    return user
})
