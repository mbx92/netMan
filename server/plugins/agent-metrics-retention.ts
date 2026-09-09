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
