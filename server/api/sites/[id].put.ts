import prisma from '../../utils/prisma'

interface UpdateSiteBody {
    name?: string
    description?: string
    location?: string
}

// PUT /api/sites/[id] - Update a site
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const body = await readBody<UpdateSiteBody>(event)

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Site ID is required',
        })
    }

    // Check if site exists
    const existing = await prisma.site.findUnique({
        where: { id },
    })

    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Site not found',
        })
    }

    // Check for duplicate name if changing
    if (body.name && body.name !== existing.name) {
        const duplicate = await prisma.site.findUnique({
            where: { name: body.name },
        })
        if (duplicate) {
            throw createError({
                statusCode: 409,
                statusMessage: 'Site with this name already exists',
            })
        }
    }

    const site = await prisma.site.update({
        where: { id },
        data: {
            name: body.name,
            description: body.description,
            location: body.location,
        },
    })

    return site
})
