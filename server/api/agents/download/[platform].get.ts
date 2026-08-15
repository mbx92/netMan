/**
 * Serves the pre-built agent binary the install scripts download.
 * Binaries are not built by this app — CI/an operator must cross-compile
 * `agent/cmd/netman-agent` for windows/amd64 and linux/amd64 and drop the
 * output into AGENT_BINARY_DIR (default: <repo>/agent/dist) as
 * `netman-agent-windows.exe` / `netman-agent-linux`.
 */
import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'

const FILENAME_BY_PLATFORM: Record<string, string> = {
    windows: 'netman-agent-windows.exe',
    linux: 'netman-agent-linux',
}

export default defineEventHandler((event) => {
    const platform = getRouterParam(event, 'platform')
    const filename = platform ? FILENAME_BY_PLATFORM[platform] : undefined

    if (!filename) {
        throw createError({ statusCode: 400, statusMessage: 'platform must be "windows" or "linux"' })
    }

    const dir = process.env.AGENT_BINARY_DIR || join(process.cwd(), 'agent', 'dist')
    const filePath = join(dir, filename)

    if (!existsSync(filePath)) {
        throw createError({
            statusCode: 501,
            statusMessage: `Agent binary not built yet. Build agent/cmd/netman-agent for ${platform} and place it at ${filePath} (or set AGENT_BINARY_DIR).`,
        })
    }

    setResponseHeader(event, 'Content-Type', 'application/octet-stream')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
    return sendStream(event, createReadStream(filePath))
})
