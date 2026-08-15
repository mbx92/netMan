<template>
  <div class="min-h-screen infra-shell flex flex-col">
    <!-- Sticky chrome: utility + top nav stay pinned together -->
    <div class="sticky top-0 z-50 shrink-0">
      <div class="utility-bar hidden md:flex">
        <span class="ops-chip ops-chip--live">FABRIC ONLINE</span>
        <span class="text-base-content/40">|</span>
        <span>NetMan · Infrastructure control</span>
        <ClientOnly>
          <span class="ml-auto type-mono text-base-content/50">{{ clockLabel }}</span>
          <template #fallback>
            <span class="ml-auto type-mono text-base-content/50 tabular-nums">----/--/-- --:--:--</span>
          </template>
        </ClientOnly>
      </div>

      <header class="top-nav flex items-center px-2 gap-1">
        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm lg:hidden"
          aria-label="Open menu"
          @click="mobileOpen = true"
        >
          <Menu class="w-5 h-5" :stroke-width="2" />
        </button>

        <NuxtLink to="/" class="flex items-center gap-3 px-2 flex-1 min-w-0">
          <div class="nav-brand-mark w-8 h-8 flex items-center justify-center shrink-0">
            <Network class="w-5 h-5 text-primary-content" :stroke-width="2" />
          </div>
          <div class="min-w-0 leading-tight">
            <div class="type-body-emphasis truncate">NetMan</div>
            <div class="type-mono text-base-content/50 truncate hidden sm:block">Network operations</div>
          </div>
        </NuxtLink>

        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm"
          :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
          @click="toggleTheme"
        >
          <Sun v-if="isDark" class="w-5 h-5" :stroke-width="2" />
          <Moon v-else class="w-5 h-5" :stroke-width="2" />
        </button>

        <ClientOnly>
          <UiNotificationBell />
          <template #fallback>
            <div class="btn btn-ghost btn-square btn-sm">
              <div class="w-5 h-5"></div>
            </div>
          </template>
        </ClientOnly>

        <ClientOnly>
          <UiAppDropdown align="end">
            <template #trigger>
              <button type="button" class="btn btn-ghost btn-square btn-sm avatar" aria-haspopup="menu">
                <div v-if="user?.avatarUrl" class="w-8 h-8 rounded-sm overflow-hidden">
                  <img :src="user.avatarUrl" :alt="user.name" class="w-full h-full object-cover" />
                </div>
                <div v-else class="w-8 h-8 rounded-sm bg-primary text-primary-content flex items-center justify-center">
                  <span class="type-caption font-semibold">{{ userInitials }}</span>
                </div>
              </button>
            </template>
            <template #default="{ close }">
              <ul class="menu w-56">
                <li class="menu-title">
                  <div class="flex flex-col gap-1 normal-case">
                    <span class="type-body-emphasis text-base-content">{{ user?.name || 'User' }}</span>
                    <span class="type-mono text-base-content/60">{{ user?.email || '' }}</span>
                  </div>
                </li>
                <li class="border-t border-base-300">
                  <NuxtLink to="/profile" @click="close()">Profile</NuxtLink>
                </li>
                <li>
                  <NuxtLink to="/settings" @click="close()">Settings</NuxtLink>
                </li>
                <li class="border-t border-base-300">
                  <button type="button" class="text-error" @click="close(); handleLogout()">
                    Logout
                  </button>
                </li>
              </ul>
            </template>
          </UiAppDropdown>
          <template #fallback>
            <div class="btn btn-ghost btn-square btn-sm">
              <div class="w-8 h-8 rounded-sm bg-base-300 animate-pulse"></div>
            </div>
          </template>
        </ClientOnly>
      </header>
    </div>

    <div class="flex flex-1 min-h-0">
      <div
        v-if="mobileOpen"
        class="fixed inset-0 z-40 bg-ink/40 lg:hidden"
        @click="mobileOpen = false"
      />

      <!-- Fixed viewport-height rail: stays pinned while main scrolls -->
      <aside
        class="sidebar-rail fixed z-40 left-0 top-12 md:top-[76px] h-[calc(100vh-48px)] md:h-[calc(100vh-76px)] bg-base-100 border-r border-base-300 flex flex-col transition-transform duration-200 ease-out lg:translate-x-0"
        :class="[
          sidebarCollapsed ? 'is-collapsed' : '',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ]"
      >
        <div class="flex flex-col h-full min-h-0">
          <nav class="flex-1 py-2 overflow-y-auto overflow-x-hidden min-h-0">
            <div class="sidebar-section">Operations</div>
            <NuxtLink
              v-for="item in opsLinks"
              :key="item.to"
              :to="item.to"
              class="sidebar-link"
              :class="tipClass"
              active-class="active"
              :data-tip="tip(item.label)"
              @click="mobileOpen = false"
            >
              <component :is="item.icon" class="w-5 h-5 shrink-0" :stroke-width="2" />
              <span class="sidebar-link-label truncate">{{ item.label }}</span>
            </NuxtLink>

            <div class="sidebar-section">Configuration</div>
            <NuxtLink
              v-for="item in configLinks"
              :key="item.to"
              :to="item.to"
              class="sidebar-link"
              :class="tipClass"
              active-class="active"
              :data-tip="tip(item.label)"
              @click="mobileOpen = false"
            >
              <component :is="item.icon" class="w-5 h-5 shrink-0" :stroke-width="2" />
              <span class="sidebar-link-label truncate">{{ item.label }}</span>
            </NuxtLink>

            <div class="sidebar-section">Observability</div>
            <NuxtLink
              v-for="item in observeLinks"
              :key="item.to"
              :to="item.to"
              class="sidebar-link"
              :class="tipClass"
              active-class="active"
              :data-tip="tip(item.label)"
              @click="mobileOpen = false"
            >
              <component :is="item.icon" class="w-5 h-5 shrink-0" :stroke-width="2" />
              <span class="sidebar-link-label truncate">{{ item.label }}</span>
            </NuxtLink>
          </nav>

          <div class="p-3 border-t border-base-300 shrink-0">
            <div class="sidebar-footer-panel infra-panel p-3 mb-2">
              <div class="type-mono text-base-content/50 mb-2">CONTROL PLANE</div>
              <div class="flex items-center gap-2">
                <span class="ops-chip ops-chip--live">HEALTHY</span>
              </div>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm sidebar-collapse-btn hidden lg:inline-flex justify-center gap-2"
              :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
              :aria-expanded="!sidebarCollapsed"
              @click="toggleSidebarCollapsed"
            >
              <PanelLeftOpen v-if="sidebarCollapsed" class="w-5 h-5 shrink-0" :stroke-width="2" />
              <PanelLeftClose v-else class="w-5 h-5 shrink-0" :stroke-width="2" />
              <span class="sidebar-link-label">{{ sidebarCollapsed ? 'Expand' : 'Collapse' }}</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- Spacer reserves layout width for the fixed rail -->
      <div
        class="hidden lg:block shrink-0"
        :class="sidebarCollapsed ? 'w-[4.5rem]' : 'w-64'"
        aria-hidden="true"
      />

      <!-- Full remaining column stays opaque so shell mesh never shows through -->
      <div class="flex-1 min-w-0 infra-main">
        <main class="p-6 w-full">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Menu,
  Network,
  Sun,
  Moon,
  LayoutDashboard,
  Monitor,
  Waypoints,
  Grid2x2,
  Radar,
  Building2,
  Router,
  Database,
  Boxes,
  ScrollText,
  Users,
  Video,
  Server,
  Bot,
  Activity,
  PanelLeftOpen,
  PanelLeftClose,
} from '@lucide/vue'

const { user, logout } = useAuth()
const { isDark, toggleTheme } = useTheme()

const SIDEBAR_KEY = 'netman.sidebar.collapsed'

const mobileOpen = ref(false)
const sidebarCookie = useCookie<string>(SIDEBAR_KEY, {
  sameSite: 'lax',
  default: () => '0',
})
const sidebarCollapsed = computed({
  get: () => sidebarCookie.value === '1',
  set: (value: boolean) => {
    sidebarCookie.value = value ? '1' : '0'
    if (import.meta.client) {
      localStorage.setItem(SIDEBAR_KEY, value ? '1' : '0')
    }
  },
})
const now = ref<Date | null>(null)

const tipClass = computed(() => (sidebarCollapsed.value ? 'tooltip tooltip-right' : ''))
const tip = (label: string) => (sidebarCollapsed.value ? label : undefined)

const clockLabel = computed(() => {
  if (!now.value) return '----/--/-- --:--:--'
  return now.value.toLocaleString('en-GB', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).replace(',', '')
})

const userInitials = computed(() => {
  if (!user.value?.name) return 'U'
  const names = user.value.name.split(' ')
  if (names.length >= 2) {
    return (names[0][0] + names[1][0]).toUpperCase()
  }
  return names[0].substring(0, 2).toUpperCase()
})

const opsLinks = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/devices', label: 'Devices', icon: Monitor },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/topology', label: 'Topology', icon: Waypoints },
  { to: '/ipam', label: 'IPAM', icon: Grid2x2 },
  { to: '/discovery', label: 'Discovery', icon: Radar },
]

const configLinks = [
  { to: '/sites', label: 'Sites', icon: Building2 },
  { to: '/settings/mikrotik', label: 'MikroTik', icon: Router },
  { to: '/nas', label: 'NAS Storage', icon: Database },
  { to: '/settings/device-types', label: 'Device Types', icon: Boxes },
  { to: '/hikvision', label: 'Hikvision', icon: Video },
  { to: '/proxmox', label: 'Proxmox', icon: Server },
  { to: '/users', label: 'Users', icon: Users },
]

const observeLinks = [
  { to: '/audit', label: 'Audit Logs', icon: ScrollText },
  { to: '/settings/database', label: 'DB Pool', icon: Activity },
]

const toggleSidebarCollapsed = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const handleLogout = async () => {
  const ok = await confirmDialog({
    title: 'Konfirmasi logout',
    message: 'Apakah Anda yakin ingin logout?',
    confirmLabel: 'Logout',
    cancelLabel: 'Batal',
    variant: 'danger',
  })
  if (!ok) return
  await logout()
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  const legacy = localStorage.getItem(SIDEBAR_KEY)
  if (legacy === '1' && sidebarCookie.value !== '1') {
    sidebarCollapsed.value = true
  } else {
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? '1' : '0')
  }
  now.value = new Date()
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>
