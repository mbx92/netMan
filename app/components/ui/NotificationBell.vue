<template>
  <UiAppDropdown align="end">
    <template #trigger>
      <button
        type="button"
        class="btn btn-ghost btn-square btn-sm relative"
        aria-haspopup="menu"
        aria-label="Notifications"
      >
        <Bell class="w-5 h-5" :stroke-width="2" />
        <span
          v-if="unreadCount > 0"
          class="badge badge-error badge-sm absolute -top-1 -right-1 min-w-[1.1rem] px-1 justify-center"
        >{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
      </button>
    </template>
    <template #default="{ close }">
      <div class="w-80 max-h-96 flex flex-col">
        <div class="flex items-center justify-between p-3 border-b border-base-300">
          <span class="type-body-emphasis">Notifications</span>
          <button v-if="unreadCount > 0" type="button" class="btn btn-ghost btn-xs" @click="markAllRead">
            Mark all read
          </button>
        </div>
        <div class="overflow-y-auto flex-1">
          <div v-if="!loaded" class="p-6 text-center">
            <span class="loading loading-spinner loading-sm"></span>
          </div>
          <div v-else-if="!notifications.length" class="p-6 text-center text-base-content/60 type-body-sm">
            No notifications
          </div>
          <NuxtLink
            v-for="n in notifications"
            :key="n.id"
            :to="n.link || undefined"
            class="block p-3 border-b border-base-200 hover:bg-base-200/50"
            :class="{ 'bg-primary/5': !n.isRead }"
            @click="onSelect(n, close)"
          >
            <div class="flex items-start gap-2">
              <span class="w-2 h-2 rounded-full mt-1.5 shrink-0" :class="n.isRead ? '' : 'bg-primary'" />
              <div class="min-w-0">
                <div class="type-body-sm font-medium truncate">{{ n.title }}</div>
                <div class="type-caption text-base-content/60 line-clamp-2">{{ n.message }}</div>
                <div class="type-caption text-base-content/40 mt-1">{{ formatTimeAgo(n.createdAt) }}</div>
              </div>
            </div>
          </NuxtLink>
        </div>
      </div>
    </template>
  </UiAppDropdown>
</template>

<script setup lang="ts">
import { Bell } from '@lucide/vue'
import type { NotificationItem } from '~/composables/useNotifications'

const { notifications, unreadCount, loaded, fetchNotifications, markRead, markAllRead, connectStream, disconnectStream } =
  useNotifications()

function onSelect(n: NotificationItem, close: () => void) {
  markRead(n.id)
  close()
}

onMounted(() => {
  fetchNotifications()
  connectStream()
})
onUnmounted(() => {
  disconnectStream()
})
</script>
