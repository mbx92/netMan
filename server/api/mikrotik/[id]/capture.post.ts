import prisma from '../../../utils/prisma'
import { getMikroTikClientById } from '../../../utils/mikrotik'

export type MikroTikPortKind = 'ethernet' | 'sfp'

export type MikroTikPort = {
  name: string
  label: string
  kind: MikroTikPortKind
  type: string
  mac?: string
  running: boolean
  disabled: boolean
}

function classifyPort(name: string, type: string): MikroTikPortKind | null {
  const n = name.toLowerCase()
  const t = (type || '').toLowerCase()

  // Skip virtual / logical interfaces
  if (/^(bridge|vlan|pppoe|pptp|l2tp|wg|wireguard|ovpn|gre|ipip|vrrp|bonding|eoip|sstp|list)/.test(n)) {
    return null
  }
  if (/^(bridge|vlan|pppoe|wg|gre|vrrp|bond)/.test(t)) return null
  if (t === 'wlan' || n.startsWith('wlan')) return null

  if (/sfp|qsfp/.test(n) || /sfp|qsfp/.test(t)) return 'sfp'
  if (t === 'ether' || /^ether\d/.test(n) || /^ether/.test(n) || /^combo\d/.test(n)) return 'ethernet'

  return null
}

function portLabel(name: string, kind: MikroTikPortKind): string {
  const m = name.match(/(\d+)\s*$/)
  if (m) return m[1]
  if (kind === 'sfp') return name.replace(/^sfp-?/i, '').slice(0, 4) || 'S'
  return name.slice(0, 4)
}

function sortPorts(a: MikroTikPort, b: MikroTikPort): number {
  if (a.kind !== b.kind) return a.kind === 'ethernet' ? -1 : 1
  const an = Number(a.label)
  const bn = Number(b.label)
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn
  return a.name.localeCompare(b.name, undefined, { numeric: true })
}

// POST /api/mikrotik/[id]/capture - Capture live interfaces / physical ports
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'MikroTik device ID is required' })
  }

  const device = await prisma.mikrotikDevice.findUnique({ where: { id } })
  if (!device) {
    throw createError({ statusCode: 404, statusMessage: 'MikroTik device not found' })
  }

  const client = await getMikroTikClientById(id)
  if (!client) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create MikroTik client' })
  }

  try {
    const info = await client.getRouterInfo()
    const ports: MikroTikPort[] = (info.interfaces || [])
      .map((iface) => {
        const kind = classifyPort(iface.name, iface.type)
        if (!kind) return null
        return {
          name: iface.name,
          label: portLabel(iface.name, kind),
          kind,
          type: iface.type,
          mac: iface.mac,
          running: !!iface.running,
          disabled: !!iface.disabled,
        } satisfies MikroTikPort
      })
      .filter((p): p is MikroTikPort => !!p)
      .sort(sortPorts)

    const snapshot = {
      identity: info.identity || null,
      model: info.model || null,
      version: info.version || null,
      mac: info.mac || null,
      portCount: info.portCount,
      ports,
      bridges: info.bridges || [],
      vlans: info.vlans || [],
      notes: [] as string[],
    }

    if (!ports.length) {
      snapshot.notes.push('No physical ethernet/SFP interfaces returned by the router.')
    }

    const updated = await prisma.mikrotikDevice.update({
      where: { id },
      data: {
        lastSync: new Date(),
        lastSnapshot: snapshot as object,
      },
      include: { site: { select: { id: true, name: true } } },
    })

    await prisma.auditLog.create({
      data: {
        actor: 'system',
        action: 'CAPTURE_MIKROTIK',
        target: id,
        details: {
          name: device.name,
          identity: snapshot.identity,
          ethernet: ports.filter(p => p.kind === 'ethernet').length,
          sfp: ports.filter(p => p.kind === 'sfp').length,
        },
        result: 'success',
      },
    })

    const { password: _, ...safe } = updated
    return {
      success: true,
      snapshot,
      updated: {
        ...safe,
        hasCredentials: !!(device.username && device.password),
      },
      summary: {
        ethernet: ports.filter(p => p.kind === 'ethernet').length,
        sfp: ports.filter(p => p.kind === 'sfp').length,
        running: ports.filter(p => p.running).length,
      },
    }
  } catch (error) {
    await prisma.auditLog.create({
      data: {
        actor: 'system',
        action: 'CAPTURE_MIKROTIK',
        target: id,
        details: { name: device.name, error: (error as Error).message },
        result: 'failure',
      },
    })
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to capture from ${device.name}: ${(error as Error).message}`,
    })
  }
})
