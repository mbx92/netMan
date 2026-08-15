/**
 * Node's default behavior since v15 is to crash the process on an unhandled
 * promise rejection. That's fine for a script, but not for a server — one
 * misbehaving async error (e.g. ssh2 throwing when its underlying socket is
 * destroyed abruptly mid-handshake, a known quirk that surfaces when an
 * agent-tunneled SSH session's relay socket resets) would otherwise take
 * down monitoring, remote access, and every other feature for every user,
 * not just the one session that failed. Log loudly and keep running.
 */
export default defineNitroPlugin(() => {
    process.on('unhandledRejection', (reason) => {
        console.error('[UnhandledRejection] (server kept running):', reason)
    })
    process.on('uncaughtException', (err) => {
        console.error('[UncaughtException] (server kept running):', err)
    })
})
