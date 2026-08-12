import DigestFetch from 'digest-fetch'
import { XMLParser } from 'fast-xml-parser'
import prisma from './prisma'

export interface HikvisionChannelInfo {
    channelIndex: number
    name?: string
    ipAddress?: string
    managePort?: number
    protocol?: string
    macAddress?: string
    status?: string
    model?: string
    firmware?: string
    rtspUrl?: string
}

export interface HikvisionStorageInfo {
    totalCapacity?: number
    freeCapacity?: number
    usedCapacity?: number
    diskCount?: number
    disks?: {
        id?: number
        name?: string
        capacity?: number
        freeSpace?: number
        status?: string
        property?: string
        type?: string
    }[]
}

export interface HikvisionNetworkInfo {
    ipAddress?: string
    subnetMask?: string
    defaultGateway?: string
    dnsPrimary?: string
    dnsSecondary?: string
    macAddress?: string
    mtu?: number
    mode?: string
    nicName?: string
    nicType?: string
    speed?: string
}

export interface HikvisionTimeInfo {
    timeMode?: string
    localTime?: string
    timeZone?: string
    ntpServer1?: string
    ntpServer2?: string
}

export interface HikvisionRtspInfo {
    enabled?: boolean
    port?: number
    authentication?: string
}

export interface HikvisionDeviceInfo {
    deviceName?: string
    deviceID?: string
    model?: string
    serialNumber?: string
    macAddress?: string
    firmwareVersion?: string
    firmwareReleasedDate?: string
    encoderVersion?: string
    encoderReleasedDate?: string
    deviceType?: string
    telephoneServerIP?: string
}

export interface HikvisionSnapshot {
    info: HikvisionDeviceInfo
    network?: HikvisionNetworkInfo
    time?: HikvisionTimeInfo
    rtsp?: HikvisionRtspInfo
    storage?: HikvisionStorageInfo
    channels: HikvisionChannelInfo[]
    events?: unknown
}

export interface HikvisionConfig {
    id?: string
    name?: string
    host: string
    port: number
    username: string
    password: string
    protocol?: 'http' | 'https'
}

export class HikvisionClient {
    private client: InstanceType<typeof DigestFetch>
    private baseUrl: string

    constructor(config: HikvisionConfig) {
        const protocol = config.protocol === 'https' ? 'https' : 'http'
        const port = config.port || (protocol === 'https' ? 443 : 80)
        this.baseUrl = `${protocol}://${config.host}:${port}`
        this.client = new DigestFetch(config.username, config.password, {
            basic: false,
            algorithm: 'MD5',
        })
    }

    private async request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseUrl}${path}`
        const response = await this.client.fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/xml',
                Accept: 'application/xml',
                ...(options.headers || {}),
            },
        })

        if (!response.ok) {
            const text = await response.text().catch(() => '')
            throw new Error(`Hikvision API error ${response.status}: ${text || response.statusText}`)
        }

        const text = await response.text()
        if (!text) return {} as T

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            parseTagValue: true,
            trimValues: true,
            htmlEntities: true,
        })
        return parser.parse(text) as T
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.request('/ISAPI/System/deviceInfo')
            return true
        } catch {
            return false
        }
    }

    async getDeviceInfo(): Promise<HikvisionDeviceInfo> {
        const data = await this.request<{ DeviceInfo?: Record<string, unknown> }>('/ISAPI/System/deviceInfo')
        const info = data.DeviceInfo || {}
        return {
            deviceName: this.asStr(info.deviceName),
            deviceID: this.asStr(info.deviceID),
            model: this.asStr(info.model),
            serialNumber: this.asStr(info.serialNumber),
            macAddress: this.asStr(info.macAddress),
            firmwareVersion: this.asStr(info.firmwareVersion),
            firmwareReleasedDate: this.asStr(info.firmwareReleasedDate),
            encoderVersion: this.asStr(info.encoderVersion),
            encoderReleasedDate: this.asStr(info.encoderReleasedDate),
            deviceType: this.asStr(info.deviceType),
            telephoneServerIP: this.asStr(info.telephoneServerIP),
        }
    }

    async getNetworkInfo(): Promise<HikvisionNetworkInfo> {
        try {
            const data = await this.request<{ NetworkInterface?: Record<string, unknown> }>('/ISAPI/System/Network/interfaces/1')
            const net = data.NetworkInterface || {}
            const ip = (net.IPAddress || {}) as Record<string, unknown>

            // DNS / Gateway often come as nested objects like { ipAddress: "x.x.x.x" }
            const primaryDns = (net.PrimaryDNS || ip.PrimaryDNS) as Record<string, unknown> | undefined
            const secondaryDns = (net.SecondaryDNS || ip.SecondaryDNS) as Record<string, unknown> | undefined
            const gateway = (net.DefaultGateway || ip.DefaultGateway) as Record<string, unknown> | undefined

            console.log('[Hikvision] Network raw:', JSON.stringify(data).substring(0, 600))

            return {
                ipAddress: this.asStr(ip.ipAddress),
                subnetMask: this.asStr(ip.subnetMask),
                defaultGateway: this.deepIpStr(gateway),
                dnsPrimary: this.deepIpStr(primaryDns),
                dnsSecondary: this.deepIpStr(secondaryDns),
                macAddress: this.asStr(net.MACAddress || net.macAddress),
                mtu: this.asNum(ip.mtu || net.MTU, undefined),
                mode: this.asStr(ip.addressingType || ip.AddressingType || net.mode),
                nicName: this.asStr(net.name || net.NICName),
                nicType: this.asStr(net.nicType || net.NICType),
                speed: this.asStr(net.speed || net.Speed || net.linkSpeed || net.LinkSpeed || ip.speed || ip.Speed || net.duplex || ip.duplex),
            }
        } catch (error) {
            console.error('[Hikvision] Failed to fetch network info:', error)
            return {}
        }
    }

    /** Extract IP from nested DNS/Gateway object like { ipAddress: "x.x.x.x" } */
    private deepIpStr(obj: Record<string, unknown> | undefined): string | undefined {
        if (!obj) return undefined
        return this.asStr(obj.ipAddress || obj.IPAddress || obj.address || obj.value)
    }

    async getTimeInfo(): Promise<HikvisionTimeInfo> {
        try {
            const data = await this.request<{ Time?: Record<string, unknown> }>('/ISAPI/System/time')
            const t = data.Time || {}
            return {
                timeMode: this.asStr(t.timeMode || t.TimeMode || t.mode),
                localTime: this.asStr(t.localTime || t.LocalTime),
                timeZone: this.asStr(t.timeZone || t.TimeZone),
                ntpServer1: this.asStr(t.NTP || t.ntpServer || t.NTPServer1),
                ntpServer2: this.asStr(t.NTPServer2 || t.ntpServer2),
            }
        } catch (error) {
            console.error('[Hikvision] Failed to fetch time info:', error)
            return {}
        }
    }

    async getRtspInfo(): Promise<HikvisionRtspInfo> {
        try {
            const data = await this.request<{ RTSP?: Record<string, unknown> }>('/ISAPI/Streaming/channels')
            const rtsp = data.RTSP || {}
            return {
                enabled: this.asBool(rtsp.enabled || rtsp.Enabled, undefined),
                port: this.asNum(rtsp.port || rtsp.Port, 554),
                authentication: this.asStr(rtsp.authentication || rtsp.Authentication || rtsp.auth || rtsp.Auth) || 'digest/basic',
            }
        } catch {
            return {}
        }
    }

    async getStorage(): Promise<HikvisionStorageInfo> {
        try {
            const data = await this.request<{ storage?: { hddList?: { hdd?: unknown[] | unknown }; hddCount?: unknown } }>('/ISAPI/ContentMgmt/Storage')
            const storage = data.storage || {}
            let disks: HikvisionStorageInfo['disks'] = []
            let totalGigabytes = 0
            let freeGigabytes = 0
            const hddList = storage.hddList?.hdd
            if (hddList) {
                const list = Array.isArray(hddList) ? hddList : [hddList]
                disks = list.map((d) => {
                    const disk = d as Record<string, unknown>
                    const capacity = this.asGigabytes(disk.capacity)
                    const free = this.asGigabytes(disk.freeSpace)
                    totalGigabytes += capacity
                    freeGigabytes += free
                    return {
                        id: this.asNum(disk.id || disk.hddIndex, 0),
                        name: this.asStr(disk.hddName || disk.name),
                        capacity,
                        freeSpace: free,
                        status: this.asStr(disk.status),
                        property: this.asStr(disk.property),
                        type: this.asStr(disk.type),
                    }
                })
            }
            return {
                totalCapacity: totalGigabytes > 0 ? Math.round(totalGigabytes * 100) / 100 : undefined,
                freeCapacity: freeGigabytes > 0 ? Math.round(freeGigabytes * 100) / 100 : undefined,
                usedCapacity: totalGigabytes > 0 ? Math.round((totalGigabytes - freeGigabytes) * 100) / 100 : undefined,
                diskCount: disks.length > 0 ? disks.length : undefined,
                disks: disks.length > 0 ? disks : undefined,
            }
        } catch (error) {
            console.error('[Hikvision] Failed to fetch storage info:', error)
            return {}
        }
    }

    async getChannels(): Promise<HikvisionChannelInfo[]> {
        const endpoints = [
            '/ISAPI/ContentMgmt/InputProxy/channels',
            '/ISAPI/System/Video/inputs/channels',
        ]
        for (const endpoint of endpoints) {
            try {
                const data = await this.request<{
                    InputProxyChannelList?: { InputProxyChannel?: unknown[] | unknown }
                    VideoInputChannelList?: { VideoInputChannel?: unknown[] | unknown }
                }>(endpoint)

                const raw = data.InputProxyChannelList?.InputProxyChannel || data.VideoInputChannelList?.VideoInputChannel
                if (!raw) continue

                const list = Array.isArray(raw) ? raw : [raw]
                const channels = list.map((item, idx) => this.parseChannel(item, idx + 1))
                console.log(`[Hikvision] ${endpoint} -> ${channels.length} channels`)
                return channels
            } catch {
                // try next endpoint
            }
        }
        return []
    }

    private parseChannel(item: unknown, fallbackIndex: number): HikvisionChannelInfo {
        const ch = (item || {}) as Record<string, unknown>
        const descriptor = (ch.sourceInputPortDescriptor || ch.SourceInputPortDescriptor || {}) as Record<string, unknown>
        const portDescriptor = (ch.portDescriptor || ch.PortDescriptor || {}) as Record<string, unknown>

        const managePort = this.asNum(
            descriptor.managePortNo || descriptor.ManagePortNo
            || portDescriptor.managePortNo || portDescriptor.ManagePortNo
            || ch.managePortNo || ch.ManagePortNo, 80,
        )

        const rawProtocol = this.asStr(
            descriptor.protocol || descriptor.Protocol
            || portDescriptor.protocol || portDescriptor.Protocol
            || descriptor.transmissionProtocol || descriptor.TransmissionProtocol
            || portDescriptor.transmissionProtocol || portDescriptor.TransmissionProtocol,
        )

        const ip = this.asStr(
            descriptor.ipAddress || descriptor.IpAddress
            || portDescriptor.ipAddress || portDescriptor.IpAddress
            || ch.ipAddress || ch.IpAddress,
        )

        let rtspUrl: string | undefined
        if (ip) {
            rtspUrl = `rtsp://${ip}:554/Streaming/Channels/${String(fallbackIndex).padStart(2, '0')}1`
        }

        return {
            channelIndex: this.asNum(ch.id || ch.channelIndex || ch.ChannelIndex, fallbackIndex),
            name: this.asStr(ch.name || ch.channelName || ch.ChannelName),
            ipAddress: ip,
            managePort,
            protocol: rawProtocol || this.detectProtocolFromPort(managePort),
            macAddress: this.asStr(ch.macAddress || ch.MacAddress || ch.mac || ch.MAC),
            status: this.inferStatus(ch),
            model: this.asStr(ch.model || ch.Model || ch.deviceModel || ch.DeviceModel),
            firmware: this.asStr(ch.firmwareVersion || ch.FirmwareVersion || ch.firmware || ch.Firmware),
            rtspUrl,
        }
    }

    async getEventInfo(): Promise<unknown> {
        try {
            const data = await this.request<Record<string, unknown>>('/ISAPI/Event/notification/eventRecord')
            console.log('[Hikvision] Event info fetched')
            return data
        } catch (error) {
            console.error('[Hikvision] Failed to fetch event info:', error)
            return null
        }
    }

    async getFullSnapshot(): Promise<HikvisionSnapshot> {
        const [info, network, time, rtsp, storage, channels, events] = await Promise.all([
            this.getDeviceInfo(),
            this.getNetworkInfo(),
            this.getTimeInfo(),
            this.getRtspInfo(),
            this.getStorage(),
            this.getChannels(),
            this.getEventInfo(),
        ])
        return { info, network, time, rtsp, storage, channels, events }
    }

    private detectProtocolFromPort(port: number): string | undefined {
        switch (port) {
            case 8000: return 'HIKVISION'
            case 80: return 'ONVIF'
            case 554: return 'RTSP'
            case 443: return 'HTTPS/ONVIF'
            case 37777: return 'HIKVISION'
            default: return undefined
        }
    }

    private inferStatus(ch: Record<string, unknown>): string {
        const status = this.asStr(ch.ChanStatus || ch.chanStatus || ch.status || ch.Status || ch.streamingProxyStatus || ch.online || ch.Online)
        if (status === 'online' || status === 'true' || status === '1') return 'ONLINE'
        if (status === 'offline' || status === 'false' || status === '0') return 'OFFLINE'
        const ip = this.asStr((ch.sourceInputPortDescriptor || ch.SourceInputPortDescriptor || {}) as Record<string, unknown>)
        if (ip) return 'ONLINE'
        return 'UNKNOWN'
    }

    private asStr(value: unknown): string | undefined {
        if (value === undefined || value === null) return undefined
        if (typeof value === 'object') {
            // XML parser wraps text in { "#text": "value" }
            if ('#text' in (value as object)) {
                return this.asStr((value as Record<string, unknown>)['#text'])
            }
            // Nested DNS/Gateway object like { ipAddress: "x.x.x.x" }
            const obj = value as Record<string, unknown>
            const nested = obj.ipAddress || obj.IPAddress || obj.address || obj.value
            if (nested !== undefined) return this.asStr(nested)
            // Fallback: pick any string-ish key
            for (const key of Object.keys(obj)) {
                if (typeof obj[key] === 'string') return obj[key] as string
            }
            return undefined
        }
        return String(value)
    }

    private asNum(value: unknown, fallback: number | undefined): number | undefined {
        if (value === undefined || value === null) return fallback
        if (typeof value === 'object' && '#text' in (value as object)) {
            return this.asNum((value as Record<string, unknown>)['#text'], fallback)
        }
        const parsed = Number(value)
        return Number.isNaN(parsed) ? fallback : parsed
    }

    private asBool(value: unknown, fallback: boolean | undefined): boolean | undefined {
        if (value === undefined || value === null) return fallback
        const s = this.asStr(value)
        if (s === 'true' || s === '1' || s === 'yes') return true
        if (s === 'false' || s === '0' || s === 'no') return false
        return fallback
    }

    private asGigabytes(value: unknown): number {
        const str = this.asStr(value)
        if (!str) return 0
        const match = str.match(/^(\d+(?:\.\d+)?)\s*(TB|GB|MB|KB)?$/i)
        if (!match) return 0
        const num = parseFloat(match[1])
        switch ((match[2] || 'GB').toUpperCase()) {
            case 'TB': return num * 1024
            case 'GB': return num
            case 'MB': return num / 1024
            case 'KB': return num / (1024 * 1024)
            default: return num
        }
    }
}

export async function createHikvisionClientById(id: string): Promise<HikvisionClient | null> {
    const device = await prisma.hikvisionDevice.findUnique({ where: { id } })
    if (!device) return null
    return new HikvisionClient({
        host: device.host,
        port: device.port,
        username: device.username,
        password: device.password,
        protocol: (device.protocol as 'http' | 'https') || 'http',
    })
}
