import prisma from '../../utils/prisma'

interface CreateSiteBody {
    name: string
    description?: string
    location?: string
}

// POST /api/sites - Create a new site
export default defineEventHandler(async (event) => {
    const body = await readBody<CreateSiteBody>(event)

    if (!body.name) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Site name is required',
        })
    }

    // Check for duplicate name
    const existing = await prisma.site.findUnique({
        where: { name: body.name },
    })

    if (existing) {
        throw createError({
            statusCode: 409,
            statusMessage: 'Site with this name already exists',
        })
    }

    const site = await prisma.site.create({
        data: {
            name: body.name,
            description: body.description,
            location: body.location,
        },
    })

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'CREATE_SITE',
            target: site.id,
            details: { name: site.name },
            result: 'success',
        },
    })

    return site
})
