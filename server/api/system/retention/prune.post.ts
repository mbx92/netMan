import { pruneDataRetention } from '../../../utils/data-retention'

// POST /api/system/retention/prune - Dry-run or apply retention cleanup.
export default defineEventHandler(async (event) => {
  const body = await readBody<{ dryRun?: boolean }>(event).catch(() => ({}))
  return pruneDataRetention({ dryRun: body?.dryRun !== false })
})
