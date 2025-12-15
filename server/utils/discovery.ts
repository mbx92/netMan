import { exec } from 'child_process'
import { promisify } from 'util'
import * as net from 'net'
import * as dns from 'dns'

const execAsync = promisify(exec)
const dnsReverse = promisify(dns.reverse)

// Define discovered device interface
export interface DiscoveredDevice {
    ip: string
    hostname?: string
    mac?: string
    deviceType: string
    brand?: string          // Device brand/vendor if detected
    openPorts: number[]
    responseTime?: number
    status: 'alive' | 'unreachable'
}

// Common ports to scan for device type detection
const COMMON_PORTS = {
    SSH: 22,
    TELNET: 23,
    FTP: 21,
    RDP: 3389,
    VNC: 5900,
    HTTP: 80,
    HTTPS: 443,
    SNMP: 161,
    // Printer ports
    PRINTER_IPP: 631,
    PRINTER_RAW: 9100,
    PRINTER_LPD: 515,
    // SMB/NetBIOS
    SMB: 445,
    NETBIOS: 139,
    // MikroTik
    MIKROTIK_API: 8728,
    MIKROTIK_WINBOX: 8291,
    MIKROTIK_API_SSL: 1709,
    // NAS
    SYNOLOGY_HTTP: 5000,
    SYNOLOGY_HTTPS: 5001,
    QNAP_HTTP: 8080,
    QNAP_HTTPS: 8443,
    // Virtualization
    PROXMOX_WEB: 8006,
    VMWARE_ESXI: 902,
    VMWARE_VCENTER: 9443,
    // Network Equipment
    UBIQUITI_HTTP: 8443,
    FORTIGATE_HTTP: 10443,
    CISCO_HTTPS: 4443,
    // Cameras
    RTSP: 554,
    ONVIF: 8899,
    HIKVISION: 8000,
    DAHUA_HTTP: 37777,
    // Smart TV / Media
    CHROMECAST: 8008,
    ROKU: 8060,
    PLEX: 32400,
}

// Device fingerprints - each fingerprint has required ports and optional ports
interface DeviceFingerprint {
    type: string
    brand?: string
    requiredPorts: number[]
    optionalPorts?: number[]
    excludePorts?: number[]  // If these ports exist, it's NOT this device
    priority: number  // Higher priority = checked first
}

const DEVICE_FINGERPRINTS: DeviceFingerprint[] = [
    // === NETWORK EQUIPMENT (highest priority) ===
    {
        type: 'ROUTER',
        brand: 'MikroTik',
        requiredPorts: [],  // At least one of optionalPorts must be present
        optionalPorts: [COMMON_PORTS.MIKROTIK_API, COMMON_PORTS.MIKROTIK_WINBOX, COMMON_PORTS.MIKROTIK_API_SSL],
        priority: 100,
    },
    {
        type: 'ACCESS_POINT',
        brand: 'Ubiquiti',
        requiredPorts: [COMMON_PORTS.UBIQUITI_HTTP],
        optionalPorts: [COMMON_PORTS.SSH],
        priority: 95,
    },
    {
        type: 'ROUTER',
        brand: 'Fortinet',
        requiredPorts: [COMMON_PORTS.FORTIGATE_HTTP],
        priority: 95,
    },

    // === NAS DEVICES ===
    {
        type: 'NAS',
        brand: 'Synology',
        requiredPorts: [COMMON_PORTS.SYNOLOGY_HTTP],
        optionalPorts: [COMMON_PORTS.SYNOLOGY_HTTPS, COMMON_PORTS.SSH, COMMON_PORTS.SMB],
        priority: 90,
    },
    {
        type: 'NAS',
        brand: 'Synology',
        requiredPorts: [COMMON_PORTS.SYNOLOGY_HTTPS],
        optionalPorts: [COMMON_PORTS.SSH, COMMON_PORTS.SMB],
        priority: 90,
    },
    {
        type: 'NAS',
        brand: 'QNAP',
        requiredPorts: [COMMON_PORTS.QNAP_HTTP],
        optionalPorts: [COMMON_PORTS.QNAP_HTTPS, COMMON_PORTS.SSH, COMMON_PORTS.SMB],
        priority: 90,
    },

    // === VIRTUALIZATION ===
    {
        type: 'SERVER_LINUX',
        brand: 'Proxmox',
        requiredPorts: [COMMON_PORTS.PROXMOX_WEB],
        optionalPorts: [COMMON_PORTS.SSH],
        priority: 85,
    },
    {
        type: 'SERVER_LINUX',
        brand: 'VMware ESXi',
        requiredPorts: [COMMON_PORTS.VMWARE_ESXI],
        optionalPorts: [COMMON_PORTS.HTTPS],
        priority: 85,
    },

    // === CAMERAS / IOT ===
    {
        type: 'CAMERA',
        brand: 'Hikvision',
        requiredPorts: [COMMON_PORTS.HIKVISION],
        optionalPorts: [COMMON_PORTS.RTSP, COMMON_PORTS.ONVIF, COMMON_PORTS.HTTP],
        priority: 80,
    },
    {
        type: 'CAMERA',
        brand: 'Dahua',
        requiredPorts: [COMMON_PORTS.DAHUA_HTTP],
        optionalPorts: [COMMON_PORTS.RTSP, COMMON_PORTS.HTTP],
        priority: 80,
    },
    {
        type: 'CAMERA',
        brand: 'Generic IP Camera',
        requiredPorts: [COMMON_PORTS.RTSP],
        optionalPorts: [COMMON_PORTS.ONVIF, COMMON_PORTS.HTTP],
        excludePorts: [COMMON_PORTS.RDP, COMMON_PORTS.SMB],  // Not a Windows PC streaming
        priority: 75,
    },

    // === SMART TV / MEDIA ===
    {
        type: 'SMART_TV',
        brand: 'Chromecast',
        requiredPorts: [COMMON_PORTS.CHROMECAST],
        priority: 72,
    },
    {
        type: 'SMART_TV',
        brand: 'Roku',
        requiredPorts: [COMMON_PORTS.ROKU],
        priority: 72,
    },
    {
        type: 'MEDIA_SERVER',
        brand: 'Plex',
        requiredPorts: [COMMON_PORTS.PLEX],
        optionalPorts: [COMMON_PORTS.HTTP],
        priority: 72,
    },

    // === PRINTERS ===
    {
        type: 'PRINTER',
        requiredPorts: [COMMON_PORTS.PRINTER_RAW],
        optionalPorts: [COMMON_PORTS.PRINTER_IPP, COMMON_PORTS.HTTP, COMMON_PORTS.PRINTER_LPD],
        priority: 70,
    },
    {
        type: 'PRINTER',
        requiredPorts: [COMMON_PORTS.PRINTER_IPP],
        optionalPorts: [COMMON_PORTS.HTTP],
        priority: 65,
    },

    // === COMPUTERS ===
    {
        type: 'PC_WINDOWS',
        requiredPorts: [COMMON_PORTS.RDP],
        optionalPorts: [COMMON_PORTS.SMB, COMMON_PORTS.NETBIOS],
        priority: 60,
    },
    {
        type: 'PC_WINDOWS',
        requiredPorts: [COMMON_PORTS.SMB, COMMON_PORTS.NETBIOS],
        excludePorts: [COMMON_PORTS.SYNOLOGY_HTTP, COMMON_PORTS.SYNOLOGY_HTTPS, COMMON_PORTS.QNAP_HTTP],  // Not a NAS
        priority: 55,
    },
    {
        type: 'SERVER_LINUX',
        requiredPorts: [COMMON_PORTS.SSH],
        optionalPorts: [COMMON_PORTS.HTTP, COMMON_PORTS.HTTPS],
        excludePorts: [COMMON_PORTS.RDP],  // Not Windows
        priority: 50,
    },
    {
        type: 'PC_LINUX',
        requiredPorts: [COMMON_PORTS.SSH],
        excludePorts: [COMMON_PORTS.RDP, COMMON_PORTS.HTTP, COMMON_PORTS.HTTPS],
        priority: 45,
    },

    // === NETWORK EQUIPMENT (fallback) ===
    {
        type: 'SWITCH',
        requiredPorts: [COMMON_PORTS.SNMP],
        excludePorts: [COMMON_PORTS.RDP, COMMON_PORTS.SSH],  // Pure SNMP device
        priority: 40,
    },
    {
        type: 'ROUTER',
        requiredPorts: [COMMON_PORTS.SNMP, COMMON_PORTS.TELNET],
        priority: 40,
    },
]

// MAC OUI Database - Common vendor prefixes (first 6 characters of MAC)
// Format: normalized MAC prefix (lowercase, no separators) -> { vendor, deviceHint }
interface MacVendorInfo {
    vendor: string
    deviceHint?: string  // Hint about device type if known from this vendor
}

const MAC_OUI_DATABASE: Record<string, MacVendorInfo> = {
    // === NAS VENDORS ===
    '0011320': { vendor: 'Synology', deviceHint: 'NAS' },
    '001132': { vendor: 'Synology', deviceHint: 'NAS' },
    '0090a9': { vendor: 'QNAP', deviceHint: 'NAS' },
    'b827eb': { vendor: 'QNAP', deviceHint: 'NAS' },

    // === NETWORK EQUIPMENT ===
    // MikroTik
    'd4ca6d': { vendor: 'MikroTik', deviceHint: 'ROUTER' },
    '4c5e0c': { vendor: 'MikroTik', deviceHint: 'ROUTER' },
    'e48d8c': { vendor: 'MikroTik', deviceHint: 'ROUTER' },
    '6c3b6b': { vendor: 'MikroTik', deviceHint: 'ROUTER' },
    'cc2de0': { vendor: 'MikroTik', deviceHint: 'ROUTER' },
    '48a98a': { vendor: 'MikroTik', deviceHint: 'ROUTER' },
    '2cc8e0': { vendor: 'MikroTik', deviceHint: 'ROUTER' },
    'b8fbaf': { vendor: 'MikroTik', deviceHint: 'ROUTER' },

    // Cisco
    '000c29': { vendor: 'VMware', deviceHint: 'SERVER_LINUX' },
    '005056': { vendor: 'VMware', deviceHint: 'SERVER_LINUX' },
    '0050c2': { vendor: 'Cisco' },
    '000c85': { vendor: 'Cisco' },
    '0023eb': { vendor: 'Cisco' },
    '0025b5': { vendor: 'Cisco' },
    '002255': { vendor: 'Cisco' },

    // Ubiquiti
    '802aa8': { vendor: 'Ubiquiti', deviceHint: 'ACCESS_POINT' },
    '24a43c': { vendor: 'Ubiquiti', deviceHint: 'ACCESS_POINT' },
    'f09fc2': { vendor: 'Ubiquiti', deviceHint: 'ACCESS_POINT' },
    '44d9e7': { vendor: 'Ubiquiti', deviceHint: 'ACCESS_POINT' },
    'dc9fdb': { vendor: 'Ubiquiti', deviceHint: 'ACCESS_POINT' },
    '68d79a': { vendor: 'Ubiquiti', deviceHint: 'ACCESS_POINT' },
    'b4fbe4': { vendor: 'Ubiquiti', deviceHint: 'ACCESS_POINT' },

    // TP-Link
    '6c5cb1': { vendor: 'TP-Link' },
    '98ded0': { vendor: 'TP-Link' },
    'c0e42d': { vendor: 'TP-Link' },
    '5067f0': { vendor: 'TP-Link' },
    '6466b3': { vendor: 'TP-Link' },

    // D-Link
    '1cbdb9': { vendor: 'D-Link' },
    'b8a386': { vendor: 'D-Link' },
    '908d78': { vendor: 'D-Link' },

    // Aruba/HPE
    '000b86': { vendor: 'Aruba', deviceHint: 'ACCESS_POINT' },
    '24de9a': { vendor: 'Aruba', deviceHint: 'ACCESS_POINT' },
    '94b40f': { vendor: 'Aruba', deviceHint: 'ACCESS_POINT' },

    // === PC VENDORS ===
    // HP
    '3c4a92': { vendor: 'HP' },
    '1062eb': { vendor: 'HP' },
    '308d99': { vendor: 'HP' },
    '2c44fd': { vendor: 'HP' },
    '9cebe8': { vendor: 'HP' },

    // Dell
    'f48e38': { vendor: 'Dell' },
    '18db94': { vendor: 'Dell' },
    '246e96': { vendor: 'Dell' },
    '149d09': { vendor: 'Dell' },
    'd4be d9': { vendor: 'Dell' },

    // Lenovo
    '988389': { vendor: 'Lenovo' },
    '7c7a91': { vendor: 'Lenovo' },
    'e8b2ac': { vendor: 'Lenovo' },
    '8cec4b': { vendor: 'Lenovo' },

    // ASUS
    '2c4d54': { vendor: 'ASUS' },
    '04d9f5': { vendor: 'ASUS' },
    '40b076': { vendor: 'ASUS' },
    '74d02b': { vendor: 'ASUS' },

    // Intel (common in PCs)
    '3c970e': { vendor: 'Intel' },
    '48a472': { vendor: 'Intel' },
    '3497f6': { vendor: 'Intel' },
    'a0369f': { vendor: 'Intel' },

    // === MOBILE/CONSUMER ===
    // Apple
    '3c22fb': { vendor: 'Apple' },
    'a8667f': { vendor: 'Apple' },
    '38c986': { vendor: 'Apple' },
    'f0d5bf': { vendor: 'Apple' },
    '70cd60': { vendor: 'Apple' },

    // Samsung
    'f41b46': { vendor: 'Samsung' },
    '9852b1': { vendor: 'Samsung' },
    'f8d0ac': { vendor: 'Samsung' },

    // === CAMERAS / IOT ===
    // Hikvision
    'c0568d': { vendor: 'Hikvision', deviceHint: 'CAMERA' },
    '44192c': { vendor: 'Hikvision', deviceHint: 'CAMERA' },
    'a0bd1d': { vendor: 'Hikvision', deviceHint: 'CAMERA' },
    'bc3400': { vendor: 'Hikvision', deviceHint: 'CAMERA' },

    // Dahua
    'e0509e': { vendor: 'Dahua', deviceHint: 'CAMERA' },
    '3c8cf8': { vendor: 'Dahua', deviceHint: 'CAMERA' },
    'b0a37f': { vendor: 'Dahua', deviceHint: 'CAMERA' },  // Changed from a0bd1d (duplicate)

    // Axis
    'accc8e': { vendor: 'Axis', deviceHint: 'CAMERA' },
    '0001c5': { vendor: 'Axis', deviceHint: 'CAMERA' },

    // === PRINTERS ===
    '002590': { vendor: 'Epson', deviceHint: 'PRINTER' },
    '440444': { vendor: 'Epson', deviceHint: 'PRINTER' },
    '002515': { vendor: 'Canon', deviceHint: 'PRINTER' },
    'e4e749': { vendor: 'Canon', deviceHint: 'PRINTER' },
    '001599': { vendor: 'Brother', deviceHint: 'PRINTER' },
    '3c2af4': { vendor: 'Brother', deviceHint: 'PRINTER' },

    // === VIRTUALIZATION ===
    // Note: VMware prefixes 000c29 and 005056 defined earlier under Cisco section
    '080027': { vendor: 'VirtualBox', deviceHint: 'OTHER' },
    '525400': { vendor: 'QEMU/KVM', deviceHint: 'SERVER_LINUX' },
    '00163e': { vendor: 'Xen', deviceHint: 'SERVER_LINUX' },

    // === SMART TV ===
    '8c79f5': { vendor: 'Samsung TV', deviceHint: 'SMART_TV' },
    '74e5f9': { vendor: 'LG TV', deviceHint: 'SMART_TV' },
    '38f889': { vendor: 'Sony TV', deviceHint: 'SMART_TV' },
}

/**
 * Lookup vendor information from MAC address
 */
export function lookupMacVendor(mac: string | undefined): MacVendorInfo | undefined {
    if (!mac) return undefined

    // Normalize MAC: lowercase, remove separators
    const normalized = mac.toLowerCase().replace(/[:-]/g, '')

    // Try matching 6-char prefix (OUI)
    const prefix6 = normalized.substring(0, 6)
    if (MAC_OUI_DATABASE[prefix6]) {
        return MAC_OUI_DATABASE[prefix6]
    }

    // Try matching 7-char prefix (some vendors use longer)
    const prefix7 = normalized.substring(0, 7)
    if (MAC_OUI_DATABASE[prefix7]) {
        return MAC_OUI_DATABASE[prefix7]
    }

    return undefined
}

/**
 * Check if host is alive via TCP connection (fallback when ICMP is blocked)
 */
export async function checkTcpAlive(ip: string, port: number, timeout = 2000): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket()

        socket.setTimeout(timeout)

        socket.on('connect', () => {
            socket.destroy()
            resolve(true)
        })

        socket.on('timeout', () => {
            socket.destroy()
            resolve(false)
        })

        socket.on('error', () => {
            socket.destroy()
            resolve(false)
        })

        try {
            socket.connect(port, ip)
        } catch {
            resolve(false)
        }
    })
}

/**
 * Ping a single host to check if it's alive
 * Uses ICMP ping only - more reliable than TCP for host detection
 */
export async function pingHost(ip: string, timeout = 2000): Promise<{ alive: boolean; responseTime?: number }> {
    try {
        const isWindows = process.platform === 'win32'
        // Windows: -w is in milliseconds, Linux: -W is in seconds
        const pingCmd = isWindows
            ? `ping -n 1 -w ${timeout} ${ip}`
            : `ping -c 1 -W ${Math.ceil(timeout / 1000)} ${ip}`

        const startTime = Date.now()
        const { stdout } = await execAsync(pingCmd)
        const responseTime = Date.now() - startTime

        // On Windows, check if ping was successful (TTL means reply received)
        if (isWindows && !stdout.includes('TTL=')) {
            return { alive: false }
        }

        return { alive: true, responseTime }
    } catch {
        // Ping failed - host is not reachable
        return { alive: false }
    }
}

/**
 * Parse CIDR notation to get IP range
 */
export function parseCIDR(cidr: string): { startIP: string; endIP: string; total: number } {
    const [network, prefixStr] = cidr.split('/')
    const prefix = parseInt(prefixStr, 10)

    const octets = network.split('.').map(Number)
    const networkInt =
        ((octets[0] << 24) >>> 0) +
        ((octets[1] << 16) >>> 0) +
        ((octets[2] << 8) >>> 0) +
        octets[3]

    const intToIP = (int: number): string => {
        return [
            (int >>> 24) & 255,
            (int >>> 16) & 255,
            (int >>> 8) & 255,
            int & 255,
        ].join('.')
    }

    // Handle /32 (single IP) specially
    if (prefix === 32) {
        return {
            startIP: network,
            endIP: network,
            total: 1,
        }
    }

    // Handle /31 (point-to-point link, 2 IPs, no network/broadcast)
    if (prefix === 31) {
        const startInt = (networkInt >>> 1) << 1
        return {
            startIP: intToIP(startInt),
            endIP: intToIP(startInt + 1),
            total: 2,
        }
    }

    const hostBits = 32 - prefix
    const numHosts = Math.pow(2, hostBits)
    const startInt = (networkInt >>> hostBits) << hostBits
    const endInt = startInt + numHosts - 1

    return {
        startIP: intToIP(startInt + 1), // Skip network address
        endIP: intToIP(endInt - 1),     // Skip broadcast address
        total: numHosts - 2,            // Exclude network and broadcast
    }
}

/**
 * Generate all IPs in a CIDR range
 */
export function* generateIPsFromCIDR(cidr: string): Generator<string> {
    const [network, prefixStr] = cidr.split('/')
    const prefix = parseInt(prefixStr, 10)

    const octets = network.split('.').map(Number)
    const networkInt =
        ((octets[0] << 24) >>> 0) +
        ((octets[1] << 16) >>> 0) +
        ((octets[2] << 8) >>> 0) +
        octets[3]

    const intToIP = (int: number): string => {
        return [
            (int >>> 24) & 255,
            (int >>> 16) & 255,
            (int >>> 8) & 255,
            int & 255,
        ].join('.')
    }

    // Handle /32 (single IP) specially
    if (prefix === 32) {
        yield network
        return
    }

    // Handle /31 (point-to-point link, 2 IPs)
    if (prefix === 31) {
        const startInt = (networkInt >>> 1) << 1
        yield intToIP(startInt)
        yield intToIP(startInt + 1)
        return
    }

    const hostBits = 32 - prefix
    const numHosts = Math.pow(2, hostBits)
    const startInt = (networkInt >>> hostBits) << hostBits

    // Skip network (i=0) and broadcast (i=numHosts-1)
    for (let i = 1; i < numHosts - 1; i++) {
        const ip = startInt + i
        yield intToIP(ip)
    }
}

/**
 * Check if a specific port is open on a host
 */
export async function checkPort(ip: string, port: number, timeout = 1000): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket()

        socket.setTimeout(timeout)

        socket.on('connect', () => {
            socket.destroy()
            resolve(true)
        })

        socket.on('timeout', () => {
            socket.destroy()
            resolve(false)
        })

        socket.on('error', () => {
            socket.destroy()
            resolve(false)
        })

        socket.connect(port, ip)
    })
}

/**
 * Scan multiple ports on a host
 */
export async function scanPorts(ip: string, ports: number[] = Object.values(COMMON_PORTS)): Promise<number[]> {
    const results = await Promise.all(
        ports.map(async (port) => {
            const isOpen = await checkPort(ip, port)
            return isOpen ? port : null
        })
    )
    return results.filter((port): port is number => port !== null)
}

/**
 * Detect device type and brand based on open ports using fingerprint database
 */
export function detectDeviceType(openPorts: number[]): { type: string; brand?: string } {
    const portSet = new Set(openPorts)

    // Sort fingerprints by priority (highest first)
    const sortedFingerprints = [...DEVICE_FINGERPRINTS].sort((a, b) => b.priority - a.priority)

    for (const fingerprint of sortedFingerprints) {
        // Check if all required ports are present
        const hasAllRequired = fingerprint.requiredPorts.every(port => portSet.has(port))
        if (!hasAllRequired) continue

        // Check if at least one optional port is present (if optionalPorts defined and requiredPorts is empty)
        if (fingerprint.requiredPorts.length === 0 && fingerprint.optionalPorts) {
            const hasAnyOptional = fingerprint.optionalPorts.some(port => portSet.has(port))
            if (!hasAnyOptional) continue
        }

        // Check if any exclude ports are present (if so, skip this fingerprint)
        if (fingerprint.excludePorts) {
            const hasExcluded = fingerprint.excludePorts.some(port => portSet.has(port))
            if (hasExcluded) continue
        }

        // Match found!
        console.log('[Discovery] Matched fingerprint:', fingerprint.type, fingerprint.brand || '', 'from ports:', openPorts)
        return { type: fingerprint.type, brand: fingerprint.brand }
    }

    // Default fallback
    console.log('[Discovery] No fingerprint match, defaulting to OTHER. Ports:', openPorts)
    return { type: 'OTHER' }
}

/**
 * Get hostname via reverse DNS or NetBIOS (Windows)
 */
export async function getHostname(ip: string): Promise<string | undefined> {
    console.log(`[Hostname] Attempting to resolve hostname for ${ip}`)

    // Try DNS reverse lookup first
    try {
        console.log(`[Hostname] Trying DNS reverse lookup for ${ip}...`)
        const hostnames = await dnsReverse(ip)
        if (hostnames && hostnames.length > 0) {
            console.log(`[Hostname] ✓ DNS success for ${ip}: ${hostnames[0]}`)
            return hostnames[0]
        }
        console.log(`[Hostname] DNS returned empty for ${ip}`)
    } catch (err) {
        console.log(`[Hostname] DNS failed for ${ip}: ${(err as Error).message}`)
    }

    // Try NetBIOS lookup on Windows using nbtstat
    if (process.platform === 'win32') {
        try {
            console.log(`[Hostname] Trying NetBIOS (nbtstat) for ${ip}...`)
            const { stdout } = await execAsync(`nbtstat -A ${ip}`, { timeout: 3000 })
            // Parse NetBIOS name from nbtstat output
            const lines = stdout.split('\n')
            for (const line of lines) {
                // Look for <00> UNIQUE which is the workstation name
                if (line.includes('<00>') && line.includes('UNIQUE')) {
                    // Extract the hostname (first word before any <XX> pattern)
                    const trimmedLine = line.trim()
                    // Match everything before the first < character
                    const hostname = trimmedLine.split('<')[0].trim()
                    if (hostname && hostname.length > 0) {
                        console.log(`[Hostname] ✓ NetBIOS success for ${ip}: ${hostname}`)
                        return hostname
                    }
                }
            }
            console.log(`[Hostname] NetBIOS returned no valid hostname for ${ip}`)
        } catch (err) {
            console.log(`[Hostname] NetBIOS failed for ${ip}: ${(err as Error).message}`)
        }
    }

    console.log(`[Hostname] ✗ No hostname found for ${ip}`)
    return undefined
}

/**
 * Get ARP table entry for MAC address (Windows)
 */
export async function getMacAddress(ip: string): Promise<string | undefined> {
    try {
        const isWindows = process.platform === 'win32'
        const cmd = isWindows ? `arp -a ${ip}` : `arp -n ${ip}`
        const { stdout } = await execAsync(cmd)

        // Parse MAC from ARP output
        const macRegex = /([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}/
        const match = stdout.match(macRegex)

        if (match) {
            // Normalize MAC format (remove colons/dashes)
            return match[0].toLowerCase().replace(/[:-]/g, '')
        }
    } catch {
        // Ignore errors
    }
    return undefined
}

/**
 * Discover a single host with detailed information
 */
export async function discoverHost(ip: string): Promise<DiscoveredDevice | null> {
    const pingResult = await pingHost(ip)

    if (!pingResult.alive) {
        return null
    }

    // Get additional info in parallel
    const [openPorts, hostname, mac] = await Promise.all([
        scanPorts(ip),
        getHostname(ip),
        getMacAddress(ip),
    ])

    // Get port-based detection
    const portDetection = detectDeviceType(openPorts)

    // Get MAC-based vendor info
    const macVendor = lookupMacVendor(mac)

    // Determine final device type and brand
    let deviceType = portDetection.type
    let brand = portDetection.brand

    // If we have MAC vendor info, use it to enrich detection
    if (macVendor) {
        // If port detection didn't find a brand but MAC did, use MAC vendor
        if (!brand) {
            brand = macVendor.vendor
        }

        // If port detection returned OTHER but MAC has a device hint, use it
        if (deviceType === 'OTHER' && macVendor.deviceHint) {
            deviceType = macVendor.deviceHint
            console.log('[Discovery] MAC OUI override:', ip, '- type changed to', deviceType, 'based on vendor', macVendor.vendor)
        }
    }

    return {
        ip,
        hostname,
        mac,
        deviceType,
        brand,
        openPorts,
        responseTime: pingResult.responseTime,
        status: 'alive',
    }
}

/**
 * Scan entire network and discover devices
 */
export async function scanNetwork(
    cidr: string,
    options: {
        concurrency?: number
        onProgress?: (scanned: number, total: number, found: number) => void
    } = {}
): Promise<DiscoveredDevice[]> {
    console.log('[Discovery] scanNetwork called with CIDR:', cidr)

    const { concurrency = 20, onProgress } = options

    let ips: string[]
    try {
        ips = [...generateIPsFromCIDR(cidr)]
        console.log('[Discovery] Generated', ips.length, 'IPs to scan')
    } catch (err) {
        console.error('[Discovery] Error generating IPs from CIDR:', err)
        throw err
    }

    const total = ips.length
    const discovered: DiscoveredDevice[] = []
    let scanned = 0

    console.log('[Discovery] Starting scan with concurrency:', concurrency)

    // Process in batches for concurrency control
    for (let i = 0; i < ips.length; i += concurrency) {
        const batch = ips.slice(i, i + concurrency)
        console.log('[Discovery] Processing batch', Math.floor(i / concurrency) + 1, 'of', Math.ceil(ips.length / concurrency), '- IPs:', batch[0], 'to', batch[batch.length - 1])

        try {
            const results = await Promise.all(batch.map((ip) => discoverHost(ip)))

            for (const result of results) {
                scanned++
                if (result) {
                    console.log('[Discovery] Found device:', result.ip, result.deviceType)
                    discovered.push(result)
                }
            }
        } catch (batchError) {
            console.error('[Discovery] Error processing batch:', batchError)
            throw batchError
        }

        if (onProgress) {
            onProgress(scanned, total, discovered.length)
        }
    }

    console.log('[Discovery] Scan complete. Total scanned:', scanned, 'Found:', discovered.length)
    return discovered
}

/**
 * Enrich discovered devices with MikroTik data (ARP + DHCP)
 * This provides MAC addresses and hostnames for devices across VLANs
 */
export async function enrichWithMikroTikData(
    devices: DiscoveredDevice[]
): Promise<DiscoveredDevice[]> {
    try {
        // Dynamically import MikroTik client to avoid circular dependencies
        const { getMikroTikClient } = await import('./mikrotik')
        const client = getMikroTikClient()

        if (!client) {
            console.log('[Discovery] MikroTik client not configured, skipping enrichment')
            return devices
        }

        console.log('[Discovery] Fetching MikroTik ARP/DHCP data for enrichment...')
        const routerDevices = await client.getNetworkDevices()

        // Get MikroTik router identity (for the router itself)
        const routerHost = process.env.MIKROTIK_HOST
        const routerIdentity = await client.getIdentity()

        // Create IP -> router data map
        const routerDataMap = new Map(
            routerDevices.map(d => [d.ip, d])
        )

        // Enrich each discovered device
        const enriched = devices.map(device => {
            const routerData = routerDataMap.get(device.ip)

            // If this is the MikroTik router itself, use identity as hostname
            if (device.ip === routerHost && routerIdentity && !device.hostname) {
                device.hostname = routerIdentity
                console.log('[Discovery] Using MikroTik identity for router:', routerIdentity)
            }

            if (routerData) {
                // Use router data for MAC if not available locally
                if (!device.mac && routerData.mac) {
                    device.mac = routerData.mac.toLowerCase().replace(/:/g, '')
                    console.log('[Discovery] Enriched MAC for', device.ip, ':', device.mac)
                }

                // Use router data for hostname if not available locally
                if (!device.hostname && routerData.hostname) {
                    device.hostname = routerData.hostname
                    console.log('[Discovery] Enriched hostname for', device.ip, ':', device.hostname)
                }

                // Re-check MAC vendor if we got a new MAC
                if (device.mac && !device.brand) {
                    const macVendor = lookupMacVendor(device.mac)
                    if (macVendor) {
                        device.brand = macVendor.vendor
                        if (device.deviceType === 'OTHER' && macVendor.deviceHint) {
                            device.deviceType = macVendor.deviceHint
                        }
                    }
                }
            }

            return device
        })

        console.log('[Discovery] MikroTik enrichment complete for', enriched.length, 'devices')
        return enriched
    } catch (error) {
        console.error('[Discovery] MikroTik enrichment failed:', error)
        return devices
    }
}

export default {
    pingHost,
    parseCIDR,
    generateIPsFromCIDR,
    checkPort,
    scanPorts,
    detectDeviceType,
    lookupMacVendor,
    getHostname,
    getMacAddress,
    discoverHost,
    scanNetwork,
    enrichWithMikroTikData,
}

