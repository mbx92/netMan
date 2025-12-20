/**
 * Unified MikroTik Client Factory
 * 
 * Supports both RouterOS 6 (API protocol) and RouterOS 7 (REST API)
 */

import { MikroTikV6Client } from './mikrotik-v6'
import { MikroTikV7Client } from './mikrotik-v7'
import prisma from './prisma'

// Common interface for both clients
export interface IMikroTikClient {
    testConnection(): Promise<boolean>
    getIdentity(): Promise<string | undefined>
    getArpTable(): Promise<{
        '.id': string
        address: string
        'mac-address': string
        interface: string
    }[]>
    getDhcpLeases(): Promise<{
        '.id': string
        address: string
        'mac-address': string
        'host-name'?: string
        server: string
        status: string
    }[]>
    getNetworkDevices(): Promise<{
        ip: string
        mac: string
        hostname?: string
        interface: string
        dhcpServer?: string
    }[]>
    getDeviceByIp(ip: string): Promise<{
        mac?: string
        hostname?: string
        interface?: string
    } | null>
    getRouterInfo(): Promise<{
        identity?: string
        mac?: string
        model?: string
        version?: string
        portCount: number
        interfaces: { name: string; type: string; mac?: string; running?: boolean }[]
        bridges: { name: string; mac?: string }[]
        vlans: { name: string; vlanId: number; interface?: string }[]
    }>
}

export interface MikroTikConfig {
    id?: string
    name?: string
    host: string
    port: number
    username: string
    password: string
    apiVersion: 'v6' | 'v7'
    siteId?: string | null
}

/**
 * Create a MikroTik client based on API version
 */
export function createMikroTikClient(config: MikroTikConfig): IMikroTikClient {
    if (config.apiVersion === 'v7') {
        return new MikroTikV7Client({
            host: config.host,
            port: config.port || 443,
            username: config.username,
            password: config.password,
            secure: config.port === 443 || config.port === 8729,
        })
    } else {
        return new MikroTikV6Client({
            host: config.host,
            port: config.port || 8728,
            username: config.username,
            password: config.password,
        })
    }
}

// Cache of active clients by device ID
const clientCache = new Map<string, IMikroTikClient>()

/**
 * Get MikroTik client for a specific device from database
 */
export async function getMikroTikClientById(deviceId: string): Promise<IMikroTikClient | null> {
    // Check cache first
    if (clientCache.has(deviceId)) {
        return clientCache.get(deviceId)!
    }

    // Fetch from database
    const device = await prisma.mikrotikDevice.findUnique({
        where: { id: deviceId },
    })

    if (!device || !device.isActive) {
        return null
    }

    const client = createMikroTikClient({
        id: device.id,
        name: device.name,
        host: device.host,
        port: device.port,
        username: device.username,
        password: device.password,
        apiVersion: device.apiVersion as 'v6' | 'v7',
        siteId: device.siteId,
    })

    // Cache the client
    clientCache.set(deviceId, client)
    return client
}

/**
 * Get all active MikroTik clients from database
 * Checks both MikrotikDevice table (legacy) and Device table (new)
 */
export async function getAllMikroTikClients(): Promise<{ config: MikroTikConfig; client: IMikroTikClient }[]> {
    const results: { config: MikroTikConfig; client: IMikroTikClient }[] = []

    // Check legacy MikrotikDevice table
    const mikrotikDevices = await prisma.mikrotikDevice.findMany({
        where: { isActive: true },
    })

    for (const device of mikrotikDevices) {
        const config: MikroTikConfig = {
            id: device.id,
            name: device.name,
            host: device.host,
            port: device.port,
            username: device.username,
            password: device.password,
            apiVersion: device.apiVersion as 'v6' | 'v7',
            siteId: device.siteId,
        }

        if (!clientCache.has(device.id)) {
            clientCache.set(device.id, createMikroTikClient(config))
        }

        results.push({
            config,
            client: clientCache.get(device.id)!,
        })
    }

    // Also check Device table for routers with API credentials
    const routerDevices = await prisma.device.findMany({
        where: {
            typeCode: 'ROUTER',
            isApiActive: true,
            apiUser: { not: null },
            apiPass: { not: null },
        },
    })

    for (const device of routerDevices) {
        // Skip if already added from MikrotikDevice table (check by IP)
        if (results.some(r => r.config.host === device.ip)) continue
        if (!device.apiUser || !device.apiPass || !device.ip) continue

        const config: MikroTikConfig = {
            id: device.id,
            name: device.name,
            host: device.ip,
            port: device.apiPort || 8728,
            username: device.apiUser,
            password: device.apiPass,
            apiVersion: (device.apiVersion as 'v6' | 'v7') || 'v6',
            siteId: device.siteId,
        }

        const cacheKey = `device-${device.id}`
        if (!clientCache.has(cacheKey)) {
            clientCache.set(cacheKey, createMikroTikClient(config))
        }

        results.push({
            config,
            client: clientCache.get(cacheKey)!,
        })
    }

    return results
}

/**
 * Get MikroTik clients for a specific site
 */
export async function getMikroTikClientsBySite(siteId: string): Promise<{ config: MikroTikConfig; client: IMikroTikClient }[]> {
    const devices = await prisma.mikrotikDevice.findMany({
        where: {
            isActive: true,
            siteId: siteId,
        },
    })

    return devices.map(device => {
        const config: MikroTikConfig = {
            id: device.id,
            name: device.name,
            host: device.host,
            port: device.port,
            username: device.username,
            password: device.password,
            apiVersion: device.apiVersion as 'v6' | 'v7',
            siteId: device.siteId,
        }

        if (!clientCache.has(device.id)) {
            clientCache.set(device.id, createMikroTikClient(config))
        }

        return {
            config,
            client: clientCache.get(device.id)!,
        }
    })
}

/**
 * Clear client cache (e.g., when device config changes)
 */
export function clearClientCache(deviceId?: string): void {
    if (deviceId) {
        clientCache.delete(deviceId)
    } else {
        clientCache.clear()
    }
}

/**
 * Lookup device info from all MikroTik routers
 */
export async function lookupDeviceFromMikroTik(ip: string, siteId?: string): Promise<{
    mac?: string
    hostname?: string
    interface?: string
    source?: string
} | null> {
    const clients = siteId
        ? await getMikroTikClientsBySite(siteId)
        : await getAllMikroTikClients()

    console.log(`[MikroTik] Looking up ${ip} from ${clients.length} MikroTik clients`)

    for (const { config, client } of clients) {
        try {
            console.log(`[MikroTik] Querying ${config.name || config.host}...`)
            const device = await client.getDeviceByIp(ip)
            console.log(`[MikroTik] Result from ${config.host}:`, device)
            if (device && device.mac) {
                return {
                    ...device,
                    source: config.name || config.host,
                }
            }
        } catch (error) {
            console.error(`[MikroTik] Failed to lookup ${ip} from ${config.host}:`, error)
        }
    }

    console.log(`[MikroTik] IP ${ip} not found in any MikroTik router`)
    return null
}

export { MikroTikV6Client, MikroTikV7Client }
