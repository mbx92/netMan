/**
 * MikroTik REST API Client
 * 
 * Provides methods to query MikroTik RouterOS 7+ REST API
 * for network discovery, ARP table, DHCP leases, etc.
 */

interface MikroTikConfig {
    host: string
    port?: number
    username: string
    password: string
    secure?: boolean  // true = HTTPS, false = HTTP
}

interface ArpEntry {
    '.id': string
    address: string
    'mac-address': string
    interface: string
    dynamic?: boolean
    complete?: boolean
    published?: boolean
}

interface DhcpLease {
    '.id': string
    address: string
    'mac-address': string
    'host-name'?: string
    'client-id'?: string
    'address-lists'?: string
    server: string
    status: string
    'last-seen'?: string
    dynamic?: boolean
}

interface InterfaceInfo {
    '.id': string
    name: string
    type: string
    'mac-address'?: string
    mtu?: number
    running?: boolean
    disabled?: boolean
}

export class MikroTikClient {
    private config: MikroTikConfig
    private baseUrl: string

    constructor(config: MikroTikConfig) {
        this.config = {
            port: config.secure !== false ? 443 : 80,
            secure: true,
            ...config,
        }

        const protocol = this.config.secure ? 'https' : 'http'
        this.baseUrl = `${protocol}://${this.config.host}:${this.config.port}/rest`
    }

    /**
     * Make authenticated request to MikroTik REST API
     */
    private async request<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: object): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`
        const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')

        const headers: HeadersInit = {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
        }

        const options: RequestInit = {
            method,
            headers,
        }

        if (body) {
            options.body = JSON.stringify(body)
        }

        try {
            // Use node-fetch or native fetch with SSL ignore for self-signed certs
            const response = await fetch(url, {
                ...options,
                // @ts-ignore - Node.js specific option for self-signed certs
                agent: this.config.secure ? new (require('https').Agent)({ rejectUnauthorized: false }) : undefined,
            })

            if (!response.ok) {
                throw new Error(`MikroTik API error: ${response.status} ${response.statusText}`)
            }

            return await response.json() as T
        } catch (error) {
            console.error('[MikroTik] API request failed:', endpoint, error)
            throw error
        }
    }

    /**
     * Test connection to MikroTik
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.request('/system/resource')
            return true
        } catch {
            return false
        }
    }

    /**
     * Get MikroTik system identity (router name)
     */
    async getIdentity(): Promise<string | undefined> {
        try {
            const result = await this.request<{ name: string }>('/system/identity')
            console.log('[MikroTik] Router identity:', result.name)
            return result.name
        } catch (error) {
            console.error('[MikroTik] Failed to fetch identity:', error)
            return undefined
        }
    }

    /**
     * Get ARP table entries
     */
    async getArpTable(): Promise<ArpEntry[]> {
        try {
            const entries = await this.request<ArpEntry[]>('/ip/arp')
            console.log(`[MikroTik] Fetched ${entries.length} ARP entries`)
            return entries
        } catch (error) {
            console.error('[MikroTik] Failed to fetch ARP table:', error)
            return []
        }
    }

    /**
     * Get DHCP leases (includes hostnames)
     */
    async getDhcpLeases(): Promise<DhcpLease[]> {
        try {
            const leases = await this.request<DhcpLease[]>('/ip/dhcp-server/lease')
            console.log(`[MikroTik] Fetched ${leases.length} DHCP leases`)

            // Log how many have hostnames
            const withHostname = leases.filter(l => l['host-name'])
            console.log(`[MikroTik] DHCP leases with hostname: ${withHostname.length}`)

            // Log first few with hostnames for debugging  
            withHostname.slice(0, 5).forEach(l => {
                console.log(`[MikroTik] DHCP: ${l.address} -> ${l['host-name']} (MAC: ${l['mac-address']})`)
            })

            return leases
        } catch (error) {
            console.error('[MikroTik] Failed to fetch DHCP leases:', error)
            return []
        }
    }

    /**
     * Get interface list
     */
    async getInterfaces(): Promise<InterfaceInfo[]> {
        try {
            return await this.request<InterfaceInfo[]>('/interface')
        } catch (error) {
            console.error('[MikroTik] Failed to fetch interfaces:', error)
            return []
        }
    }

    /**
     * Get combined device info from ARP + DHCP
     * This gives us IP, MAC, hostname, and interface for all devices across VLANs
     */
    async getNetworkDevices(): Promise<{
        ip: string
        mac: string
        hostname?: string
        interface: string
        dhcpServer?: string
    }[]> {
        const [arpEntries, dhcpLeases] = await Promise.all([
            this.getArpTable(),
            this.getDhcpLeases(),
        ])

        // Create MAC -> DHCP info map
        const dhcpByMac = new Map<string, typeof dhcpLeases[0]>()
        // Create IP -> DHCP info map (for direct IP lookup)
        const dhcpByIp = new Map<string, typeof dhcpLeases[0]>()

        for (const lease of dhcpLeases) {
            const mac = lease['mac-address']?.toLowerCase()
            if (mac) {
                dhcpByMac.set(mac, lease)
            }
            // Also index by IP for direct lookup
            if (lease.address) {
                dhcpByIp.set(lease.address, lease)
            }
        }

        console.log(`[MikroTik] DHCP leases indexed: ${dhcpByMac.size} by MAC, ${dhcpByIp.size} by IP`)

        // Track which IPs we've seen
        const seenIps = new Set<string>()

        // Combine ARP with DHCP data
        const devices = arpEntries.map(arp => {
            const mac = arp['mac-address']?.toLowerCase()
            const dhcp = dhcpByMac.get(mac)
            seenIps.add(arp.address)

            const hostname = dhcp?.['host-name']
            if (hostname) {
                console.log(`[MikroTik] Found hostname via MAC: ${arp.address} -> ${hostname}`)
            }

            return {
                ip: arp.address,
                mac: arp['mac-address'],
                hostname,
                interface: arp.interface,
                dhcpServer: dhcp?.server,
            }
        })

        // Add DHCP-only devices (not in ARP table but have DHCP lease)
        for (const lease of dhcpLeases) {
            if (lease.address && !seenIps.has(lease.address)) {
                seenIps.add(lease.address)
                const hostname = lease['host-name']
                if (hostname) {
                    console.log(`[MikroTik] Found hostname via DHCP-only: ${lease.address} -> ${hostname}`)
                }
                devices.push({
                    ip: lease.address,
                    mac: lease['mac-address'],
                    hostname,
                    interface: 'dhcp-only',
                    dhcpServer: lease.server,
                })
            }
        }

        console.log(`[MikroTik] Combined ${devices.length} network devices from ARP/DHCP`)
        console.log(`[MikroTik] Devices with hostname: ${devices.filter(d => d.hostname).length}`)
        return devices
    }

    /**
     * Get device info for a specific IP
     */
    async getDeviceByIp(ip: string): Promise<{
        mac?: string
        hostname?: string
        interface?: string
    } | null> {
        const devices = await this.getNetworkDevices()
        const device = devices.find(d => d.ip === ip)

        if (device) {
            return {
                mac: device.mac,
                hostname: device.hostname,
                interface: device.interface,
            }
        }

        return null
    }
}

// Singleton instance (can be configured via environment)
let mikrotikClient: MikroTikClient | null = null

export function getMikroTikClient(): MikroTikClient | null {
    if (!mikrotikClient) {
        // Check if MikroTik is configured via environment
        const host = process.env.MIKROTIK_HOST
        const username = process.env.MIKROTIK_USER
        const password = process.env.MIKROTIK_PASS

        if (host && username && password) {
            mikrotikClient = new MikroTikClient({
                host,
                username,
                password,
                port: parseInt(process.env.MIKROTIK_PORT || '443'),
                secure: process.env.MIKROTIK_SECURE !== 'false',
            })
            console.log('[MikroTik] Client initialized for', host)
        }
    }

    return mikrotikClient
}

export function setMikroTikClient(client: MikroTikClient): void {
    mikrotikClient = client
}

export default MikroTikClient
