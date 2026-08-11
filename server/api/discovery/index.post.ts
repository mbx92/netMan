import prisma, { withPrismaRetry } from '../../utils/prisma'
import { scanNetwork, parseCIDR, enrichWithMikroTikData, type DiscoveredDevice } from '../../utils/discovery'
import { discoveryJobs, type DiscoveryJob } from '../../utils/discovery-jobs'

interface StartDiscoveryBody {
    network?: string
    networks?: string[]
    options?: {
        timeout?: number
        concurrency?: number
    }
}

function normalizeNetwork(network: string): string {
    let normalized = network.trim()

    if (!normalized.includes('/')) {
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
        if (!ipRegex.test(normalized)) {
            throw new Error(`Invalid IP address format: ${normalized}`)
        }
        normalized = `${normalized}/32`
    }

    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    if (!cidrRegex.test(normalized)) {
        throw new Error(`Invalid CIDR format: ${normalized}`)
    }

    return normalized
}

async function safeAudit(data: {
    actor: string
    action: string
    target: string
    details: Record<string, unknown>
    result: string
}) {
    try {
        await withPrismaRetry(() =>
            prisma.auditLog.create({ data }),
        )
    } catch (error) {
        console.error('[Discovery] Audit log failed (non-fatal):', error)
    }
}

// POST /api/discovery - Start a new discovery scan (supports multi-subnet)
export default defineEventHandler(async (event) => {
    const body = await readBody<StartDiscoveryBody>(event)

    let networksInput: string[] = []

    if (body.networks && Array.isArray(body.networks)) {
        networksInput = body.networks
    } else if (body.network) {
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

    let totalHosts = 0
    const subnetProgress: DiscoveryJob['subnetProgress'] = {}

    for (const net of networks) {
        const { total } = parseCIDR(net)
        totalHosts += total
        subnetProgress[net] = { scanned: 0, total, found: 0 }
    }

    if (totalHosts > 2048) {
        throw createError({
            statusCode: 400,
            statusMessage: `Total hosts (${totalHosts}) too large. Maximum 2048 hosts allowed.`,
        })
    }

    const jobId = crypto.randomUUID()

    const job: DiscoveryJob = {
        id: jobId,
        networks,
        status: 'PENDING',
        totalHosts,
        scannedHosts: 0,
        foundHosts: 0,
        results: [],
        subnetProgress,
    }

    discoveryJobs.set(jobId, job)

    await safeAudit({
        actor: 'system',
        action: 'START_DISCOVERY',
        target: networks.join(', '),
        details: { jobId, networks, totalHosts },
        result: 'started',
    })

    // Start scan in background (do not await)
    setTimeout(async () => {
        const currentJob = discoveryJobs.get(jobId)
        if (!currentJob) return

        try {
            currentJob.status = 'RUNNING'
            currentJob.startedAt = new Date()

            console.log('[Discovery] Starting multi-subnet scan for:', networks)

            const allResults: DiscoveredDevice[] = []

            for (const network of networks) {
                console.log(`[Discovery] Scanning subnet: ${network}`)

                const results = await scanNetwork(network, {
                    onProgress: (scanned, total, found, devices) => {
                        currentJob.subnetProgress[network] = { scanned, total, found }
                        let totalScanned = 0
                        for (const progress of Object.values(currentJob.subnetProgress)) {
                            totalScanned += progress.scanned
                        }
                        currentJob.scannedHosts = totalScanned
                        // Merge prior subnets + live devices from current subnet
                        currentJob.results = [...allResults, ...devices]
                        currentJob.foundHosts = currentJob.results.length
                    },
                })

                console.log(`[Discovery] Subnet ${network} complete. Found ${results.length} devices`)
                allResults.push(...results)
                currentJob.results = [...allResults]
                currentJob.foundHosts = allResults.length
            }

            console.log('[Discovery] All subnets scanned. Total devices:', allResults.length)

            // Complete immediately with scan results so the UI never waits on MikroTik
            currentJob.results = [...allResults]
            currentJob.foundHosts = allResults.length
            currentJob.scannedHosts = totalHosts
            currentJob.status = 'COMPLETED'
            currentJob.completedAt = new Date()

            console.log('\n========== DISCOVERY RESULTS ==========')
            console.log('Networks scanned:', networks.length)
            console.log('Total devices found:', allResults.length)
            console.log('Fields available:', allResults.length > 0 ? Object.keys(allResults[0]) : [])
            console.log('========================================\n')

            await safeAudit({
                actor: 'system',
                action: 'COMPLETE_DISCOVERY',
                target: networks.join(', '),
                details: { jobId, foundHosts: allResults.length },
                result: 'success',
            })

            // Enrich MAC/hostname in background; refresh results if job still present
            void (async () => {
                try {
                    console.log('[Discovery] Starting MikroTik enrichment (background)...')
                    const enriched = await Promise.race([
                        enrichWithMikroTikData(allResults),
                        new Promise<DiscoveredDevice[]>((resolve) =>
                            setTimeout(() => {
                                console.warn('[Discovery] MikroTik enrichment timed out')
                                resolve(allResults)
                            }, 20000),
                        ),
                    ])
                    const job = discoveryJobs.get(jobId)
                    if (job) {
                        job.results = enriched
                        job.foundHosts = enriched.length
                        console.log('[Discovery] Background enrichment applied for', enriched.length, 'devices')
                    }
                } catch (enrichError) {
                    console.error('[Discovery] Enrichment error:', enrichError)
                }
            })()
        } catch (error) {
            console.error('[Discovery] Scan failed:', error)

            currentJob.status = 'FAILED'
            currentJob.error = error instanceof Error ? error.message : 'Unknown error'
            currentJob.completedAt = new Date()
            // Keep any partial results for the UI
            currentJob.foundHosts = currentJob.results.length

            await safeAudit({
                actor: 'system',
                action: 'FAIL_DISCOVERY',
                target: networks.join(', '),
                details: { jobId, error: currentJob.error },
                result: 'failed',
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
