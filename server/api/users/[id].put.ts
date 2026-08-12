import prisma from '../../utils/prisma'
import { hashPassword } from '../../utils/password'

interface UpdateUserBody {
    name?: string
    email?: string
    roleName?: string
    isActive?: boolean
    password?: string
}

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const body = await readBody<UpdateUserBody>(event)

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'User ID is required',
        })
    }

    const existing = await prisma.appUser.findUnique({ where: { id } })
    if (!existing) {
        throw createError({
            statusCode: 404,
            statusMessage: 'User not found',
        })
    }

    const email = body.email?.trim().toLowerCase()
    if (email && email !== existing.email) {
        const duplicate = await prisma.appUser.findUnique({ where: { email } })
        if (duplicate) {
            throw createError({
                statusCode: 409,
                statusMessage: 'User with this email already exists',
            })
        }
    }

    const data: {
        name?: string
        email?: string
        roleName?: string
        isActive?: boolean
        passwordHash?: string
    } = {}

    if (body.name !== undefined) data.name = body.name.trim()
    if (email !== undefined) data.email = email
    if (body.roleName !== undefined) data.roleName = body.roleName.trim()
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.password) {
        if (body.password.length < 8) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Password must be at least 8 characters',
            })
        }
        data.passwordHash = await hashPassword(body.password)
    }

    const user = await prisma.appUser.update({
        where: { id },
        data,
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

    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'UPDATE_USER',
            target: user.id,
            details: { email: user.email, name: user.name, roleName: user.roleName },
            result: 'success',
        },
    })

    return user
})
