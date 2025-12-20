import { PrismaClient, DeviceStatus, PortStatus } from '@prisma/client'

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
    console.log('🌱 Seeding database...')

    // Seed Device Types first
    console.log('📦 Seeding device types...')
    for (const dt of deviceTypes) {
        await prisma.deviceType.upsert({
            where: { code: dt.code },
            update: dt,
            create: dt,
        })
    }
    console.log(`✅ ${deviceTypes.length} device types seeded`)

    // Create Sites
    const siteBROS = await prisma.site.upsert({
        where: { name: 'BROS Office' },
        update: {},
        create: {
            name: 'BROS Office',
            location: 'Jl. Raya BROS No. 1',
            description: 'Main office location',
        }
    })

    const siteRSIA = await prisma.site.upsert({
        where: { name: 'RSIA Branch' },
        update: {},
        create: {
            name: 'RSIA Branch',
            location: 'Jl. RSIA No. 2',
            description: 'Branch office',
        }
    })

    console.log('✅ Sites created:', siteBROS.name, siteRSIA.name)

    // Create MikroTik routers (Tier 0)
    await prisma.mikrotikDevice.upsert({
        where: { host_port: { host: '192.168.1.1', port: 8728 } },
        update: {},
        create: {
            name: 'Core Router BROS',
            host: '192.168.1.1',
            port: 8728,
            username: 'admin',
            password: 'admin',
            apiVersion: 'v6',
            siteId: siteBROS.id,
        }
    })

    await prisma.mikrotikDevice.upsert({
        where: { host_port: { host: '10.5.80.1', port: 8729 } },
        update: {},
        create: {
            name: 'Core Router RSIA',
            host: '10.5.80.1',
            port: 8729,
            username: 'admin',
            password: 'admin',
            apiVersion: 'v7',
            siteId: siteRSIA.id,
        }
    })

    console.log('✅ MikroTik routers created')

    // Create Switches (Tier 1) - using unique MAC
    const switchCore = await prisma.device.upsert({
        where: { mac: 'aabbcc112233' },
        update: {},
        create: {
            name: 'SW-Core-BROS',
            typeCode: 'SWITCH_MANAGED',
            ip: '192.168.1.2',
            mac: 'aabbcc112233',
            location: 'Server Room',
            status: DeviceStatus.ONLINE,
            siteId: siteBROS.id,
            portCount: 24,
        }
    })

    const switchFloor1 = await prisma.device.upsert({
        where: { mac: 'aabbcc112244' },
        update: {},
        create: {
            name: 'SW-Floor1-BROS',
            typeCode: 'SWITCH_MANAGED',
            ip: '192.168.1.10',
            mac: 'aabbcc112244',
            location: 'Floor 1',
            status: DeviceStatus.ONLINE,
            siteId: siteBROS.id,
            portCount: 24,
        }
    })

    const switchFloor2 = await prisma.device.upsert({
        where: { mac: 'aabbcc112255' },
        update: {},
        create: {
            name: 'SW-Floor2-BROS',
            typeCode: 'SWITCH_MANAGED',
            ip: '192.168.1.11',
            mac: 'aabbcc112255',
            location: 'Floor 2',
            status: DeviceStatus.ONLINE,
            siteId: siteBROS.id,
            portCount: 24,
        }
    })

    console.log('✅ Switches created')

    // Create Access Points (Tier 1)
    const ap1 = await prisma.device.upsert({
        where: { mac: 'ddeeff112233' },
        update: {},
        create: {
            name: 'AP-Lobby',
            typeCode: 'ACCESS_POINT',
            ip: '192.168.1.20',
            mac: 'ddeeff112233',
            location: 'Lobby',
            status: DeviceStatus.ONLINE,
            siteId: siteBROS.id,
        }
    })

    const ap2 = await prisma.device.upsert({
        where: { mac: 'ddeeff112244' },
        update: {},
        create: {
            name: 'AP-Meeting',
            typeCode: 'ACCESS_POINT',
            ip: '192.168.1.21',
            mac: 'ddeeff112244',
            location: 'Meeting Room',
            status: DeviceStatus.ONLINE,
            siteId: siteBROS.id,
        }
    })

    console.log('✅ Access Points created')

    // Create Servers (Tier 2)
    const server1 = await prisma.device.upsert({
        where: { mac: '112233445501' },
        update: {},
        create: {
            name: 'SRV-DC01',
            typeCode: 'SERVER_LINUX',
            ip: '192.168.1.100',
            mac: '112233445501',
            location: 'Server Room',
            status: DeviceStatus.ONLINE,
            siteId: siteBROS.id,
        }
    })

    const server2 = await prisma.device.upsert({
        where: { mac: '112233445502' },
        update: {},
        create: {
            name: 'SRV-FILE01',
            typeCode: 'SERVER_LINUX',
            ip: '192.168.1.101',
            mac: '112233445502',
            location: 'Server Room',
            status: DeviceStatus.ONLINE,
            siteId: siteBROS.id,
        }
    })

    console.log('✅ Servers created')

    // Create PCs (Tier 2)
    const pc1 = await prisma.device.upsert({
        where: { mac: 'ffeeddccbb01' },
        update: {},
        create: {
            name: 'PC-Reception',
            typeCode: 'PC_WINDOWS',
            ip: '192.168.1.50',
            mac: 'ffeeddccbb01',
            location: 'Reception',
            status: DeviceStatus.ONLINE,
            siteId: siteBROS.id,
        }
    })

    const pc2 = await prisma.device.upsert({
        where: { mac: 'ffeeddccbb02' },
        update: {},
        create: {
            name: 'PC-Admin',
            typeCode: 'PC_WINDOWS',
            ip: '192.168.1.51',
            mac: 'ffeeddccbb02',
            location: 'Admin Office',
            status: DeviceStatus.OFFLINE,
            siteId: siteBROS.id,
        }
    })

    console.log('✅ PCs created')

    // Create RSIA devices
    const switchRSIA = await prisma.device.upsert({
        where: { mac: 'bbccdd112233' },
        update: {},
        create: {
            name: 'SW-Core-RSIA',
            typeCode: 'SWITCH_MANAGED',
            ip: '10.5.80.2',
            mac: 'bbccdd112233',
            location: 'Server Room RSIA',
            status: DeviceStatus.ONLINE,
            siteId: siteRSIA.id,
            portCount: 48,
        }
    })

    const apRSIA = await prisma.device.upsert({
        where: { mac: 'bbccdd445566' },
        update: {},
        create: {
            name: 'AP-RSIA-Lobby',
            typeCode: 'ACCESS_POINT',
            ip: '10.5.80.20',
            mac: 'bbccdd445566',
            location: 'Lobby RSIA',
            status: DeviceStatus.ONLINE,
            siteId: siteRSIA.id,
        }
    })

    console.log('✅ RSIA devices created')

    // Create Port Connections using NetworkPort
    // Core Switch connects to Floor switches
    await prisma.networkPort.upsert({
        where: { deviceId_portName: { deviceId: switchCore.id, portName: 'GE1/0/1' } },
        update: {},
        create: {
            deviceId: switchCore.id,
            portName: 'GE1/0/1',
            portNumber: 1,
            status: PortStatus.UP,
            connectedDeviceId: switchFloor1.id,
        }
    })

    await prisma.networkPort.upsert({
        where: { deviceId_portName: { deviceId: switchCore.id, portName: 'GE1/0/2' } },
        update: {},
        create: {
            deviceId: switchCore.id,
            portName: 'GE1/0/2',
            portNumber: 2,
            status: PortStatus.UP,
            connectedDeviceId: switchFloor2.id,
        }
    })

    // Floor 1 Switch connects to devices
    await prisma.networkPort.upsert({
        where: { deviceId_portName: { deviceId: switchFloor1.id, portName: 'GE1/0/1' } },
        update: {},
        create: {
            deviceId: switchFloor1.id,
            portName: 'GE1/0/1',
            portNumber: 1,
            status: PortStatus.UP,
            connectedDeviceId: server1.id,
        }
    })

    await prisma.networkPort.upsert({
        where: { deviceId_portName: { deviceId: switchFloor1.id, portName: 'GE1/0/2' } },
        update: {},
        create: {
            deviceId: switchFloor1.id,
            portName: 'GE1/0/2',
            portNumber: 2,
            status: PortStatus.UP,
            connectedDeviceId: server2.id,
        }
    })

    await prisma.networkPort.upsert({
        where: { deviceId_portName: { deviceId: switchFloor1.id, portName: 'GE1/0/3' } },
        update: {},
        create: {
            deviceId: switchFloor1.id,
            portName: 'GE1/0/3',
            portNumber: 3,
            status: PortStatus.UP,
            connectedDeviceId: ap1.id,
        }
    })

    // Floor 2 Switch connects to devices
    await prisma.networkPort.upsert({
        where: { deviceId_portName: { deviceId: switchFloor2.id, portName: 'GE1/0/1' } },
        update: {},
        create: {
            deviceId: switchFloor2.id,
            portName: 'GE1/0/1',
            portNumber: 1,
            status: PortStatus.UP,
            connectedDeviceId: pc1.id,
        }
    })

    await prisma.networkPort.upsert({
        where: { deviceId_portName: { deviceId: switchFloor2.id, portName: 'GE1/0/2' } },
        update: {},
        create: {
            deviceId: switchFloor2.id,
            portName: 'GE1/0/2',
            portNumber: 2,
            status: PortStatus.UP,
            connectedDeviceId: pc2.id,
        }
    })

    await prisma.networkPort.upsert({
        where: { deviceId_portName: { deviceId: switchFloor2.id, portName: 'GE1/0/3' } },
        update: {},
        create: {
            deviceId: switchFloor2.id,
            portName: 'GE1/0/3',
            portNumber: 3,
            status: PortStatus.UP,
            connectedDeviceId: ap2.id,
        }
    })

    console.log('✅ Port connections created')

    console.log('')
    console.log('🎉 Seed complete!')
    console.log('📊 Summary:')
    console.log(`   - ${deviceTypes.length} Device Types`)
    console.log('   - 2 Sites')
    console.log('   - 2 MikroTik Routers')
    console.log('   - 4 Switches')
    console.log('   - 3 Access Points')
    console.log('   - 2 Servers')
    console.log('   - 2 PCs')
    console.log('   - Port connections configured')
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
