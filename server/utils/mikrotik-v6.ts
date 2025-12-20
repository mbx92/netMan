/**
 * MikroTik API Client for RouterOS 6.x
 * 
 * Uses node-routeros library to connect via API protocol (port 8728/8729)
 */

import { RouterOSAPI } from 'node-routeros'

interface MikroTikV6Config {
    host: string
    port?: number
    username: string
    password: string
    timeout?: number
}

interface ArpEntry {
    '.id': string
    address: string
    'mac-address': string
    interface: string
    dynamic?: string
    complete?: string
    published?: string
}

interface DhcpLease {
    '.id': string
    address: string
    'mac-address': string
    'host-name'?: string
    'client-id'?: string
    server: string
    status: string
    'last-seen'?: string
    dynamic?: string
}

interface InterfaceInfo {
    '.id': string
    name: string
    type: string
    'mac-address'?: string
    mtu?: string
    running?: string
    disabled?: string
}

export class MikroTikV6Client {
    private config: MikroTikV6Config
    private api: RouterOSAPI | null = null

    constructor(config: MikroTikV6Config) {
        this.config = {
            port: 8728,
            timeout: 10000,
            ...config,
        }
    }

    /**
     * Connect to MikroTik API
     */
    private async connect(): Promise<RouterOSAPI> {
        if (this.api) {
            return this.api
        }

        this.api = new RouterOSAPI({
            host: this.config.host,
            port: this.config.port,
            user: this.config.username,
            password: this.config.password,
            timeout: this.config.timeout,
        })

        try {
            await this.api.connect()
            console.log(`[MikroTik-v6] Connected to ${this.config.host}:${this.config.port}`)
            return this.api
        } catch (error) {
            console.error('[MikroTik-v6] Connection failed:', error)
            this.api = null
            throw error
        }
    }

    /**
     * Disconnect from API
     */
    async disconnect(): Promise<void> {
        if (this.api) {
            try {
                this.api.close()
            } catch {
                // Ignore close errors
            }
            this.api = null
        }
    }

    /**
     * Test connection to MikroTik
     */
    async testConnection(): Promise<boolean> {
        try {
            const api = await this.connect()
            const result = await api.write('/system/resource/print')
            await this.disconnect()
            return Array.isArray(result) && result.length > 0
        } catch {
            return false
        }
    }

    /**
     * Get MikroTik system identity (router name)
     */
    async getIdentity(): Promise<string | undefined> {
        try {
            const api = await this.connect()
            const result = await api.write('/system/identity/print')
            console.log('[MikroTik-v6] Router identity:', result[0]?.name)
            return result[0]?.name
        } catch (error) {
            console.error('[MikroTik-v6] Failed to fetch identity:', error)
            return undefined
        }
    }

    /**
     * Get ARP table entries
     */
    async getArpTable(): Promise<ArpEntry[]> {
        try {
            const api = await this.connect()
            const entries = await api.write('/ip/arp/print') as ArpEntry[]
            console.log(`[MikroTik-v6] Fetched ${entries.length} ARP entries`)
            return entries
        } catch (error) {
            console.error('[MikroTik-v6] Failed to fetch ARP table:', error)
            return []
        }
    }

    /**
     * Get ARP entry for specific IP (faster - filters on router)
     */
    async getArpByIp(ip: string): Promise<ArpEntry | null> {
        try {
            const api = await this.connect()
            // Query with filter for specific IP
            const entries = await api.write('/ip/arp/print', [
                `?address=${ip}`
            ]) as ArpEntry[]
            console.log(`[MikroTik-v6] ARP lookup for ${ip}: ${entries.length} entries`)
            if (entries.length > 0) {
                return entries[0]
            }
            return null
        } catch (error) {
            console.error(`[MikroTik-v6] Failed to lookup ARP for ${ip}:`, error)
            return null
        }
    }

    /**
     * Get DHCP leases (includes hostnames)
     */
    async getDhcpLeases(): Promise<DhcpLease[]> {
        try {
            const api = await this.connect()
            const leases = await api.write('/ip/dhcp-server/lease/print') as DhcpLease[]
            console.log(`[MikroTik-v6] Fetched ${leases.length} DHCP leases`)

            // Log how many have hostnames
            const withHostname = leases.filter(l => l['host-name'])
            console.log(`[MikroTik-v6] DHCP leases with hostname: ${withHostname.length}`)

            return leases
        } catch (error) {
            console.error('[MikroTik-v6] Failed to fetch DHCP leases:', error)
            return []
        }
    }

    /**
     * Get interface list
     */
    async getInterfaces(): Promise<InterfaceInfo[]> {
        try {
            const api = await this.connect()
            return await api.write('/interface/print') as InterfaceInfo[]
        } catch (error) {
            console.error('[MikroTik-v6] Failed to fetch interfaces:', error)
            return []
        }
    }

    /**
     * Get combined device info from ARP + DHCP
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
        const dhcpByMac = new Map<string, DhcpLease>()
        const dhcpByIp = new Map<string, DhcpLease>()

        for (const lease of dhcpLeases) {
            const mac = lease['mac-address']?.toLowerCase()
            if (mac) {
                dhcpByMac.set(mac, lease)
            }
            if (lease.address) {
                dhcpByIp.set(lease.address, lease)
            }
        }

        console.log(`[MikroTik-v6] DHCP leases indexed: ${dhcpByMac.size} by MAC, ${dhcpByIp.size} by IP`)

        // Track which IPs we've seen
        const seenIps = new Set<string>()

        // Combine ARP with DHCP data
        const devices = arpEntries.map(arp => {
            const mac = arp['mac-address']?.toLowerCase()
            const dhcp = dhcpByMac.get(mac)
            seenIps.add(arp.address)

            return {
                ip: arp.address,
                mac: arp['mac-address'],
                hostname: dhcp?.['host-name'],
                interface: arp.interface,
                dhcpServer: dhcp?.server,
            }
        })

        // Add DHCP-only devices
        for (const lease of dhcpLeases) {
            if (lease.address && !seenIps.has(lease.address)) {
                seenIps.add(lease.address)
                devices.push({
                    ip: lease.address,
                    mac: lease['mac-address'],
                    hostname: lease['host-name'],
                    interface: 'dhcp-only',
                    dhcpServer: lease.server,
                })
            }
        }

        console.log(`[MikroTik-v6] Combined ${devices.length} network devices from ARP/DHCP`)
        return devices
    }

    /**
     * Get device info for a specific IP (optimized - uses filtered ARP query)
     */
    async getDeviceByIp(ip: string): Promise<{
        mac?: string
        hostname?: string
        interface?: string
    } | null> {
        // Use optimized ARP lookup (filters on router side)
        const arpEntry = await this.getArpByIp(ip)

        if (arpEntry) {
            // Try to get hostname from DHCP
            let hostname: string | undefined
            try {
                const api = await this.connect()
                const leases = await api.write('/ip/dhcp-server/lease/print', [
                    `?address=${ip}`
                ]) as { 'host-name'?: string }[]
                hostname = leases[0]?.['host-name']
            } catch {
                // DHCP lookup failed, continue without hostname
            }

            return {
                mac: arpEntry['mac-address'],
                hostname,
                interface: arpEntry.interface,
            }
        }

        return null
    }

    /**
     * Get comprehensive router info for auto-fill
     */
    async getRouterInfo(): Promise<{
        identity?: string
        mac?: string
        model?: string
        version?: string
        portCount: number
        interfaces: { name: string; type: string; mac?: string; running?: boolean }[]
        bridges: { name: string; mac?: string }[]
        vlans: { name: string; vlanId: number; interface?: string }[]
    }> {
        try {
            const api = await this.connect()

            // Get identity
            const identityResult = await api.write('/system/identity/print')
            const identity = identityResult[0]?.name

            // Get resource info (model, version)
            const resourceResult = await api.write('/system/resource/print')
            const resource = resourceResult[0] || {}
            const model = resource['board-name'] || resource['platform']
            const version = resource['version']

            // Get interfaces
            const interfacesResult = await api.write('/interface/print') as {
                name: string
                type: string
                'mac-address'?: string
                running?: string
                disabled?: string
            }[]

            const interfaces = interfacesResult.map(iface => ({
                name: iface.name,
                type: iface.type,
                mac: iface['mac-address'],
                running: iface.running === 'true',
            }))

            // Get first ether MAC as main MAC
            const etherInterface = interfacesResult.find(i => i.type === 'ether' && i.name.includes('ether1'))
                || interfacesResult.find(i => i.type === 'ether')
            const mac = etherInterface?.['mac-address']

            // Count ethernet ports
            const etherPorts = interfacesResult.filter(i => i.type === 'ether')
            const portCount = etherPorts.length

            // Get bridges
            const bridgesResult = await api.write('/interface/bridge/print') as {
                name: string
                'mac-address'?: string
            }[]
            const bridges = bridgesResult.map(b => ({
                name: b.name,
                mac: b['mac-address'],
            }))

            // Get VLANs
            let vlans: { name: string; vlanId: number; interface?: string }[] = []
            try {
                const vlansResult = await api.write('/interface/vlan/print') as {
                    name: string
                    'vlan-id': string
                    interface?: string
                }[]
                vlans = vlansResult.map(v => ({
                    name: v.name,
                    vlanId: parseInt(v['vlan-id'], 10),
                    interface: v.interface,
                }))
            } catch {
                // VLANs might not exist on all routers
            }

            await this.disconnect()

            console.log(`[MikroTik-v6] Router info: ${identity}, ${portCount} ports, ${bridges.length} bridges, ${vlans.length} VLANs`)

            return {
                identity,
                mac,
                model,
                version,
                portCount,
                interfaces,
                bridges,
                vlans,
            }
        } catch (error) {
            console.error('[MikroTik-v6] Failed to fetch router info:', error)
            return {
                portCount: 0,
                interfaces: [],
                bridges: [],
                vlans: [],
            }
        }
    }
}

export default MikroTikV6Client
