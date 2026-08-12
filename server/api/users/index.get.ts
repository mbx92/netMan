import prisma, { withPrismaRetry } from '../../utils/prisma'

export default defineEventHandler(async () => {
    const users = await withPrismaRetry(() =>
        prisma.appUser.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                name: true,
                roleName: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
    )

    return users
})
