/**
 * MikroTik REST API Client
 *
 * Provides methods to query MikroTik RouterOS 7+ REST API
 * for network discovery, ARP table, DHCP leases, etc.
 */

import https from 'node:https'
import http from 'node:http'

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

interface HotspotIpBindingRaw {
    '.id': string
    address: string
    'mac-address'?: string
    'to-address'?: string
    server?: string
    type?: string
    comment?: string
    disabled?: boolean | string
}

interface HotspotActiveRaw {
    '.id': string
    address: string
    'mac-address': string
    user?: string
    server?: string
    uptime?: string
    'login-by'?: string
    'bytes-in'?: string
    'bytes-out'?: string
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
     * Make authenticated request to MikroTik REST API.
     * Uses node:http(s) so self-signed certs work in Nitro ESM (no `require`).
     */
    private async request<T>(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET', body?: object): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`
        const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')
        const payload = body ? JSON.stringify(body) : undefined

        try {
            const text = await this.httpRequest(url, method, auth, payload)
            return (text ? JSON.parse(text) : undefined) as T
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            console.error('[MikroTik] API request failed:', endpoint, message)
            throw error
        }
    }

    private httpRequest(url: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', auth: string, payload?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const u = new URL(url)
            const isHttps = u.protocol === 'https:'
            const mod = isHttps ? https : http
            const req = mod.request(
                {
                    protocol: u.protocol,
                    hostname: u.hostname,
                    port: u.port || (isHttps ? 443 : 80),
                    path: `${u.pathname}${u.search}`,
                    method,
                    rejectUnauthorized: false,
                    timeout: 15000,
                    headers: {
                        Authorization: `Basic ${auth}`,
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'NetMan/1.0',
                        Connection: 'close',
                        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
                    },
                },
                (res) => {
                    const chunks: Buffer[] = []
                    res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
                    res.on('end', () => {
                        const text = Buffer.concat(chunks).toString('utf8')
                        const status = res.statusCode || 0
                        if (status >= 200 && status < 300) {
                            resolve(text || '[]')
                            return
                        }
                        reject(new Error(`MikroTik API error: ${status} ${res.statusMessage || ''} ${text.slice(0, 200)}`.trim()))
                    })
                },
            )
            req.on('timeout', () => {
                req.destroy()
                reject(new Error('Timeout after 15000ms'))
            })
            req.on('error', reject)
            if (payload) req.write(payload)
            req.end()
        })
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
     * Get hotspot IP bindings (/ip/hotspot/ip-binding)
     * Used for bypassed/regular/blocked IP+MAC entries that skip or force the hotspot login
     */
    async getHotspotIpBindings(): Promise<{
        id: string
        address: string
        mac?: string
        toAddress?: string
        server?: string
        type: 'bypassed' | 'regular' | 'blocked'
        comment?: string
        disabled?: boolean
    }[]> {
        try {
            const entries = await this.request<HotspotIpBindingRaw[]>('/ip/hotspot/ip-binding')
            console.log(`[MikroTik] Fetched ${entries.length} hotspot IP bindings`)
            return entries.map(e => ({
                id: e['.id'],
                address: e.address,
                mac: e['mac-address'],
                toAddress: e['to-address'],
                server: e.server,
                type: (e.type as 'bypassed' | 'regular' | 'blocked') || 'bypassed',
                comment: e.comment,
                disabled: e.disabled === true || e.disabled === 'true',
            }))
        } catch (error) {
            console.error('[MikroTik] Failed to fetch hotspot IP bindings:', error)
            return []
        }
    }

    /**
     * Get currently active hotspot hosts (/ip/hotspot/active)
     * Used to detect a device connected to the hotspot with no matching ip-binding entry
     */
    async getActiveHotspotHosts(): Promise<{
        id: string
        address: string
        mac: string
        user?: string
        server?: string
        uptime?: string
        loginBy?: string
        bytesIn?: number
        bytesOut?: number
    }[]> {
        try {
            const entries = await this.request<HotspotActiveRaw[]>('/ip/hotspot/active')
            console.log(`[MikroTik] Fetched ${entries.length} active hotspot hosts`)
            return entries.map(e => ({
                id: e['.id'],
                address: e.address,
                mac: e['mac-address'],
                user: e.user,
                server: e.server,
                uptime: e.uptime,
                loginBy: e['login-by'],
                bytesIn: e['bytes-in'] ? Number(e['bytes-in']) : undefined,
                bytesOut: e['bytes-out'] ? Number(e['bytes-out']) : undefined,
            }))
        } catch (error) {
            console.error('[MikroTik] Failed to fetch active hotspot hosts:', error)
            return []
        }
    }

    /**
     * Add a hotspot IP binding (e.g. "bypassed" to skip hotspot login for a known IP/MAC)
     */
    async addHotspotIpBinding(data: {
        address: string
        mac?: string
        type?: 'bypassed' | 'regular' | 'blocked'
        toAddress?: string
        server?: string
        comment?: string
    }): Promise<{
        id: string
        address: string
        mac?: string
        toAddress?: string
        server?: string
        type: 'bypassed' | 'regular' | 'blocked'
        comment?: string
    }> {
        const body: Record<string, string> = {
            address: data.address,
            type: data.type || 'bypassed',
        }
        if (data.mac) body['mac-address'] = data.mac
        if (data.toAddress) body['to-address'] = data.toAddress
        if (data.server) body.server = data.server
        if (data.comment) body.comment = data.comment

        const result = await this.request<HotspotIpBindingRaw>('/ip/hotspot/ip-binding', 'PUT', body)
        console.log(`[MikroTik] Added hotspot IP binding ${data.address} (${data.type || 'bypassed'})`)

        return {
            id: result['.id'],
            address: data.address,
            mac: data.mac,
            toAddress: data.toAddress,
            server: data.server,
            type: data.type || 'bypassed',
            comment: data.comment,
        }
    }

    /**
     * Remove a hotspot IP binding by its RouterOS .id
     */
    async removeHotspotIpBinding(id: string): Promise<void> {
        await this.request(`/ip/hotspot/ip-binding/${encodeURIComponent(id)}`, 'DELETE')
        console.log(`[MikroTik] Removed hotspot IP binding ${id}`)
    }

    /**
     * Convert a dynamic DHCP lease into a static reservation
     */
    async makeDhcpLeaseStatic(id: string): Promise<void> {
        await this.request('/ip/dhcp-server/lease/make-static', 'POST', { '.id': id })
        console.log(`[MikroTik] Converted DHCP lease ${id} to static`)
    }

    /**
     * Create a new static DHCP lease directly
     */
    async addStaticDhcpLease(data: {
        address: string
        mac: string
        server: string
        comment?: string
    }): Promise<{
        id: string
        address: string
        mac: string
        server: string
        status: string
        dynamic: boolean
        comment?: string
    }> {
        const body: Record<string, string> = {
            address: data.address,
            'mac-address': data.mac,
            server: data.server,
        }
        if (data.comment) body.comment = data.comment

        const result = await this.request<DhcpLease>('/ip/dhcp-server/lease', 'PUT', body)
        console.log(`[MikroTik] Added static DHCP lease ${data.address} -> ${data.mac}`)

        return {
            id: result['.id'],
            address: data.address,
            mac: data.mac,
            server: data.server,
            status: 'bound',
            dynamic: false,
            comment: data.comment,
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
            // Get identity
            const identityResult = await this.request<{ name: string }[]>('/system/identity')
            const identity = identityResult[0]?.name

            // Get resource info (model, version)
            const resourceResult = await this.request<{
                'board-name'?: string
                platform?: string
                version?: string
            }[]>('/system/resource')
            const resource = resourceResult[0] || {}
            const model = resource['board-name'] || resource.platform
            const version = resource.version

            // Get interfaces
            const interfacesResult = await this.request<{
                name: string
                type: string
                'mac-address'?: string
                running?: boolean
                disabled?: boolean
            }[]>('/interface')

            const interfaces = interfacesResult.map(iface => ({
                name: iface.name,
                type: iface.type,
                mac: iface['mac-address'],
                running: iface.running === true || String(iface.running) === 'true',
                disabled: iface.disabled === true || String(iface.disabled) === 'true',
            }))

            // Get first ether MAC as main MAC
            const etherInterface = interfacesResult.find(i => i.type === 'ether' && i.name.includes('ether1'))
                || interfacesResult.find(i => i.type === 'ether')
            const mac = etherInterface?.['mac-address']

            // Count ethernet ports
            const etherPorts = interfacesResult.filter(i => i.type === 'ether')
            const portCount = etherPorts.length

            // Get bridges
            let bridges: { name: string; mac?: string }[] = []
            try {
                const bridgesResult = await this.request<{
                    name: string
                    'mac-address'?: string
                }[]>('/interface/bridge')
                bridges = bridgesResult.map(b => ({
                    name: b.name,
                    mac: b['mac-address'],
                }))
            } catch {
                // Bridges might not exist
            }

            // Get VLANs
            let vlans: { name: string; vlanId: number; interface?: string }[] = []
            try {
                const vlansResult = await this.request<{
                    name: string
                    'vlan-id': number
                    interface?: string
                }[]>('/interface/vlan')
                vlans = vlansResult.map(v => ({
                    name: v.name,
                    vlanId: v['vlan-id'],
                    interface: v.interface,
                }))
            } catch {
                // VLANs might not exist on all routers
            }

            console.log(`[MikroTik-v7] Router info: ${identity}, ${portCount} ports, ${bridges.length} bridges, ${vlans.length} VLANs`)

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
            console.error('[MikroTik-v7] Failed to fetch router info:', error)
            return {
                portCount: 0,
                interfaces: [],
                bridges: [],
                vlans: [],
            }
        }
    }
}

// Rename class for clarity
export { MikroTikClient as MikroTikV7Client }
export default MikroTikClient

