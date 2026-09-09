import { getDataRetentionReport } from '../../utils/data-retention'

// GET /api/system/retention - Database retention settings and storage report.
export default defineEventHandler(async () => getDataRetentionReport())
