/**
 * NAS Adapter — live data capture from Synology DSM and QNAP QTS.
 * Ported from incontrolroom PHP adapters.
 */

export interface NasAdapter {
  supports(vendor: string): boolean
  check(host: string, port: number, username: string, password: string): Promise<boolean>
  capture(host: string, port: number, username: string, password: string): Promise<NasSnapshot>
}

export interface NasVolume {
  name: string
  totalBytes: number
  usedBytes: number
  freeBytes: number
  status: string
}

export interface NasDisk {
  slot: string
  model: string
  totalBytes: number
  health: string
  temperature: number | null
  /** hdd = chassis bay; nvme = M.2 / PCIe cache card */
  kind?: 'hdd' | 'nvme'
}

export interface NasSnapshot {
  volumes: NasVolume[]
  disks: NasDisk[]
  notes: string[]
  /** Detected hardware model from the NAS API when available */
  model?: string | null
}

const DEFAULT_TIMEOUT = 25_000

function toInt(raw: unknown): number {
  if (raw == null) return 0
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0
  const s = String(raw).trim().replace(/,/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

function toBytes(raw: unknown, unit?: unknown): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(/,/g, ''))
  if (!Number.isFinite(n)) return 0
  const u = String(unit ?? '').toLowerCase()
  if (u.includes('tb') || String(raw).toLowerCase().includes('tb')) return Math.floor(n * 1_099_511_627_776)
  if (u.includes('gb') || String(raw).toLowerCase().includes('gb')) return Math.floor(n * 1_073_741_824)
  if (u.includes('mb') || String(raw).toLowerCase().includes('mb')) return Math.floor(n * 1_048_576)
  if (u.includes('kb') || String(raw).toLowerCase().includes('kb')) return Math.floor(n * 1024)
  return Math.floor(n)
}

function baseUrls(host: string, port: number): string[] {
  const urls: string[] = []
  // Prefer HTTPS for 5001 / 443, HTTP otherwise — but try both
  if (port === 5001 || port === 443) {
    urls.push(`https://${host}:${port}`, `http://${host}:${port}`)
  } else {
    urls.push(`http://${host}:${port}`, `https://${host}:${port}`)
  }
  return urls
}

/** QNAP: management is HTTP:8080 by default; HTTPS is usually :443 (not :8080). */
function qnapBaseUrls(host: string, port: number): string[] {
  const candidates = [
    `http://${host}:${port}`,
    `https://${host}:443`,
    `https://${host}:${port}`,
    `http://${host}:80`,
    `https://${host}:8081`,
  ]
  // de-dupe while preserving order
  return [...new Set(candidates)]
}

function withTlsBypass<T>(url: string, fn: () => Promise<T>): Promise<T> {
  if (!url.startsWith('https://')) return fn()
  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  return fn().finally(() => {
    if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev
  })
}

/** Low-level GET that follows one redirect and works with self-signed NAS certs. */
async function httpGetText(url: string, redirectHops = 2): Promise<string> {
  const { request } = await import(url.startsWith('https://') ? 'node:https' : 'node:http')
  const { URL } = await import('node:url')

  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method: 'GET',
        timeout: DEFAULT_TIMEOUT,
        rejectUnauthorized: false,
        headers: {
          Accept: '*/*',
          'User-Agent': 'NetMan/1.0',
          Connection: 'close',
        },
      },
      (res) => {
        const status = res.statusCode || 0
        const location = res.headers.location
        if (location && status >= 300 && status < 400 && redirectHops > 0) {
          res.resume()
          const next = new URL(location, url).toString()
          httpGetText(next, redirectHops - 1).then(resolve, reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      },
    )
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout connecting to ${u.protocol}//${u.hostname}:${u.port || ''}`))
    })
    req.on('error', reject)
    req.end()
  })
}

async function fetchJson<T = any>(url: string, query: Record<string, string | number>): Promise<T> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) params.set(k, String(v))
  const full = `${url}?${params.toString()}`
  try {
    const text = await httpGetText(full)
    if (!text || !text.trim()) return {} as T
    try {
      return JSON.parse(text) as T
    } catch {
      // Some QNAP endpoints return non-JSON; surface empty
      return {} as T
    }
  } catch {
    return withTlsBypass(full, () =>
      $fetch<T>(full, {
        timeout: DEFAULT_TIMEOUT,
        ignoreResponseError: true,
      }),
    )
  }
}

async function fetchText(url: string, query: Record<string, string | number>): Promise<string> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) params.set(k, String(v))
  const full = `${url}?${params.toString()}`
  try {
    return await httpGetText(full)
  } catch {
    // Fallback to ofetch (some environments)
    return withTlsBypass(full, () =>
      $fetch<string>(full, {
        timeout: DEFAULT_TIMEOUT,
        ignoreResponseError: true,
        responseType: 'text',
      }),
    )
  }
}

function xmlTag(body: string, tag: string): string {
  // Matches <tag>value</tag> and <tag><![CDATA[value]]></tag>
  const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, 'is')
  const m = body.match(re)
  return (m?.[1] || '').trim()
}

function redactUrl(url: string): string {
  return url
    .replace(/([?&](?:plain_pwd|pwd|passwd|password)=)[^&]*/gi, '$1***')
    .replace(/([?&]account=)[^&]*/gi, '$1***')
}

// ── Synology ─────────────────────────────────────────────────────────────────

class SynologyAdapter implements NasAdapter {
  supports(vendor: string): boolean {
    return vendor.toLowerCase() === 'synology'
  }

  async check(host: string, port: number, username: string, password: string): Promise<boolean> {
    try {
      const { base, sid } = await this.login(host, port, username, password)
      await this.logout(base, sid)
      return true
    } catch {
      return false
    }
  }

  async capture(host: string, port: number, username: string, password: string): Promise<NasSnapshot> {
    const { base, sid } = await this.login(host, port, username, password)
    try {
      const model = await this.fetchModel(base, sid)
      let volumes = await this.fetchVolumes(base, sid)
      // Synology Storage.Volume often returns volumes without usable size — fall back to FileStation
      volumes = await this.enrichVolumesFromShares(base, sid, volumes)
      const disks = await this.fetchDisks(base, sid)
      const notes: string[] = []
      if (!volumes.length) notes.push('No volumes returned by Synology Storage/FileStation APIs.')
      else if (volumes.every(v => v.totalBytes <= 0)) notes.push('Volumes found but capacity fields were empty from the NAS API.')
      if (!disks.length) notes.push('No disks returned by Synology Storage.Disk/Drive API.')
      return { volumes, disks, notes, model }
    } finally {
      await this.logout(base, sid).catch(() => {})
    }
  }

  private async fetchModel(base: string, sid: string): Promise<string | null> {
    try {
      const resp = await fetchJson<{ success?: boolean; data?: any }>(`${base}/webapi/entry.cgi`, {
        api: 'SYNO.Core.System',
        version: 3,
        method: 'info',
        type: 'all',
        _sid: sid,
      })
      if (!resp?.success) return null
      const d = resp.data || {}
      return String(d.model || d.product || '').trim() || null
    } catch {
      return null
    }
  }

  private async login(host: string, port: number, username: string, password: string): Promise<{ base: string; sid: string }> {
    let lastError: Error | null = null
    for (const base of baseUrls(host, port)) {
      try {
        const resp = await fetchJson<{ success?: boolean; data?: { sid?: string }; error?: any }>(
          `${base}/webapi/auth.cgi`,
          {
            api: 'SYNO.API.Auth',
            version: 6,
            method: 'login',
            account: username,
            passwd: password,
            session: 'NetMan',
            format: 'sid',
          },
        )
        if (resp?.success && resp.data?.sid) {
          return { base, sid: resp.data.sid }
        }
        lastError = new Error(`Synology login failed: ${JSON.stringify(resp?.error || resp)}`)
      } catch (e) {
        lastError = e as Error
      }
    }
    throw lastError || new Error('Synology login failed')
  }

  private async logout(base: string, sid: string): Promise<void> {
    await fetchJson(`${base}/webapi/auth.cgi`, {
      api: 'SYNO.API.Auth',
      version: 1,
      method: 'logout',
      session: 'NetMan',
      _sid: sid,
    }).catch(() => {})
  }

  private mapVolumeSize(v: any): { total: number; used: number; free: number } {
    const sizeObj = (typeof v.size === 'object' && v.size) ? v.size : null
    // Prefer nested size object, then flat keys, then unit-aware string parsing
    let total = toInt(
      sizeObj?.total
      ?? sizeObj?.total_size
      ?? v.total_size
      ?? v.size_total
      ?? v.capacity_total
      ?? v.total
      ?? (typeof v.size === 'number' || typeof v.size === 'string' ? v.size : null),
    )
    let used = toInt(
      sizeObj?.used
      ?? sizeObj?.used_size
      ?? v.used_size
      ?? v.size_used
      ?? v.capacity_used
      ?? v.used,
    )
    let free = toInt(
      sizeObj?.free
      ?? sizeObj?.free_size
      ?? v.free_size
      ?? v.size_free
      ?? v.capacity_free
      ?? v.free,
    )

    // If still zero, try human strings like "1.8 TB"
    if (total <= 0) total = toBytes(v.total_size ?? v.size_total ?? v.capacity ?? v.size)
    if (used <= 0) used = toBytes(v.used_size ?? v.size_used ?? v.used)
    if (free <= 0) free = toBytes(v.free_size ?? v.size_free ?? v.free)

    if (free <= 0 && total > 0) free = Math.max(0, total - used)
    return { total, used, free }
  }

  private async fetchVolumes(base: string, sid: string): Promise<(NasVolume & { _path?: string })[]> {
    // Try API versions 1 and 2 — newer DSM often needs v2 for size fields
    for (const version of [2, 1]) {
      const resp = await fetchJson<{ success?: boolean; data?: any }>(`${base}/webapi/entry.cgi`, {
        api: 'SYNO.Core.Storage.Volume',
        version,
        method: 'list',
        limit: -1,
        offset: 0,
        location: 'internal',
        _sid: sid,
      })

      if (!resp?.success) continue

      let raw = resp.data?.volumes ?? resp.data?.items ?? resp.data ?? []
      if (!Array.isArray(raw)) {
        if (raw && (raw.volume_path || raw.display_name)) raw = [raw]
        else raw = []
      }

      const volumes = raw.filter((v: any) => v && typeof v === 'object').map((v: any) => {
        const { total, used, free } = this.mapVolumeSize(v)
        const path = String(v.volume_path || '')
        return {
          name: String(v.display_name || v.name || path || 'Volume'),
          totalBytes: total,
          usedBytes: used,
          freeBytes: free,
          status: String(v.status || v.health || 'unknown'),
          _path: path || undefined,
        }
      })

      if (volumes.length) return volumes
    }
    return []
  }

  /** FileStation share fallback — often has totalspace/freespace when Volume API does not */
  private async enrichVolumesFromShares(
    base: string,
    sid: string,
    volumes: (NasVolume & { _path?: string })[],
  ): Promise<NasVolume[]> {
    const needsFallback = !volumes.length
      || volumes.every(v => v.totalBytes <= 0 && v.usedBytes <= 0 && v.freeBytes <= 0)

    if (!needsFallback) {
      return volumes.map(({ _path, ...v }) => v)
    }

    const shareVolumes = await this.fetchVolumesFromShares(base, sid)
    if (!shareVolumes.length) {
      return volumes.map(({ _path, ...v }) => v)
    }

    if (!volumes.length) return shareVolumes

    const byPath = new Map(shareVolumes.map(s => [s.name, s]))
    return volumes.map(({ _path, ...v }) => {
      const match = (_path && byPath.get(_path))
        || byPath.get(v.name)
        || shareVolumes.find(s =>
          s.name.toLowerCase() === v.name.toLowerCase()
          || s.name.replace(/\//g, '').toLowerCase() === v.name.replace(/\s+/g, '').toLowerCase()
          || v.name.toLowerCase().includes(s.name.replace(/^\//, '').toLowerCase()),
        )
      if (!match) return v
      return {
        ...v,
        totalBytes: Math.max(v.totalBytes, match.totalBytes),
        usedBytes: Math.max(v.usedBytes, match.usedBytes),
        freeBytes: Math.max(v.freeBytes, match.freeBytes),
        status: v.status === 'unknown' ? match.status : v.status,
      }
    })
  }

  private async fetchVolumesFromShares(base: string, sid: string): Promise<NasVolume[]> {
    const resp = await fetchJson<{ success?: boolean; data?: any }>(`${base}/webapi/entry.cgi`, {
      api: 'SYNO.FileStation.List',
      version: 2,
      method: 'list_share',
      offset: 0,
      limit: 0,
      onlywritable: 'false',
      additional: JSON.stringify(['real_path', 'volume_status']),
      _sid: sid,
    })

    if (!resp?.success) return []
    const shares = Array.isArray(resp.data?.shares) ? resp.data.shares : []
    const byPath = new Map<string, NasVolume>()

    for (const share of shares) {
      const additional = share?.additional || {}
      const vs = additional.volume_status || {}
      const realPath = String(additional.real_path || '')
      const match = realPath.match(/\/volume\d+/i)
      const volumePath = match?.[0] || ''
      if (!volumePath) continue

      const total = toInt(vs.totalspace)
      const free = toInt(vs.freespace)
      const used = Math.max(0, total - free)
      if (total <= 0 && free <= 0) continue

      const existing = byPath.get(volumePath)
      if (!existing || total > existing.totalBytes) {
        byPath.set(volumePath, {
          name: volumePath,
          totalBytes: total,
          usedBytes: used,
          freeBytes: free,
          status: vs.readonly ? 'readonly' : 'normal',
        })
      }
    }

    return Array.from(byPath.values())
  }

  private async fetchDisks(base: string, sid: string): Promise<NasDisk[]> {
    const collected: NasDisk[] = []
    const seen = new Set<string>()

    for (const api of ['SYNO.Core.Storage.Disk', 'SYNO.Core.Storage.Drive']) {
      try {
        const resp = await fetchJson<{ success?: boolean; data?: any }>(`${base}/webapi/entry.cgi`, {
          api,
          version: 1,
          method: 'list',
          limit: -1,
          offset: 0,
          _sid: sid,
        })
        if (!resp?.success) continue

        let raw = resp.data?.disks ?? resp.data?.drives ?? resp.data?.items ?? []
        if (!Array.isArray(raw)) {
          if (raw && (raw.id || raw.disk_path || raw.device)) raw = [raw]
          else raw = []
        }

        for (const d of raw) {
          if (!d || typeof d !== 'object') continue
          const status = String(d.status || d.health || d.smart_status || 'unknown').toLowerCase()
          const health = /normal|healthy|initialized/.test(status) ? 'healthy' : (status || 'unknown')
          const sizeObj = typeof d.size === 'object' && d.size ? d.size : null
          const kind = this.isNvmeDisk(d) ? 'nvme' as const : 'hdd' as const
          const rawSlot = d.device_no ?? d.slot ?? d.tray ?? d.id ?? d.disk_path ?? d.device ?? '-'
          const slotMatch = String(rawSlot).match(/(\d+)\s*$/)
          const slot = slotMatch ? slotMatch[1] : String(rawSlot)
          const model = String(d.model || d.device || '-')
          const key = `${kind}:${slot}:${model}:${d.disk_path || d.id || ''}`
          if (seen.has(key)) continue
          seen.add(key)
          collected.push({
            slot,
            model,
            totalBytes: toInt(sizeObj?.total ?? d.size_total ?? d.size ?? d.total_size),
            health,
            temperature: typeof d.temp === 'number' ? d.temp : (typeof d.temperature === 'number' ? d.temperature : null),
            kind,
          })
        }
      } catch {
        // try next API
      }
    }

    // Stable order: HDD by slot, then NVMe by slot
    return collected.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'nvme' ? 1 : -1
      return String(a.slot).localeCompare(String(b.slot), undefined, { numeric: true })
    })
  }

  private isNvmeDisk(d: any): boolean {
    const blob = [
      d.disk_path, d.device, d.id, d.model, d.container,
      d.interface, d.bus, d.firm, d.slot, d.tray, d.name,
    ].map(v => String(v ?? '').toLowerCase()).join(' ')
    if (/nvme|m\.?2|pcie\s*slot|e10m20|cache.?card/.test(blob)) return true
    if (d.is_nvme === true || d.nvme === true) return true
    // Synology often uses container "nvme" or drive_type
    if (String(d.container || d.drive_type || '').toLowerCase().includes('nvme')) return true
    return false
  }
}

// ── QNAP ─────────────────────────────────────────────────────────────────────

class QnapAdapter implements NasAdapter {
  supports(vendor: string): boolean {
    return vendor.toLowerCase().startsWith('qnap')
  }

  async check(host: string, port: number, username: string, password: string): Promise<boolean> {
    try {
      await this.login(host, port, username, password)
      return true
    } catch {
      return false
    }
  }

  async capture(host: string, port: number, username: string, password: string): Promise<NasSnapshot> {
    const { base, sid } = await this.login(host, port, username, password)
    const rawVolumes = await this.fetchRawVolumes(base, sid)
    const volumes = rawVolumes.map(v => this.mapVolume(v))
    let disks = await this.fetchSmartDisks(base, sid)
    const model = await this.fetchModel(base, sid)
    if (!disks.length) disks = this.mapDisksFromVolumes(rawVolumes)

    const notes: string[] = []
    if (!volumes.length) notes.push('No volumes returned by QNAP get_tree API.')
    if (!disks.length) {
      notes.push('QNAP disk SMART API returned no drives; volume metadata also had no usable disk list.')
    } else if (disks.every(d => d.totalBytes <= 0 && d.model === '-')) {
      notes.push('Disk inventory was inferred from volume RAID membership only (no SMART model/capacity).')
    }
    return { volumes, disks, notes, model }
  }

  private async fetchModel(base: string, sid: string): Promise<string | null> {
    // Prefer qsmart modelName (e.g. TS-X73A), then sysinfo
    try {
      const body = await fetchText(`${base}/cgi-bin/disk/qsmart.cgi`, { func: 'all_hd_data', sid })
      const modelName = xmlTag(body, 'modelName') || xmlTag(body, 'displayModelName') || xmlTag(body, 'internalModelName')
      if (modelName) return modelName
    } catch {
      // continue
    }
    try {
      const body = await fetchText(`${base}/cgi-bin/management/manaRequest.cgi`, {
        subfunc: 'sysinfo',
        hd: 'no',
        multicpu: 1,
        sid,
      })
      const model = xmlTag(body, 'displayModelName')
        || xmlTag(body, 'modelName')
        || xmlTag(body, 'internalModelName')
      if (model) return model
    } catch {
      // ignore
    }
    return null
  }

  private async login(host: string, port: number, username: string, password: string): Promise<{ base: string; sid: string }> {
    const errors: string[] = []
    const pwdB64 = Buffer.from(password, 'utf8').toString('base64')

    for (const base of qnapBaseUrls(host, port)) {
      // Prefer plain_pwd (QTS docs), then base64 pwd (common client libs)
      const attempts: Record<string, string | number>[] = [
        { user: username, plain_pwd: password, service: 1 },
        { user: username, pwd: pwdB64, service: 1 },
      ]

      for (const query of attempts) {
        const endpoint = `${base}/cgi-bin/authLogin.cgi`
        try {
          const body = await fetchText(endpoint, query)
          const authPassed = xmlTag(body, 'authPassed')
          const sid = xmlTag(body, 'authSid')
          if (authPassed === '1' && sid) {
            return { base, sid }
          }
          // Got a response but auth failed — don't keep trying other schemes for wrong password
          if (authPassed === '0' || body.includes('authPassed')) {
            throw new Error(`QNAP login rejected at ${base} (check username/password)`)
          }
          errors.push(`${base}: unexpected auth response`)
        } catch (e) {
          const msg = (e as Error).message || String(e)
          // Auth rejected — bubble up immediately
          if (msg.includes('login rejected')) throw e
          errors.push(`${redactUrl(base)}: ${msg.replace(password, '***').replace(pwdB64, '***')}`)
        }
      }
    }

    throw new Error(
      `QNAP login failed for ${host}:${port}. Tried HTTP/HTTPS management ports. Last errors: ${errors.slice(-4).join(' | ')}`,
    )
  }

  private async fetchRawVolumes(base: string, sid: string): Promise<any[]> {
    const resp = await fetchJson<any>(`${base}/cgi-bin/filemanager/utilRequest.cgi`, {
      func: 'get_tree',
      sid,
      node: 'vol_root',
      is_iso: 0,
      hidden_file: 0,
      check_acl: 0,
      recycle: 0,
    })

    // QNAP often returns a bare array of volume objects
    if (Array.isArray(resp)) return resp.filter(v => v && typeof v === 'object')
    if (Array.isArray(resp?.datas)) return resp.datas.filter((v: any) => v && typeof v === 'object')
    if (Array.isArray(resp?.data)) return resp.data.filter((v: any) => v && typeof v === 'object')
    return []
  }

  /**
   * QNAP volume fields mix units:
   * - capacity → volume_unit (often TB)
   * - used_size → unit (often GB)
   * - free_size → volume_free_unit (often TB)
   */
  private mapVolume(volume: any): NasVolume {
    const total = toBytes(volume.capacity ?? volume.total_size ?? volume.size, volume.volume_unit ?? volume.unit)
    const used = toBytes(volume.used_size ?? volume.used, volume.unit ?? volume.volume_unit)
    const free = toBytes(
      volume.free_size ?? volume.available_size,
      volume.volume_free_unit ?? volume.volume_unit ?? volume.unit,
    )
    return {
      name: String(volume.volume_name || volume.label || volume.name || 'Volume'),
      totalBytes: total,
      usedBytes: used,
      freeBytes: free > 0 ? free : Math.max(0, total - used),
      status: this.mapVolumeStatus(volume.volume_status, volume.pool_status),
    }
  }

  private mapVolumeStatus(volumeStatus: unknown, poolStatus: unknown): string {
    const volume = Number.isFinite(Number(volumeStatus)) ? Number(volumeStatus) : null
    const pool = Number.isFinite(Number(poolStatus)) ? Number(poolStatus) : null
    if (volume === 0 && (pool === null || pool === 0 || pool === -1)) return 'healthy'
    if (volume === 1 || pool === 1) return 'degraded'
    if (volumeStatus != null && volumeStatus !== '') return String(volumeStatus)
    return 'unknown'
  }

  /** Prefer real disk inventory from qsmart.cgi (model, temp, capacity, health). */
  private async fetchSmartDisks(base: string, sid: string): Promise<NasDisk[]> {
    try {
      const body = await fetchText(`${base}/cgi-bin/disk/qsmart.cgi`, {
        func: 'all_hd_data',
        sid,
      })
      if (!body || xmlTag(body, 'authPassed') === '0') return []

      const entries = [...body.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map(m => m[1])
      const disks: NasDisk[] = []

      for (const entry of entries) {
        const model = xmlTag(entry, 'Model')
        const capacity = xmlTag(entry, 'Capacity')
        const hdNo = xmlTag(entry, 'HDNo')
        const healthRaw = xmlTag(entry, 'Health') || xmlTag(entry, 'hd_status') || xmlTag(entry, 'Status')
        const tempBlock = (entry.match(/<Temperature>([\s\S]*?)<\/Temperature>/i) || [])[1] || ''
        const tempC = toInt(xmlTag(tempBlock, 'oC') || xmlTag(entry, 'oC'))
        // Empty bay placeholders often have no model and nonsense temps
        if (!model) continue

        const slot = this.normalizeHdNo(hdNo)
        const health = this.mapDiskHealth(healthRaw)

        disks.push({
          slot,
          model,
          totalBytes: toBytes(capacity),
          health,
          temperature: tempC > 0 && tempC < 200 ? tempC : null,
          kind: this.isNvmeSmartEntry(entry, model, slot) ? 'nvme' : 'hdd',
        })
      }

      // Normalize QNAP M.2 numbering to 9 / 10 when needed
      return this.normalizeQnapSlots(disks)
    } catch {
      return []
    }
  }

  private mapDiskHealth(raw: string): string {
    const h = (raw || '').toLowerCase().trim()
    if (!h || h === '-' || h === 'n/a' || h === 'none') return 'healthy' // present disk, no SMART string
    if (/^(ok|good|normal|healthy|pass|ready|fine|0)$/i.test(h)) return 'healthy'
    if (/healthy|normal|ok|good|pass|ready|fine|initialized|online/.test(h)) return 'healthy'
    if (/critical|fail|error|dead|bad|fault/.test(h)) return 'critical'
    if (/warn|degrad|hot|abnormal|caution/.test(h)) return 'warning'
    return 'healthy' // occupied drive with unrecognized status → green
  }

  private isNvmeSmartEntry(entry: string, model: string, slot: string): boolean {
    const type = xmlTag(entry, 'Type') || xmlTag(entry, 'HDType') || xmlTag(entry, 'DiskType') || xmlTag(entry, 'Interface')
    const blob = `${entry} ${model} ${type} ${slot}`.toLowerCase()
    // Only keyword / interface hints — never slot number alone
    return /nvme|m\.?2|pcie\s*ssd|pci[-\s]?e/.test(blob) && !/sata|sas\b/.test(type.toLowerCase())
  }

  /** HDD stay 1–8; real NVMe / M.2 become 9 and 10. */
  private normalizeQnapSlots(disks: NasDisk[]): NasDisk[] {
    const nvmes: NasDisk[] = []
    let hdds: NasDisk[] = []

    for (const d of disks) {
      if (d.kind === 'nvme') nvmes.push({ ...d, kind: 'nvme' })
      else hdds.push({ ...d, kind: 'hdd' })
    }

    const nums = hdds.map(d => Number(d.slot)).filter(n => Number.isFinite(n))
    if (nums.length) {
      const min = Math.min(...nums)
      const max = Math.max(...nums)
      const has1or2 = nums.some(n => n === 1 || n === 2)
      const hasHigh = nums.some(n => n >= 9)

      if (min === 0) {
        hdds = hdds.map(d => ({ ...d, slot: String(Number(d.slot) + 1), kind: 'hdd' as const }))
      } else if (!has1or2 && hasHigh && max <= 10) {
        // HDD reported as 3–10 → shift to 1–8
        hdds = hdds.map(d => {
          const n = Number(d.slot)
          return { ...d, slot: String(Math.max(1, n - 2)), kind: 'hdd' as const }
        })
      }
    }

    hdds = hdds.filter(d => {
      const n = Number(d.slot)
      return Number.isFinite(n) && n >= 1 && n <= 8
    })

    nvmes.sort((a, b) => String(a.slot).localeCompare(String(b.slot), undefined, { numeric: true }))
    const remappedNvme = nvmes.slice(0, 2).map((d, i) => ({
      ...d,
      slot: String(9 + i),
      kind: 'nvme' as const,
    }))

    return [...hdds, ...remappedNvme].sort((a, b) =>
      String(a.slot).localeCompare(String(b.slot), undefined, { numeric: true }),
    )
  }

  /** HDNo is often "0:3" (enclosure:slot) — prefer the bay number. */
  private normalizeHdNo(hdNo: string): string {
    if (!hdNo) return '-'
    const parts = hdNo.split(':')
    if (parts.length >= 2 && parts[parts.length - 1]) return parts[parts.length - 1]
    return hdNo
  }

  private mapDisksFromVolumes(rawVolumes: any[]): NasDisk[] {
    const seen = new Set<string>()
    const disks: NasDisk[] = []
    const diskFields = [
      'raid_disk_list', 'disk_list', 'sys_disk_list', 'spare_disk_list',
      'global_spare_disk_list', 'cache_disk_list', 'ssd_disk_list', 'tier_disk_list', 'hdd_list',
    ]

    for (const vol of rawVolumes) {
      for (const field of diskFields) {
        const raw = vol?.[field]
        if (raw == null) continue
        const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
        const ids = text.match(/\d+/g) || []
        for (const id of ids) {
          const normalized = id.replace(/^0+/, '') || '0'
          if (normalized === '0') continue // QNAP pads empty slots as 0
          if (seen.has(normalized)) continue
          seen.add(normalized)
          disks.push({
            slot: normalized,
            model: '-',
            totalBytes: 0,
            health: 'healthy',
            temperature: null,
          })
        }
      }
    }
    return disks.sort((a, b) => String(a.slot).localeCompare(String(b.slot), undefined, { numeric: true }))
  }
}

// ── Registry ─────────────────────────────────────────────────────────────────

const adapters: NasAdapter[] = [new SynologyAdapter(), new QnapAdapter()]

export function resolveNasAdapter(vendor: string): NasAdapter | null {
  return adapters.find(a => a.supports(vendor)) ?? null
}

export function defaultNasPort(vendor: string): number {
  const v = vendor.toLowerCase()
  if (v === 'synology') return 5000
  if (v.startsWith('qnap')) return 8080
  return 80
}
