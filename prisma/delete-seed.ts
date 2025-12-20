import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteSeedData() {
    console.log('🗑️ Deleting seed data...')

    // Delete seed ports first (foreign key constraint)
    const deletedPorts = await prisma.networkPort.deleteMany({
        where: {
            device: {
                mac: {
                    in: [
                        'AA:BB:CC:11:22:33', 'AA:BB:CC:11:22:44', 'AA:BB:CC:11:22:55',
                        'BB:CC:DD:11:22:33', 'BB:CC:DD:44:55:66',
                        'DD:EE:FF:11:22:33', 'DD:EE:FF:11:22:44',
                        '11:22:33:44:55:01', '11:22:33:44:55:02',
                        'FF:EE:DD:CC:BB:01', 'FF:EE:DD:CC:BB:02', 'FF:EE:DD:CC:BB:03'
                    ]
                }
            }
        }
    })
    console.log(`✅ Deleted ${deletedPorts.count} ports`)

    // Delete seed devices
    const deletedDevices = await prisma.device.deleteMany({
        where: {
            mac: {
                in: [
                    'AA:BB:CC:11:22:33', 'AA:BB:CC:11:22:44', 'AA:BB:CC:11:22:55',
                    'BB:CC:DD:11:22:33', 'BB:CC:DD:44:55:66',
                    'DD:EE:FF:11:22:33', 'DD:EE:FF:11:22:44',
                    '11:22:33:44:55:01', '11:22:33:44:55:02',
                    'FF:EE:DD:CC:BB:01', 'FF:EE:DD:CC:BB:02', 'FF:EE:DD:CC:BB:03'
                ]
            }
        }
    })
    console.log(`✅ Deleted ${deletedDevices.count} devices`)

    // Delete seed MikroTik routers
    const deletedMikrotik = await prisma.mikrotikDevice.deleteMany({
        where: {
            host: { in: ['192.168.1.1', '10.5.80.1'] }
        }
    })
    console.log(`✅ Deleted ${deletedMikrotik.count} MikroTik devices`)

    // Delete seed sites (only if empty)
    const deletedSites = await prisma.site.deleteMany({
        where: {
            name: { in: ['BROS Office', 'RSIA Branch'] },
            devices: { none: {} },
            mikrotikDevices: { none: {} }
        }
    })
    console.log(`✅ Deleted ${deletedSites.count} sites`)

    console.log('')
    console.log('🎉 Seed data cleanup complete!')
}

deleteSeedData()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
