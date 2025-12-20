import { pingHost, getMacAddress } from '../../utils/discovery'
import { lookupDeviceFromMikroTik } from '../../utils/mikrotik'

interface LookupMacBody {
    ip: string
    siteId?: string
}

// POST /api/discovery/mac - Lookup MAC address from IP
// Tries local ARP first, then queries MikroTik routers for cross-subnet discovery
export default defineEventHandler(async (event) => {
    const body = await readBody<LookupMacBody>(event)

    if (!body.ip) {
        throw createError({
            statusCode: 400,
            statusMessage: 'IP address is required',
        })
    }

    // Validate IP format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(body.ip)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid IP address format',
        })
    }

    console.log(`[MAC Lookup] Looking up MAC for IP: ${body.ip}`)

    // Step 1: Ping the IP to populate local ARP table
    const pingResult = await pingHost(body.ip, 3000)

    // Step 2: Try local ARP table first
    let mac: string | undefined
    let source = 'local'
    let hostname: string | undefined

    if (pingResult.alive) {
        mac = await getMacAddress(body.ip)
        if (mac) {
            console.log(`[MAC Lookup] Found MAC from local ARP: ${mac}`)
        }
    }

    // Step 3: If local ARP failed, try MikroTik routers with timeout
    if (!mac) {
        console.log(`[MAC Lookup] Local ARP failed, trying MikroTik routers...`)
        try {
            // Add 5 second timeout for MikroTik lookup
            const timeoutPromise = new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('MikroTik lookup timeout')), 5000)
            )
            const mikrotikPromise = lookupDeviceFromMikroTik(body.ip, body.siteId)

            const mikrotikResult = await Promise.race([mikrotikPromise, timeoutPromise])
            if (mikrotikResult && mikrotikResult.mac) {
                mac = mikrotikResult.mac.toLowerCase().replace(/[:-]/g, '')
                hostname = mikrotikResult.hostname
                source = mikrotikResult.source || 'mikrotik'
                console.log(`[MAC Lookup] Found MAC from MikroTik (${source}): ${mac}`)
            }
        } catch (error) {
            console.error('[MAC Lookup] MikroTik lookup failed:', error)
        }
    }

    if (!mac) {
        return {
            success: false,
            ip: body.ip,
            mac: null,
            online: pingResult.alive,
            responseTime: pingResult.responseTime,
            message: pingResult.alive
                ? 'Device is online but MAC address not found in local or MikroTik ARP tables'
                : 'Device is offline or unreachable',
        }
    }

    // Format MAC with colons for display
    const formattedMac = mac.match(/.{1,2}/g)?.join(':').toUpperCase() || mac

    console.log(`[MAC Lookup] Found MAC for ${body.ip}: ${formattedMac} (source: ${source})`)

    return {
        success: true,
        ip: body.ip,
        mac: mac,              // Raw format (no separators) for database
        macFormatted: formattedMac,  // Formatted for display
        hostname,              // Hostname from DHCP if available
        source,                // Where the MAC was found
        online: pingResult.alive,
        responseTime: pingResult.responseTime,
        message: `MAC address found via ${source}`,
    }
})

