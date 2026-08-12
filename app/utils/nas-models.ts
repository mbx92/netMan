/** Known NAS models with chassis SVG + bay defaults */

export type NasChassisId = 'rs1221plus' | 'ts873a' | 'generic'

export type NasModelInfo = {
  id: string
  label: string
  vendor: 'Synology' | 'QNAP'
  chassis: NasChassisId
  bayCount: number
  formFactor: 'rack' | 'tower' | 'desktop'
  /** Match against API / user-entered model strings */
  patterns: RegExp[]
}

export const NAS_MODELS: NasModelInfo[] = [
  {
    id: 'RS1221+',
    label: 'Synology RS1221+',
    vendor: 'Synology',
    chassis: 'rs1221plus',
    bayCount: 8,
    formFactor: 'rack', // 2U, front 2×4 bays
    patterns: [/rs\s*1221\s*\+?/i, /rs1221plus/i],
  },
  {
    id: 'TS-873A',
    label: 'QNAP TS-873A',
    vendor: 'QNAP',
    chassis: 'ts873a',
    bayCount: 8,
    formFactor: 'desktop',
    patterns: [/ts[-\s]?873a/i, /ts[-\s]?x73a/i, /ts873a/i, /x73a/i],
  },
]

export function modelsForVendor(vendor?: string | null): NasModelInfo[] {
  if (!vendor) return NAS_MODELS
  const v = vendor.toLowerCase()
  // Known chassis vendors: filter. Unknown / Other: still show all so the Model field is usable.
  if (v === 'synology' || v === 'qnap') {
    return NAS_MODELS.filter(m => m.vendor.toLowerCase() === v)
  }
  return NAS_MODELS
}

export function resolveNasModel(raw?: string | null): NasModelInfo | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null
  for (const m of NAS_MODELS) {
    if (m.id.toLowerCase() === s.toLowerCase()) return m
    if (m.patterns.some(p => p.test(s))) return m
  }
  return null
}

export function normalizeNasModelId(raw?: string | null): string | null {
  return resolveNasModel(raw)?.id || (raw ? String(raw).trim() : null)
}

export function chassisForNas(model?: string | null, vendor?: string | null): NasChassisId {
  const resolved = resolveNasModel(model)
  if (resolved) return resolved.chassis
  // Soft vendor fallback while only one chassis SVG exists per vendor
  const v = (vendor || '').toLowerCase()
  if (v === 'qnap') return 'ts873a'
  if (v === 'synology') return 'rs1221plus'
  return 'generic'
}
