/**
 * Best-effort LG device detection for the hotspot "must be bound" alert.
 * Hostname match is reliable (LG WebOS TVs announce it via DHCP option 12).
 * MAC OUI list is NOT exhaustive — extend via the LG_MAC_PREFIXES env var
 * (comma-separated, e.g. "AA:BB:CC,11:22:33") using prefixes read off the
 * DHCP Leases table for your actual devices.
 */
export const DEFAULT_LG_MAC_PREFIXES: string[] = [
    '10:F1:F2',
    '34:4D:F7',
    '64:99:5D',
    '78:5D:C8',
    'A8:16:B2',
    'D8:5D:E2',
    'CC:FA:00',
]

export function isLgHostname(hostname?: string | null): boolean {
    if (!hostname) return false
    return /lgwebos/i.test(hostname)
}

export function isLgMacOui(mac?: string | null, prefixes: string[] = DEFAULT_LG_MAC_PREFIXES): boolean {
    if (!mac) return false
    const oui = mac.trim().toUpperCase().slice(0, 8)
    return prefixes.map(p => p.trim().toUpperCase()).includes(oui)
}

export function isLgDevice(
    mac?: string | null,
    hostname?: string | null,
    extraMacPrefixes: string[] = [],
): boolean {
    return isLgHostname(hostname) || isLgMacOui(mac, [...DEFAULT_LG_MAC_PREFIXES, ...extraMacPrefixes])
}

export function parseMacPrefixList(raw?: string | null): string[] {
    if (!raw) return []
    return raw.split(',').map(p => p.trim().toUpperCase()).filter(Boolean)
}
