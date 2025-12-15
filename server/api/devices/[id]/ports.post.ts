import prisma from '../../../utils/prisma'

interface CreatePortsBody {
    ports: {
        portName: string
        portNumber: number
        description?: string
        vlan?: string
        speed?: string
    }[]
}

// POST /api/devices/[id]/ports - Add ports to a device (for switches/routers)
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const body = await readBody<CreatePortsBody>(event)

    if (!id) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Device ID is required',
        })
    }

    if (!body.ports || !Array.isArray(body.ports) || body.ports.length === 0) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Ports array is required',
        })
    }

    // Check device exists
    const device = await prisma.device.findUnique({
        where: { id },
    })

    if (!device) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Device not found',
        })
    }

    // Create ports
    const createdPorts = await prisma.$transaction(
        body.ports.map((port) =>
            prisma.networkPort.upsert({
                where: {
                    deviceId_portName: {
                        deviceId: id,
                        portName: port.portName,
                    },
                },
                update: {
                    portNumber: port.portNumber,
                    description: port.description,
                    vlan: port.vlan,
                    speed: port.speed,
                },
                create: {
                    deviceId: id,
                    portName: port.portName,
                    portNumber: port.portNumber,
                    description: port.description,
                    vlan: port.vlan,
                    speed: port.speed,
                    status: 'DOWN',
                },
            })
        )
    )

    // Update device port count
    await prisma.device.update({
        where: { id },
        data: { portCount: createdPorts.length },
    })

    return {
        success: true,
        message: `Created/updated ${createdPorts.length} ports`,
        ports: createdPorts,
    }
})
