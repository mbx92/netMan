/**
 * Minimal in-memory fixed-window rate limiter. Single-process only (matches
 * this app's no-Redis, single-Nitro-instance deployment) — good enough to
 * blunt brute-force attempts against unauthenticated endpoints like agent
 * enrollment without pulling in a new dependency.
 */

const windows = new Map<string, { count: number; resetAt: number }>()

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now()
    const entry = windows.get(key)

    if (!entry || entry.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + windowMs })
        return false
    }

    entry.count += 1
    return entry.count > limit
}
