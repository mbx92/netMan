export type DiskBayStatus = 'healthy' | 'warning' | 'critical' | 'empty' | 'unknown'

export type DiskBaySlot = {
  slot: string | number
  status: DiskBayStatus
  caption?: string
  disk?: any
  kind?: 'hdd' | 'nvme'
}

export function slotNum(slot: string | number): number {
  const s = String(slot ?? '').trim()
  if (!s || s === '-') return 0
  const colon = s.match(/:(\d+)\s*$/)
  if (colon) return Number(colon[1])
  const trailing = s.match(/(\d+)\s*$/)
  if (trailing) return Number(trailing[1])
  const any = s.match(/(\d+)/)
  if (any) return Number(any[1])
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * True NVMe / M.2 only — do NOT treat slot number alone as NVMe.
 * Also ignore stale kind:'nvme' when the drive model looks like a normal HDD/SATA SSD.
 */
export function isNvmeBay(bay: DiskBaySlot): boolean {
  const model = String(bay.disk?.model || bay.caption || '').toLowerCase()
  const slot = String(bay.slot).toLowerCase()
  const path = String(bay.disk?.disk_path || bay.disk?.device || bay.disk?.interface || '').toLowerCase()
  const blob = `${model} ${slot} ${path}`

  if (/nvme|m\.?2|e10m20|pcie\s*ssd|pci[-\s]?e\s*nvme/.test(blob)) return true

  // Explicit HDD kind always wins
  if (bay.kind === 'hdd') return false

  // Stale captures may mark HDD as nvme just because slot was 9+
  if (bay.kind === 'nvme') {
    if (!model || model === '-') return true
    // Model present but no NVMe hint → treat as HDD
    return false
  }

  return false
}

export function buildHddSlots(bays: DiskBaySlot[], bayCount?: number | null): DiskBaySlot[] {
  const hdds = bays.filter(b => !isNvmeBay(b))
  if (!hdds.length && !bayCount) return []

  const bySlot = new Map<number, DiskBaySlot>()
  const unnumbered: DiskBaySlot[] = []

  for (const bay of hdds) {
    const n = slotNum(bay.slot)
    if (n > 0) bySlot.set(n, { ...bay, slot: n, kind: 'hdd' })
    else unnumbered.push({ ...bay, kind: 'hdd' })
  }

  const maxFromData = bySlot.size ? Math.max(...bySlot.keys()) : 0
  const total = Math.max(bayCount || 0, maxFromData, 0)

  if (total > 0 && bySlot.size > 0) {
    const slots: DiskBaySlot[] = []
    for (let i = 1; i <= total; i++) {
      slots.push(bySlot.get(i) || { slot: i, status: 'empty', kind: 'hdd' })
    }
    for (const bay of unnumbered) slots.push(bay)
    return slots
  }

  if (hdds.length) {
    return hdds.map((bay, i) => ({
      ...bay,
      kind: 'hdd' as const,
      slot: slotNum(bay.slot) || bay.slot || i + 1,
    }))
  }

  return Array.from({ length: bayCount || 0 }, (_, i) => ({
    slot: i + 1,
    status: 'empty' as const,
    kind: 'hdd' as const,
  }))
}

export function buildNvmeSlots(bays: DiskBaySlot[]): DiskBaySlot[] {
  return bays
    .filter(b => isNvmeBay(b))
    .map((bay, i) => ({
      ...bay,
      kind: 'nvme' as const,
      slot: slotNum(bay.slot) || bay.slot || i + 1,
    }))
    .sort((a, b) => String(a.slot).localeCompare(String(b.slot), undefined, { numeric: true }))
}

/**
 * QNAP TS-873A: HDD bays 1–8, M.2 / NVMe as 9 and 10 (empty if none).
 */
export function buildQnapNvmeSlots(bays: DiskBaySlot[]): DiskBaySlot[] {
  const nvmes = bays
    .filter(b => isNvmeBay(b))
    .map(bay => ({ ...bay, kind: 'nvme' as const }))
    .sort((a, b) => slotNum(a.slot) - slotNum(b.slot))

  const bySlot = new Map<number, DiskBaySlot>()
  for (const bay of nvmes) {
    const n = slotNum(bay.slot)
    if (n === 9 || n === 10) bySlot.set(n, { ...bay, slot: n })
  }
  for (const bay of nvmes) {
    const n = slotNum(bay.slot)
    if (n === 9 || n === 10) continue
    if (!bySlot.has(9)) bySlot.set(9, { ...bay, slot: 9 })
    else if (!bySlot.has(10)) bySlot.set(10, { ...bay, slot: 10 })
  }

  return [9, 10].map(n => bySlot.get(n) || { slot: n, status: 'empty' as const, kind: 'nvme' as const })
}

/**
 * QNAP HDD 1–8. Fixes common API quirks:
 * - 0-based HDNo (0–7) → 1–8
 * - Reserved M.2 numbers shifting HDD to 3–10 → shift back to 1–8
 */
export function buildQnapHddSlots(bays: DiskBaySlot[], bayCount = 8): DiskBaySlot[] {
  const total = Number(bayCount) > 0 ? Number(bayCount) : 8
  let hdds = bays
    .filter(b => !isNvmeBay(b))
    .map(b => ({ ...b, kind: 'hdd' as const }))

  const nums = hdds.map(b => slotNum(b.slot)).filter(n => Number.isFinite(n) && n > 0)
  if (!nums.length) return buildHddSlots(hdds, total)

  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const has1or2 = nums.some(n => n === 1 || n === 2)
  const hasHigh = nums.some(n => n >= 9)

  // 0-based bay index → 1-based
  if (min === 0) {
    hdds = hdds.map(b => {
      const n = slotNum(b.slot)
      return { ...b, slot: n + 1, kind: 'hdd' as const }
    })
  } else if (!has1or2 && hasHigh && max <= 10) {
    // HDD reported as 3–10 (M.2 reserved 1–2) → shift down to 1–8
    hdds = hdds.map(b => {
      const n = slotNum(b.slot)
      return { ...b, slot: Math.max(1, n - 2), kind: 'hdd' as const }
    })
  }

  // Only front chassis bays 1–total
  hdds = hdds.filter(b => {
    const n = slotNum(b.slot)
    return n >= 1 && n <= total
  })

  return buildHddSlots(hdds, total)
}

export function bayColors(status: DiskBayStatus) {
  switch (status) {
    case 'healthy':
      return {
        fill: 'var(--nm-inverse)',
        stroke: 'var(--nm-success)',
        led: 'var(--nm-success)',
        latch: 'var(--nm-inverse-surface)',
        groove: 'rgba(255,255,255,0.12)',
        label: 'var(--nm-inverse-ink)',
      }
    case 'warning':
      return {
        fill: 'var(--nm-inverse-surface)',
        stroke: 'var(--nm-warning)',
        led: 'var(--nm-warning)',
        latch: 'var(--nm-inverse-surface)',
        groove: 'rgba(255,255,255,0.12)',
        label: 'var(--nm-inverse-ink)',
      }
    case 'critical':
      return {
        fill: '#3d1418',
        stroke: 'var(--nm-error)',
        led: 'var(--nm-error)',
        latch: 'var(--nm-inverse-surface)',
        groove: 'rgba(255,255,255,0.12)',
        label: 'var(--nm-inverse-ink)',
      }
    case 'unknown':
      return {
        fill: 'var(--nm-ink-muted)',
        stroke: 'var(--nm-ink-subtle)',
        led: 'var(--nm-ink-subtle)',
        latch: 'var(--nm-inverse-surface)',
        groove: 'rgba(255,255,255,0.12)',
        label: 'var(--nm-inverse-ink)',
      }
    default:
      return {
        fill: 'var(--nm-canvas)',
        stroke: 'var(--nm-hairline-strong)',
        led: 'transparent',
        latch: 'var(--nm-surface-2)',
        groove: 'var(--nm-hairline)',
        label: 'var(--nm-ink-subtle)',
      }
  }
}
