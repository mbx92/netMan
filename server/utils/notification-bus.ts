import type { Notification } from '@prisma/client'

type Listener = (notification: Notification) => void

const listeners = new Set<Listener>()

export function subscribeNotifications(fn: Listener): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
}

export function publishNotification(notification: Notification): void {
    for (const fn of listeners) fn(notification)
}
