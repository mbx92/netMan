/** Absolute UTC stamp — identical on server and client */
export function formatAbsoluteTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '—'
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const mm = String(date.getUTCMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm} UTC`
}

/** Relative labels — only safe after mount (uses wall clock). */
export function formatTimeAgo(dateStr: string | null | undefined, nowMs = Date.now()): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return 'Never'
  const diffMs = nowMs - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

/**
 * Hydration-safe time display: absolute during SSR/hydrate, relative after mount.
 */
export function useFormatTimeAgo() {
  const ready = ref(false)
  onMounted(() => {
    ready.value = true
  })

  function format(dateStr: string | null | undefined): string {
    if (!ready.value) return formatAbsoluteTime(dateStr)
    return formatTimeAgo(dateStr)
  }

  return { format, ready }
}
