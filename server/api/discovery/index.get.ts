import { discoveryJobs } from './index.post'

// GET /api/discovery - Get discovery job status and results
export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const jobId = query.jobId as string

    // If no jobId, return list of recent jobs
    if (!jobId) {
        const jobs = Array.from(discoveryJobs.values())
            .sort((a, b) => {
                const aTime = a.startedAt?.getTime() || 0
                const bTime = b.startedAt?.getTime() || 0
                return bTime - aTime
            })
            .slice(0, 10)
            .map((job) => ({
                id: job.id,
                networks: job.networks,
                network: job.networks.join(', '), // Backward compat
                status: job.status,
                totalHosts: job.totalHosts,
                scannedHosts: job.scannedHosts,
                foundHosts: job.foundHosts,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
            }))

        return { jobs }
    }

    // Get specific job
    const job = discoveryJobs.get(jobId)

    if (!job) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Discovery job not found',
        })
    }

    return {
        id: job.id,
        networks: job.networks,
        network: job.networks.join(', '), // Backward compat
        status: job.status,
        totalHosts: job.totalHosts,
        scannedHosts: job.scannedHosts,
        foundHosts: job.foundHosts,
        results: job.results,
        subnetProgress: job.subnetProgress,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
        progress: job.totalHosts > 0 ? Math.round((job.scannedHosts / job.totalHosts) * 100) : 0,
    }
})
