import prisma from '../../utils/prisma'
import { hashPassword } from '../../utils/password'

interface CreateUserBody {
    email?: string
    name?: string
    password?: string
    roleName?: string
    isActive?: boolean
}

export default defineEventHandler(async (event) => {
    const body = await readBody<CreateUserBody>(event)

    const email = body.email?.trim().toLowerCase()
    const name = body.name?.trim()
    const password = body.password
    const roleName = body.roleName?.trim() || 'admin'

    if (!email || !name || !password) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Email, name, and password are required',
        })
    }

    const existing = await prisma.appUser.findUnique({ where: { email } })
    if (existing) {
        throw createError({
            statusCode: 409,
            statusMessage: 'User with this email already exists',
        })
    }

    if (password.length < 8) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Password must be at least 8 characters',
        })
    }

    const passwordHash = await hashPassword(password)

    const user = await prisma.appUser.create({
        data: {
            email,
            name,
            passwordHash,
            roleName,
            isActive: body.isActive ?? true,
        },
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
            action: 'CREATE_USER',
            target: user.id,
            details: { email: user.email, name: user.name, roleName: user.roleName },
            result: 'success',
        },
    })

    return user
})
