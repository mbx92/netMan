/**
 * GET /api/agents/latest?platform=windows|linux|macos
 * Public: enrolled agents poll this to decide whether to self-update.
 * Omit platform to receive all three download slots.
 */
import { getAgentLatestAll, getAgentLatestForPlatform, isAgentDownloadPlatform } from '../../utils/agent-release'

export default defineEventHandler((event) => {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    const platform = String(getQuery(event).platform || '')
    if (!platform) {
        return getAgentLatestAll()
    }
    if (!isAgentDownloadPlatform(platform)) {
        throw createError({ statusCode: 400, statusMessage: 'platform must be "windows", "linux", or "macos"' })
    }
    return getAgentLatestForPlatform(platform)
})
