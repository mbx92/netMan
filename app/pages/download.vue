<template>
  <div class="animate-fade-in">
    <p class="page-kicker mb-2">Agents</p>
    <h1 class="type-headline mb-2">Download installer</h1>
    <p class="type-body-sm text-base-content/60 mb-8 max-w-2xl">
      Download the installer, copy it to the target machine, then paste the enrollment token
      from Agents → Add Agent. The token expires after 15 minutes.
    </p>

    <p v-if="version" class="type-mono text-base-content/50 mb-6">
      Latest agent v{{ version }}
    </p>

    <p v-if="errorMessage" class="alert alert-error mb-6">{{ errorMessage }}</p>

    <div class="space-y-3 max-w-2xl">
      <button
        v-for="row in rows"
        :key="row.id"
        type="button"
        class="flex items-center gap-4 border border-base-300 bg-base-100 px-4 py-4 hover:border-primary w-full text-left"
        :disabled="busy === row.id"
        @click="downloadInstaller(row)"
      >
        <component :is="row.icon" class="w-5 h-5 text-primary shrink-0" :stroke-width="2" />
        <div class="min-w-0 flex-1">
          <div class="type-body">{{ row.title }}</div>
          <div class="type-caption text-base-content/50">{{ row.hint }}</div>
        </div>
        <span v-if="busy === row.id" class="loading loading-spinner loading-sm" />
        <Download v-else class="w-4 h-4 text-base-content/40 shrink-0" :stroke-width="2" />
      </button>
    </div>

    <p class="type-caption text-base-content/50 mt-8 max-w-2xl">
      Windows: run the .exe and allow Administrator. Linux and macOS:
      <span class="font-mono">chmod +x netman-agent-setup.sh && sudo ./netman-agent-setup.sh</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { Download, Laptop, Monitor, Server } from '@lucide/vue'

const config = useRuntimeConfig()
const authStore = useAuthStore()
const version = computed(() => String(config.public.agentLatestVersion || ''))
const busy = ref('')
const errorMessage = ref('')

const rows = [
  {
    id: 'windows',
    title: 'Windows installer',
    hint: 'NetMan-Agent-Setup.exe — run as Administrator',
    href: '/api/agents/install/windows-setup',
    filename: 'NetMan-Agent-Setup.exe',
    icon: Monitor,
  },
  {
    id: 'linux',
    title: 'Linux installer',
    hint: 'netman-agent-setup.sh — run with sudo',
    href: '/api/agents/install/linux-setup.sh',
    filename: 'netman-agent-setup.sh',
    icon: Server,
  },
  {
    id: 'macos',
    title: 'macOS installer',
    hint: 'netman-agent-setup.sh — run with sudo',
    href: '/api/agents/install/macos-setup.sh',
    filename: 'netman-agent-setup.sh',
    icon: Laptop,
  },
]

async function downloadInstaller(row: (typeof rows)[number]) {
  errorMessage.value = ''
  busy.value = row.id
  try {
    const blob = await $fetch<Blob>(row.href, {
      responseType: 'blob',
      headers: {
        Authorization: `Bearer ${authStore.tokens?.accessToken || ''}`,
      },
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = row.filename
    a.click()
    URL.revokeObjectURL(url)
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string }; statusMessage?: string; message?: string }
    errorMessage.value = e?.data?.statusMessage || e?.statusMessage || e?.message || 'Download failed'
  } finally {
    busy.value = ''
  }
}
</script>
