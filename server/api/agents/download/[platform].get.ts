/**
 * Serves the pre-built agent binary the install scripts download.
 * Binaries are not built by this app — CI/an operator must cross-compile
 * `agent/cmd/netman-agent` for windows/amd64, linux/amd64, and darwin/arm64
 * (or darwin/amd64) and drop the output into AGENT_BINARY_DIR (default:
 * <repo>/agent/dist) as `netman-agent-windows.exe` / `netman-agent-linux` /
 * `netman-agent-macos`.
 */
import { createReadStream, existsSync } from 'node:fs'
import { AGENT_BINARY_FILES, agentBinaryPath, getAgentLatestForPlatform, isAgentDownloadPlatform } from '../../../utils/agent-release'

export default defineEventHandler((event) => {
    const platform = getRouterParam(event, 'platform')

    if (!platform || !isAgentDownloadPlatform(platform)) {
        throw createError({ statusCode: 400, statusMessage: 'platform must be "windows", "linux", or "macos"' })
    }

    const filename = AGENT_BINARY_FILES[platform]
    const filePath = agentBinaryPath(platform)

    if (!existsSync(filePath)) {
        throw createError({
            statusCode: 501,
            statusMessage: `Agent binary not built yet. Build agent/cmd/netman-agent for ${platform} and place it at ${filePath} (or set AGENT_BINARY_DIR).`,
        })
    }

    const latest = getAgentLatestForPlatform(platform)
    setResponseHeader(event, 'Content-Type', 'application/octet-stream')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
    if (latest.sha256) {
        setResponseHeader(event, 'X-Checksum-SHA256', latest.sha256)
    }
    return sendStream(event, createReadStream(filePath))
})
