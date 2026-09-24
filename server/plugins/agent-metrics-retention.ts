/**
 * Prunes historical database rows so telemetry and operational logs do not
 * grow unbounded. Settings are persisted through Settings -> Database and
 * fall back to DATA_RETENTION_* / AGENT_METRIC_RETENTION_DAYS env values.
 */
import { getDataRetentionSettings, pruneDataRetention } from '../utils/data-retention'

const FALLBACK_SWEEP_INTERVAL_MS = Number(process.env.DATA_RETENTION_SWEEP_MS)
  || Number(process.env.AGENT_METRIC_RETENTION_SWEEP_MS)
  || 6 * 60 * 60 * 1000

export default defineNitroPlugin((nitroApp) => {
  // A developer may intentionally point .env at a shared or production-like
  // database. Do not delete retained data merely because `npm run dev` was
  // started; opt in explicitly when testing the scheduler itself.
  if (process.env.NODE_ENV !== 'production' && process.env.DATA_RETENTION_RUN_IN_DEV !== 'true') {
    console.log('[DataRetention] Automatic pruning is disabled in development')
    return
  }

  let running = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const prune = async () => {
    if (running) return
    running = true
    try {
      const result = await pruneDataRetention()
      const count = Object.values(result.pruned).reduce((sum, value) => sum + value, 0)
      if (count > 0) console.log(`[DataRetention] Pruned ${count} rows`, result.pruned)
    } catch (e) {
      console.error('[DataRetention] Prune failed:', e)
    } finally {
      running = false
    }
  }

  const schedule = async () => {
    await prune()
    const interval = await getDataRetentionSettings()
      .then((settings) => settings.sweepIntervalMs)
      .catch(() => FALLBACK_SWEEP_INTERVAL_MS)
    timer = setTimeout(schedule, interval)
  }

  void schedule()
  nitroApp.hooks.hook('close', () => {
    if (timer) clearTimeout(timer)
  })
})
