import { updateDataRetentionSettings } from '../../utils/data-retention'

// PUT /api/system/retention - Persist database retention settings.
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return { settings: await updateDataRetentionSettings(body || {}) }
})
