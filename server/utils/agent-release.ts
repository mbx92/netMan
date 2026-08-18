/**
 * Latest agent binary metadata served to enrolled agents for self-update.
 * Version string is runtimeConfig.public.agentLatestVersion (must match the
 * binary's agentVersion). SHA-256 is computed from the file in AGENT_BINARY_DIR.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const AGENT_BINARY_FILES = {
    windows: 'netman-agent-windows.exe',
    linux: 'netman-agent-linux',
    macos: 'netman-agent-macos',
} as const

export type AgentDownloadPlatform = keyof typeof AGENT_BINARY_FILES

const hashCache = new Map<string, { mtimeMs: number; size: number; sha256: string }>()

export function isAgentDownloadPlatform(value: string): value is AgentDownloadPlatform {
    return value === 'windows' || value === 'linux' || value === 'macos'
}

export function agentDownloadPlatformFromDb(platform: string): AgentDownloadPlatform | null {
    switch (platform) {
        case 'WINDOWS': return 'windows'
        case 'LINUX': return 'linux'
        case 'MACOS': return 'macos'
        default: return null
    }
}

export function agentBinaryDir(): string {
    return process.env.AGENT_BINARY_DIR || join(process.cwd(), 'agent', 'dist')
}

export function agentBinaryPath(platform: AgentDownloadPlatform): string {
    return join(agentBinaryDir(), AGENT_BINARY_FILES[platform])
}

export interface AgentLatestRelease {
    version: string
    platform: AgentDownloadPlatform
    sha256: string
    url: string
    available: boolean
}

export function agentLatestVersion(): string {
    return String(useRuntimeConfig().public.agentLatestVersion || '')
}

function sha256OfFile(filePath: string): string | null {
    if (!existsSync(filePath)) return null
    const st = statSync(filePath)
    const cached = hashCache.get(filePath)
    if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
        return cached.sha256
    }
    const sha256 = createHash('sha256').update(readFileSync(filePath)).digest('hex')
    hashCache.set(filePath, { mtimeMs: st.mtimeMs, size: st.size, sha256 })
    return sha256
}

export function getAgentLatestForPlatform(platform: AgentDownloadPlatform): AgentLatestRelease {
    const filePath = agentBinaryPath(platform)
    const sha256 = sha256OfFile(filePath) || ''
    return {
        version: agentLatestVersion(),
        platform,
        sha256,
        url: `/api/agents/download/${platform}`,
        available: Boolean(sha256),
    }
}

export function getAgentLatestAll(): { version: string; downloads: Record<AgentDownloadPlatform, AgentLatestRelease> } {
    return {
        version: agentLatestVersion(),
        downloads: {
            windows: getAgentLatestForPlatform('windows'),
            linux: getAgentLatestForPlatform('linux'),
            macos: getAgentLatestForPlatform('macos'),
        },
    }
}
