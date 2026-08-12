/** Known NAS models with chassis SVG + bay defaults (server-side copy) */

export type NasChassisId = 'rs1221plus' | 'ts873a' | 'generic'

export type NasModelInfo = {
  id: string
  label: string
  vendor: 'Synology' | 'QNAP'
  chassis: NasChassisId
  bayCount: number
  formFactor: 'rack' | 'tower' | 'desktop'
  patterns: RegExp[]
}

export const NAS_MODELS: NasModelInfo[] = [
  {
    id: 'RS1221+',
    label: 'Synology RS1221+',
    vendor: 'Synology',
    chassis: 'rs1221plus',
    bayCount: 8,
    formFactor: 'rack',
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
