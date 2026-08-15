export interface NotificationItem {
  id: string
  type: string
  severity: string
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

const notifications = reactive<NotificationItem[]>([])
const unreadCount = ref(0)
const loaded = ref(false)
let eventSource: EventSource | null = null

async function fetchNotifications() {
  const result = await $fetch<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications', {
    query: { limit: 20, offset: 0 },
  })
  notifications.splice(0, notifications.length, ...result.notifications)
  unreadCount.value = result.unreadCount
  loaded.value = true
}

async function markRead(id: string) {
  const item = notifications.find((n) => n.id === id)
  if (item && !item.isRead) {
    item.isRead = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }
  await $fetch(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {})
}

async function markAllRead() {
  notifications.forEach((n) => {
    n.isRead = true
  })
  unreadCount.value = 0
  await $fetch('/api/notifications/mark-all-read', { method: 'POST' }).catch(() => {})
}

function connectStream() {
  if (eventSource) return
  eventSource = new EventSource('/api/notifications/stream')
  eventSource.addEventListener('notification', (event) => {
    const n = JSON.parse((event as MessageEvent).data) as NotificationItem
    notifications.unshift(n)
    if (!n.isRead) unreadCount.value++
  })
  eventSource.addEventListener('error', () => {
    eventSource?.close()
    eventSource = null
    setTimeout(connectStream, 5000)
  })
}

function disconnectStream() {
  eventSource?.close()
  eventSource = null
}

export function useNotifications() {
  return {
    notifications,
    unreadCount,
    loaded,
    fetchNotifications,
    markRead,
    markAllRead,
    connectStream,
    disconnectStream,
  }
}
