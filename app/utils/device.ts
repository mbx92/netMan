// Device type display information
export const deviceTypeInfo: Record<string, { label: string; icon: string; color: string }> = {
    SMART_TV: { label: 'Smart TV', icon: 'i-heroicons-tv', color: 'primary' },
    PC_WINDOWS: { label: 'Windows PC', icon: 'i-heroicons-computer-desktop', color: 'info' },
    PC_LINUX: { label: 'Linux PC', icon: 'i-heroicons-computer-desktop', color: 'secondary' },
    SERVER_LINUX: { label: 'Linux Server', icon: 'i-heroicons-server-stack', color: 'accent' },
    PRINTER: { label: 'Printer', icon: 'i-heroicons-printer', color: 'neutral' },
    VM: { label: 'Virtual Machine', icon: 'i-heroicons-cube', color: 'warning' },
    ROUTER: { label: 'Router', icon: 'i-heroicons-wifi', color: 'success' },
    SWITCH: { label: 'Switch', icon: 'i-heroicons-arrows-right-left', color: 'success' },
    ACCESS_POINT: { label: 'Access Point', icon: 'i-heroicons-signal', color: 'success' },
    OTHER: { label: 'Other', icon: 'i-heroicons-question-mark-circle', color: 'neutral' },
}

// Device status display information
export const deviceStatusInfo: Record<string, { label: string; class: string; dotClass: string }> = {
    ONLINE: { label: 'Online', class: 'badge-success', dotClass: 'bg-success pulse-dot' },
    OFFLINE: { label: 'Offline', class: 'badge-error', dotClass: 'bg-error' },
    UNKNOWN: { label: 'Unknown', class: 'badge-warning', dotClass: 'bg-warning' },
    MAINTENANCE: { label: 'Maintenance', class: 'badge-info', dotClass: 'bg-info' },
}

// Remote protocol display information
export const protocolInfo: Record<string, { label: string; icon: string; port: number }> = {
    SSH: { label: 'SSH', icon: 'i-heroicons-command-line', port: 22 },
    RDP: { label: 'RDP', icon: 'i-heroicons-desktop-computer', port: 3389 },
    VNC: { label: 'VNC', icon: 'i-heroicons-tv', port: 5900 },
    CONSOLE: { label: 'Console', icon: 'i-heroicons-code-bracket', port: 0 },
    HTTP: { label: 'HTTP', icon: 'i-heroicons-globe-alt', port: 80 },
}

// Format IP address for display
export function formatIP(ip: string | null | undefined): string {
    return ip || '-'
}

// Format MAC address for display
export function formatMAC(mac: string | null | undefined): string {
    if (!mac) return '-'
    // Format as XX:XX:XX:XX:XX:XX
    return mac.toUpperCase().replace(/(.{2})(?=.)/g, '$1:')
}

// Format last seen date
export function formatLastSeen(date: Date | string | null | undefined): string {
    if (!date) return 'Never'
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: diffDays > 365 ? 'numeric' : undefined
    })
}

// Validate IP address format
export function isValidIP(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    return ipv4Regex.test(ip)
}

// Validate MAC address format
export function isValidMAC(mac: string): boolean {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
    return macRegex.test(mac)
}
