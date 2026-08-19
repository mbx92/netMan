// HEALTHCHECK without curl/wget — Coolify build hosts often cannot
// `apk add` / `apt-get install` (package mirrors blocked). Node 20 has fetch.
const port = process.env.PORT || 3000
const url = `http://127.0.0.1:${port}/api/health`
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  process.exit(res.ok ? 0 : 1)
} catch {
  process.exit(1)
}
