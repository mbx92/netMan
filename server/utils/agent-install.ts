/**
 * Enrollment token issuance + install-script command building, shared by
 * agents/index.post.ts (initial "Add Agent") and agents/[id]/generate-install.post.ts
 * (re-issue after expiry).
 */
import { generateSecret, hashSecret } from './agent-auth'

const ENROLL_TOKEN_TTL_MS = 15 * 60 * 1000 // 15 minutes

export interface EnrollmentToken {
    /** Opaque token the operator pastes into the install script: "<agentId>.<secret>" */
    token: string
    tokenHash: string
    expiresAt: Date
}

export async function issueEnrollmentToken(agentId: string): Promise<EnrollmentToken> {
    const secret = generateSecret()
    const tokenHash = await hashSecret(secret)
    return {
        token: `${agentId}.${secret}`,
        tokenHash,
        expiresAt: new Date(Date.now() + ENROLL_TOKEN_TTL_MS),
    }
}

/** Splits an operator-facing token back into its agentId + secret parts. */
export function parseEnrollmentToken(token: string): { agentId: string; secret: string } | null {
    const dot = token.indexOf('.')
    if (dot <= 0 || dot === token.length - 1) return null
    return { agentId: token.slice(0, dot), secret: token.slice(dot + 1) }
}

export function buildInstallCommands(appUrl: string, token: string) {
    return {
        windows: `iwr -useb ${appUrl}/api/agents/install/windows.ps1 -OutFile install-agent.ps1; ./install-agent.ps1 -Token '${token}' -Server '${appUrl}'`,
        linux: `curl -fsSL ${appUrl}/api/agents/install/linux.sh | sudo bash -s -- --token '${token}' --server '${appUrl}'`,
    }
}
