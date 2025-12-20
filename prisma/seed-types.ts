import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Default device types to seed
const deviceTypes = [
    { code: 'ROUTER', name: 'Router', icon: 'router', color: '#6366f1', isNetworkDevice: true, canHavePorts: true, topologyTier: 0, sortOrder: 1 },
    { code: 'SWITCH_MANAGED', name: 'Managed Switch', icon: 'switch', color: '#06b6d4', isNetworkDevice: true, canHavePorts: true, topologyTier: 1, sortOrder: 2 },
    { code: 'SWITCH_UNMANAGED', name: 'Unmanaged Switch', icon: 'switch', color: '#22d3ee', isNetworkDevice: true, canHavePorts: true, topologyTier: 1, sortOrder: 3 },
    { code: 'ACCESS_POINT', name: 'Access Point', icon: 'wifi', color: '#f59e0b', isNetworkDevice: true, canHavePorts: false, topologyTier: 1, sortOrder: 4 },
    { code: 'SERVER_LINUX', name: 'Linux Server', icon: 'server', color: '#22c55e', isNetworkDevice: false, canHavePorts: false, topologyTier: 2, sortOrder: 5 },
    { code: 'SERVER_WINDOWS', name: 'Windows Server', icon: 'server', color: '#3b82f6', isNetworkDevice: false, canHavePorts: false, topologyTier: 2, sortOrder: 6 },
    { code: 'PC_WINDOWS', name: 'Windows PC', icon: 'desktop', color: '#a855f7', isNetworkDevice: false, canHavePorts: false, topologyTier: 2, sortOrder: 7 },
    { code: 'PC_LINUX', name: 'Linux PC', icon: 'desktop', color: '#84cc16', isNetworkDevice: false, canHavePorts: false, topologyTier: 2, sortOrder: 8 },
    { code: 'VM', name: 'Virtual Machine', icon: 'cloud', color: '#8b5cf6', isNetworkDevice: false, canHavePorts: false, topologyTier: 2, sortOrder: 9 },
    { code: 'PRINTER', name: 'Printer', icon: 'printer', color: '#6b7280', isNetworkDevice: false, canHavePorts: false, topologyTier: 2, sortOrder: 10 },
    { code: 'SMART_TV', name: 'Smart TV', icon: 'tv', color: '#ec4899', isNetworkDevice: false, canHavePorts: false, topologyTier: 2, sortOrder: 11 },
    { code: 'OTHER', name: 'Other', icon: 'device', color: '#6b7280', isNetworkDevice: false, canHavePorts: false, topologyTier: 2, sortOrder: 99 },
]

async function main() {
    console.log('🌱 Seeding device types only...')

    for (const dt of deviceTypes) {
        await prisma.deviceType.upsert({
            where: { code: dt.code },
            update: dt,
            create: dt,
        })
    }

    console.log(`✅ ${deviceTypes.length} device types seeded`)
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
