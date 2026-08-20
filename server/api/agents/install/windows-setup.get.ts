// GET /api/agents/install/windows-setup — NetMan-Agent-Setup.exe (signed-in operators only)
import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'
import { agentBinaryDir } from '../../../utils/agent-release'
import { requireSession } from '../../../utils/require-session'

const FILENAME = 'NetMan-Agent-Setup.exe'

export default defineEventHandler(async (event) => {
    await requireSession(event)
    const filePath = join(agentBinaryDir(), FILENAME)
    if (!existsSync(filePath)) {
        throw createError({
            statusCode: 501,
            statusMessage: 'Windows setup.exe is not built yet. Rebuild the agent image (Docker compiles NetMan-Agent-Setup.exe).',
        })
    }
    setResponseHeader(event, 'Content-Type', 'application/octet-stream')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${FILENAME}"`)
    return sendStream(event, createReadStream(filePath))
})
