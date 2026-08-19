import prisma from './prisma'

type PrinterRow = {
    name?: string
    host?: string
    network?: boolean
    deviceId?: string
    [key: string]: unknown
}

export async function attachPrinterDeviceIds(printerInfo: unknown): Promise<unknown> {
    if (!Array.isArray(printerInfo) || printerInfo.length === 0) return printerInfo

    const rows = printerInfo as PrinterRow[]
    const hosts = [...new Set(rows.map(p => p.host).filter((h): h is string => !!h))]
    if (hosts.length === 0) return printerInfo

    const devices = await prisma.device.findMany({
        where: { OR: [{ ip: { in: hosts } }, { hostname: { in: hosts } }] },
        select: { id: true, ip: true, hostname: true },
    })
    const byKey = new Map<string, string>()
    for (const d of devices) {
        if (d.ip) byKey.set(d.ip.toLowerCase(), d.id)
        if (d.hostname) byKey.set(d.hostname.toLowerCase(), d.id)
    }

    return rows.map((p) => {
        const key = p.host?.toLowerCase()
        const deviceId = key ? byKey.get(key) : undefined
        return deviceId ? { ...p, deviceId } : p
    })
}
