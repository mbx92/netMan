import prisma from '../../utils/prisma'
import { scanNetwork, parseCIDR, enrichWithMikroTikData, type DiscoveredDevice } from '../../utils/discovery'

// In-memory job storage (for simplicity - could use Redis in production)
const discoveryJobs = new Map<string, {
    id: string
    networks: string[]
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
    totalHosts: number
    scannedHosts: number
    foundHosts: number
    results: DiscoveredDevice[]
    subnetProgress: { [network: string]: { scanned: number; total: number; found: number } }
    startedAt?: Date
    completedAt?: Date
    error?: string
}>()

interface StartDiscoveryBody {
    network?: string      // Single network (backward compat)
    networks?: string[]   // Multiple networks
    options?: {
        timeout?: number
        concurrency?: number
    }
}

// Helper: Normalize and validate network input
function normalizeNetwork(network: string): string {
    let normalized = network.trim()

    // Auto-convert single IP to /32 CIDR
    if (!normalized.includes('/')) {
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
        if (!ipRegex.test(normalized)) {
            throw new Error(`Invalid IP address format: ${normalized}`)
        }
        normalized = `${normalized}/32`
    }

    // Validate CIDR format
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    if (!cidrRegex.test(normalized)) {
        throw new Error(`Invalid CIDR format: ${normalized}`)
    }

    return normalized
}

// POST /api/discovery - Start a new discovery scan (supports multi-subnet)
export default defineEventHandler(async (event) => {
    const body = await readBody<StartDiscoveryBody>(event)

    // Parse networks from input (support both single and multiple)
    let networksInput: string[] = []

    if (body.networks && Array.isArray(body.networks)) {
        networksInput = body.networks
    } else if (body.network) {
        // Support comma-separated or newline-separated
        networksInput = body.network
            .split(/[,\n]/)
            .map(n => n.trim())
            .filter(n => n.length > 0)
    }

    if (networksInput.length === 0) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Network IP or CIDR is required (e.g., 10.5.80.1 or 10.5.80.0/24). Supports multiple networks.',
        })
    }

    // Normalize and validate all networks
    const networks: string[] = []
    for (const net of networksInput) {
        try {
            networks.push(normalizeNetwork(net))
        } catch (err) {
            throw createError({
                statusCode: 400,
                statusMessage: (err as Error).message,
            })
        }
    }

    console.log(`[Discovery] Received ${networks.length} network(s) to scan:`, networks)

    // Calculate total hosts
    let totalHosts = 0
    const subnetProgress: { [network: string]: { scanned: number; total: number; found: number } } = {}

    for (const net of networks) {
        const { total } = parseCIDR(net)
        totalHosts += total
        subnetProgress[net] = { scanned: 0, total, found: 0 }
    }

    // Limit total scan size
    if (totalHosts > 2048) {
        throw createError({
            statusCode: 400,
            statusMessage: `Total hosts (${totalHosts}) too large. Maximum 2048 hosts allowed.`,
        })
    }

    // Generate job ID
    const jobId = crypto.randomUUID()

    // Create job entry
    const job = {
        id: jobId,
        networks,
        status: 'PENDING' as const,
        totalHosts,
        scannedHosts: 0,
        foundHosts: 0,
        results: [] as DiscoveredDevice[],
        subnetProgress,
        startedAt: undefined as Date | undefined,
        completedAt: undefined as Date | undefined,
    }

    discoveryJobs.set(jobId, job)

    // Log the action
    await prisma.auditLog.create({
        data: {
            actor: 'system',
            action: 'START_DISCOVERY',
            target: networks.join(', '),
            details: { jobId, networks, totalHosts },
            result: 'started',
        },
    })

    // Start scan in background
    setTimeout(async () => {
        const currentJob = discoveryJobs.get(jobId)
        if (!currentJob) return

        try {
            currentJob.status = 'RUNNING'
            currentJob.startedAt = new Date()

            console.log('[Discovery] Starting multi-subnet scan for:', networks)

            const allResults: DiscoveredDevice[] = []

            // Scan all networks (can be parallelized, but sequential for stability)
            for (const network of networks) {
                console.log(`[Discovery] Scanning subnet: ${network}`)

                const results = await scanNetwork(network, {
                    onProgress: (scanned, total, found) => {
                        currentJob.subnetProgress[network] = { scanned, total, found }
                        // Update total progress
                        let totalScanned = 0
                        let totalFound = 0
                        for (const progress of Object.values(currentJob.subnetProgress)) {
                            totalScanned += progress.scanned
                            totalFound += progress.found
                        }
                        currentJob.scannedHosts = totalScanned
                        currentJob.foundHosts = totalFound
                    },
                })

                console.log(`[Discovery] Subnet ${network} complete. Found ${results.length} devices`)
                allResults.push(...results)
            }

            console.log('[Discovery] All subnets scanned. Total devices:', allResults.length)

            // Enrich with MikroTik data (ARP/DHCP) for cross-VLAN info
            console.log('[Discovery] Starting MikroTik enrichment...')
            const enrichedResults = await enrichWithMikroTikData(allResults)

            // Log summary
            console.log('\n========== DISCOVERY RESULTS ==========')
            console.log('Networks scanned:', networks.length)
            console.log('Total devices found:', enrichedResults.length)
            console.log('Fields available:', enrichedResults.length > 0 ? Object.keys(enrichedResults[0]) : [])
            console.log('========================================\n')

            currentJob.results = enrichedResults
            currentJob.foundHosts = enrichedResults.length
            currentJob.scannedHosts = totalHosts
            currentJob.status = 'COMPLETED'
            currentJob.completedAt = new Date()

            // Update audit log
            await prisma.auditLog.create({
                data: {
                    actor: 'system',
                    action: 'COMPLETE_DISCOVERY',
                    target: networks.join(', '),
                    details: { jobId, foundHosts: enrichedResults.length },
                    result: 'success',
                },
            })
        } catch (error) {
            console.error('[Discovery] Scan failed:', error)

            currentJob.status = 'FAILED'
            currentJob.error = error instanceof Error ? error.message : 'Unknown error'
            currentJob.completedAt = new Date()

            await prisma.auditLog.create({
                data: {
                    actor: 'system',
                    action: 'FAIL_DISCOVERY',
                    target: networks.join(', '),
                    details: { jobId, error: currentJob.error },
                    result: 'failed',
                },
            })
        }
    }, 0)

    return {
        jobId,
        status: 'started',
        networks,
        totalHosts,
        subnetProgress,
    }
})

// Export job storage for other handlers
export { discoveryJobs }
