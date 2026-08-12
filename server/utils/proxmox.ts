/**
 * Proxmox VE REST API Client
 *
 * Auth: PVEAPIToken=<user>!<token-name>=<secret>
 * All responses are JSON -- no XML parsing needed.
 */

import prisma from './prisma'
import https from 'node:https'
import http from 'node:http'

export interface ProxmoxNodeStatus {
    name: string
    status: string // online / offline
    cpu?: string
    maxCpu?: number
    mem?: number // total MB
    memUsed?: number
    uptime?: number // seconds
}

export interface ProxmoxGuest {
    vmid: number
    name: string
    type: 'qemu' | 'lxc'
    status: string
    node: string
    cpu?: number
    mem?: number
    maxMem?: number
    maxDisk?: number
    ipAddress?: string
    macAddress?: string
    networks?: { name: string; ip?: string; mac?: string }[]
}

export interface ProxmoxStorageInfo {
    storage: string
    type: string
    total: number // bytes
    used: number
    node: string
    active?: number
    avail?: number
}

export interface ProxmoxNetworkInfo {
    iface: string
    type: string
    address?: string
    netmask?: string
    active?: boolean
    node: string
}

export interface ProxmoxBackupInfo {
    volid: string
    size: number
    vmid: number
    format: string
    storage: string
    node: string
}

export interface ProxmoxSnapshot {
    nodes: ProxmoxNodeStatus[]
    virtualGuests: ProxmoxGuest[]
    storages: ProxmoxStorageInfo[]
    network: ProxmoxNetworkInfo[]
    backups: ProxmoxBackupInfo[]
}

export interface ProxmoxConfig {
    id?: string
    name?: string
    host: string
    port: number
    token: string // "user@realm!token-name=secret"
}

export class ProxmoxClient {
    private baseUrl: string
    private authHeader: string

    constructor(config: ProxmoxConfig) {
        const port = config.port || 8006
        this.baseUrl = `https://${config.host}:${port}/api2/json`
        this.authHeader = `PVEAPIToken=${config.token}`
    }

    private async request<T = unknown>(path: string): Promise<T> {
        const url = `${this.baseUrl}${path}`
        const parsedUrl = new URL(url)
        const isHttps = parsedUrl.protocol === 'https:'

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                Authorization: this.authHeader,
                Accept: 'application/json',
            },
            rejectUnauthorized: false,
        }

        const body = await new Promise<string>((resolve, reject) => {
            const mod = isHttps ? https : http
            const req = mod.request(options, (res) => {
                let data = ''
                res.on('data', (chunk: Buffer) => { data += chunk.toString() })
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data)
                    } else {
                        reject(new Error(`Proxmox API error ${res.statusCode}: ${data.substring(0, 500)}`))
                    }
                })
            })
            req.on('error', reject)
            req.setTimeout(15000, () => {
                req.destroy()
                reject(new Error('Proxmox API timeout (15s)'))
            })
            req.end()
        })

        const json = JSON.parse(body)
        return (json.data || json) as T
    }

    // ── Connection ────────────────────────────────────────

    async testConnection(): Promise<boolean> {
        try {
            await this.request('/nodes')
            return true
        } catch (err) {
            console.error('[Proxmox] testConnection failed:', (err as Error).message)
            return false
        }
    }

    // ── Nodes ─────────────────────────────────────────────

    async getNodes(): Promise<ProxmoxNodeStatus[]> {
        const nodes = await this.request<Array<Record<string, unknown>>>('/nodes')
        return nodes.map((n) => ({
            name: String(n.node || n.name || ''),
            status: String(n.status || 'unknown'),
            cpu: String(n.cpu || n.maxcpu || ''),
            maxCpu: Number(n.maxcpu || 0),
            mem: Number(n.mem || n.maxmem || 0),
            memUsed: Number(n.mem || 0) - Number(n.maxmem || 0) > 0 ? Number(n.mem || 0) - Number(n.maxmem || 0) : undefined,
            uptime: Number(n.uptime || 0),
        }))
    }

    // ── VMs ───────────────────────────────────────────────

    async getVMs(node: string): Promise<ProxmoxGuest[]> {
        const vms = await this.request<Array<Record<string, unknown>>>(`/nodes/${node}/qemu`)
        return vms.map((v) => ({
            vmid: Number(v.vmid),
            name: String(v.name || ''),
            type: 'qemu' as const,
            status: String(v.status || 'unknown'),
            node,
            cpu: Number(v.cpus || 0),
            mem: Number(v.mem || 0),
            maxMem: Number(v.maxmem || 0),
            maxDisk: Number(v.maxdisk || 0),
        }))
    }

    // ── LXCs ──────────────────────────────────────────────

    async getLXCs(node: string): Promise<ProxmoxGuest[]> {
        try {
            const lxcs = await this.request<Array<Record<string, unknown>>>(`/nodes/${node}/lxc`)
            return lxcs.map((c) => ({
                vmid: Number(c.vmid),
                name: String(c.name || ''),
                type: 'lxc' as const,
                status: String(c.status || 'unknown'),
                node,
                cpu: Number(c.cpus || 0),
                mem: Number(c.mem || 0),
                maxMem: Number(c.maxmem || 0),
                maxDisk: Number(c.maxdisk || 0),
            }))
        } catch {
            return []
        }
    }

    // ── Guest config (network info) ──────────────────────

    async getGuestConfig(node: string, vmid: number, guestType: 'qemu' | 'lxc'): Promise<Record<string, unknown>> {
        try {
            const typePath = guestType === 'qemu' ? 'qemu' : 'lxc'
            return await this.request<Record<string, unknown>>(`/nodes/${node}/${typePath}/${vmid}/config`)
        } catch {
            return {}
        }
    }

    // ── Storage ───────────────────────────────────────────

    async getStorage(node: string): Promise<ProxmoxStorageInfo[]> {
        const storages = await this.request<Array<Record<string, unknown>>>(`/nodes/${node}/storage`)
        return storages.map((s) => ({
            storage: String(s.storage || ''),
            type: String(s.type || ''),
            total: Number(s.total || 0),
            used: Number(s.used || 0),
            node,
            active: Number(s.active || 0),
            avail: Number(s.avail || 0),
        }))
    }

    // ── Network ──────────────────────────────────────────

    async getNetwork(node: string): Promise<ProxmoxNetworkInfo[]> {
        try {
            const nets = await this.request<Array<Record<string, unknown>>>(`/nodes/${node}/network`)
            return nets.map((n) => ({
                iface: String(n.iface || ''),
                type: String(n.type || ''),
                address: String(n.address || n.cidr || ''),
                netmask: String(n.netmask || ''),
                active: n.active === 1 || n.active === true,
                node,
            }))
        } catch {
            return []
        }
    }

    // ── Backups ──────────────────────────────────────────

    async getBackups(node: string): Promise<ProxmoxBackupInfo[]> {
        try {
            const storages = await this.request<Array<Record<string, unknown>>>(`/nodes/${node}/storage`)
            const backups: ProxmoxBackupInfo[] = []

            for (const s of storages) {
                const storageName = String(s.storage || '')
                if (!storageName) continue
                try {
                    const content = await this.request<Array<Record<string, unknown>>>(
                        `/nodes/${node}/storage/${storageName}/content?content=backup`,
                    )
                    for (const b of content) {
                        backups.push({
                            volid: String(b.volid || ''),
                            size: Number(b.size || 0),
                            vmid: Number(b.vmid || 0),
                            format: String(b.format || ''),
                            storage: storageName,
                            node,
                        })
                    }
                } catch {
                    // skip storages that don't support backups
                }
            }

            return backups
        } catch {
            return []
        }
    }

    // ── Full Snapshot ─────────────────────────────────────

    async getFullSnapshot(): Promise<ProxmoxSnapshot> {
        const nodes = await this.getNodes()
        const onlineNodes = nodes.filter((n) => n.status === 'online')

        const virtualGuests: ProxmoxGuest[] = []
        const storages: ProxmoxStorageInfo[] = []
        const networks: ProxmoxNetworkInfo[] = []
        const backups: ProxmoxBackupInfo[] = []

        for (const node of onlineNodes) {
            const nodeName = node.name
            const [vms, lxcs, storageList, netList, backupList] = await Promise.all([
                this.getVMs(nodeName),
                this.getLXCs(nodeName),
                this.getStorage(nodeName),
                this.getNetwork(nodeName),
                this.getBackups(nodeName),
            ])

            // Enrich VMs and LXCs with network/IP info
            const allGuests = [...vms, ...lxcs]
            for (const guest of allGuests) {
                try {
                    const config = await this.getGuestConfig(nodeName, guest.vmid, guest.type)
                    const ips: string[] = []
                    const networks: { name: string; ip?: string; mac?: string }[] = []

                    for (const [key, value] of Object.entries(config)) {
                        if (key.startsWith('net') && typeof value === 'string') {
                            // net0: e1000=XX:XX:XX:XX:XX:XX,bridge=vmbr0,firewall=1
                            // or ip=192.168.1.5/24,gw=192.168.1.1
                            const macMatch = value.match(/macaddr=([A-Fa-f0-9:]+)/) || value.match(/([A-Fa-f0-9]{2}:[A-Fa-f0-9]{2}:[A-Fa-f0-9]{2}:[A-Fa-f0-9]{2}:[A-Fa-f0-9]{2}:[A-Fa-f0-9]{2})/)
                            const ipMatch = value.match(/ip=([0-9.]+)(?:\/([0-9]+))?/)
                            const ifName = key

                            networks.push({
                                name: ifName,
                                ip: ipMatch ? ipMatch[1] : undefined,
                                mac: macMatch ? macMatch[1] : undefined,
                            })

                            if (ipMatch) ips.push(ipMatch[1])
                            if (macMatch && !guest.macAddress) guest.macAddress = macMatch[1]
                        }
                    }

                    guest.networks = networks
                    if (ips.length > 0 && !guest.ipAddress) guest.ipAddress = ips[0]
                } catch {
                    // skip guest config fetch errors
                }
            }

            virtualGuests.push(...allGuests)
            storages.push(...storageList)
            networks.push(...netList)
            backups.push(...backupList)
        }

        return { nodes, virtualGuests, storages, network: networks, backups }
    }
}

export async function createProxmoxClientById(id: string): Promise<ProxmoxClient | null> {
    const device = await prisma.proxmoxNode.findUnique({ where: { id } })
    if (!device) return null
    return new ProxmoxClient({
        host: device.host,
        port: device.port,
        token: device.token,
    })
}
