<template>
  <div class="animate-fade-in">
    <div v-if="pending" class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <template v-else-if="agent">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-3">
          <NuxtLink to="/agents" class="btn btn-ghost btn-sm btn-square">
            <ArrowLeft class="w-4 h-4" :stroke-width="2" />
          </NuxtLink>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="type-headline">{{ agent.hostname }}</h1>
              <span :class="['badge', getStatusBadgeClass(agent.status)]">{{ agent.status }}</span>
            </div>
            <p class="type-body-sm text-base-content/60 mt-1">
              {{ platformLabel(agent.platform) }}
              <span v-if="agent.osVersion"> • {{ agent.osVersion }}</span>
              <span v-if="agent.agentVersion"> • agent v{{ agent.agentVersion }}</span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button v-if="agent.status !== 'ONLINE'" class="btn btn-outline gap-2" @click="showInstall">
            <Download class="w-4 h-4" :stroke-width="2" /> Install Command
          </button>
          <NuxtLink v-if="agent.deviceId" :to="`/devices/${agent.deviceId}`" class="btn btn-ghost gap-2">
            <Monitor class="w-4 h-4" :stroke-width="2" /> View Device
          </NuxtLink>
          <button class="btn btn-ghost text-error gap-2" @click="confirmDelete">
            <Trash2 class="w-4 h-4" :stroke-width="2" /> Delete
          </button>
        </div>
      </div>

      <!-- Telemetry -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div class="bg-base-100 border border-base-300 rounded-none p-4">
          <div class="flex items-center gap-2 text-base-content/60 text-sm mb-1">
            <Cpu class="w-4 h-4" :stroke-width="2" /> CPU
          </div>
          <div class="text-2xl font-semibold">{{ formatPercent(agent.lastCpuPercent) }}</div>
        </div>
        <div class="bg-base-100 border border-base-300 rounded-none p-4">
          <div class="flex items-center gap-2 text-base-content/60 text-sm mb-1">
            <MemoryStick class="w-4 h-4" :stroke-width="2" /> Memory
          </div>
          <div class="text-2xl font-semibold">{{ formatPercent(agent.lastMemPercent) }}</div>
        </div>
        <div class="bg-base-100 border border-base-300 rounded-none p-4">
          <div class="flex items-center gap-2 text-base-content/60 text-sm mb-1">
            <HardDrive class="w-4 h-4" :stroke-width="2" /> Disk
          </div>
          <div class="text-2xl font-semibold">{{ formatPercent(agent.lastDiskPercent) }}</div>
        </div>
      </div>

      <!-- Details -->
      <div class="bg-base-100 border border-base-300 rounded-none p-6 mb-6">
        <h2 class="type-card-title mb-4">Details</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt class="text-base-content/60">Last seen</dt>
            <dd class="font-medium">{{ formatTimeAgo(agent.lastSeen) }}</dd>
          </div>
          <div>
            <dt class="text-base-content/60">Last IP</dt>
            <dd class="font-mono font-medium">{{ agent.lastIp || '-' }}</dd>
          </div>
          <div>
            <dt class="text-base-content/60">Uptime</dt>
            <dd class="font-medium">{{ formatUptime(agent.lastUptimeSec) }}</dd>
          </div>
          <div>
            <dt class="text-base-content/60">Linked device</dt>
            <dd class="font-medium">{{ agent.device?.name || '-' }}</dd>
          </div>
        </dl>
      </div>

      <!-- Remote access placeholder — wired up once tunnel support (Phase 2/3) ships -->
      <div class="bg-base-100 border border-base-300 rounded-none p-6">
        <h2 class="type-card-title mb-2">Remote Access</h2>
        <p class="type-body-sm text-base-content/60">
          {{ agent.platform === 'WINDOWS' ? 'Remote Desktop (RDP)-over-tunnel' : 'SSH-over-tunnel' }} is not enabled yet
          for this agent build — telemetry/monitoring only in this release.
        </p>
      </div>
    </template>

    <!-- Install Command Modal -->
    <dialog ref="installModal" class="modal">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-1">Install Command</h3>
        <p class="type-body-sm text-base-content/60 mb-4">
          Run this on the target machine. Token expires
          <span class="font-medium">{{ tokenExpiresAt ? formatTimeAgo(tokenExpiresAt) : '' }}</span>.
        </p>
        <div class="space-y-3">
          <div>
            <div class="text-xs font-medium text-base-content/60 mb-1">Windows (PowerShell, run as Administrator)</div>
            <div class="flex items-start gap-2">
              <pre class="flex-1 bg-base-300 text-xs p-3 rounded-none overflow-x-auto whitespace-pre-wrap break-all">{{ installCommands?.windows }}</pre>
              <button class="btn btn-ghost btn-xs" @click="copy(installCommands?.windows)"><Copy class="w-4 h-4" :stroke-width="2" /></button>
            </div>
          </div>
          <div>
            <div class="text-xs font-medium text-base-content/60 mb-1">Linux (root/sudo)</div>
            <div class="flex items-start gap-2">
              <pre class="flex-1 bg-base-300 text-xs p-3 rounded-none overflow-x-auto whitespace-pre-wrap break-all">{{ installCommands?.linux }}</pre>
              <button class="btn btn-ghost btn-xs" @click="copy(installCommands?.linux)"><Copy class="w-4 h-4" :stroke-width="2" /></button>
            </div>
          </div>
          <div>
            <div class="text-xs font-medium text-base-content/60 mb-1">macOS (root/sudo)</div>
            <div class="flex items-start gap-2">
              <pre class="flex-1 bg-base-300 text-xs p-3 rounded-none overflow-x-auto whitespace-pre-wrap break-all">{{ installCommands?.macos }}</pre>
              <button class="btn btn-ghost btn-xs" @click="copy(installCommands?.macos)"><Copy class="w-4 h-4" :stroke-width="2" /></button>
            </div>
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="installModal?.close()">Done</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Copy, Cpu, Download, HardDrive, MemoryStick, Monitor, Trash2 } from '@lucide/vue'
import type { AgentSummary, InstallCommands } from '~/composables/useAgents'

const route = useRoute()
const id = route.params.id as string

const { data: agent, pending } = await useFetch<AgentSummary>(`/api/agents/${id}`)

const { deleteAgent, regenerateInstall } = useAgents()

const installModal = ref<HTMLDialogElement | null>(null)
const installCommands = ref<InstallCommands | null>(null)
const tokenExpiresAt = ref<string | null>(null)

async function showInstall() {
  const result = await regenerateInstall(id)
  installCommands.value = result.install
  tokenExpiresAt.value = result.tokenExpiresAt
  installModal.value?.showModal()
}

async function confirmDelete() {
  if (!agent.value) return
  if (!confirm(`Delete agent "${agent.value.hostname}"? This does not remove it from the target machine.`)) return
  await deleteAgent(id)
  await navigateTo('/agents')
}

function copy(text: string | undefined) {
  if (!text) return
  navigator.clipboard.writeText(text)
}

function formatPercent(value: number | null | undefined): string {
  return value == null ? '-' : `${Math.round(value)}%`
}

function formatUptime(seconds: number | null | undefined): string {
  if (!seconds) return '-'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return `${days}d ${hours}h`
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

function getStatusBadgeClass(status: string): string {
  if (status === 'ONLINE') return 'badge-success'
  if (status === 'PENDING') return 'badge-warning'
  return 'badge-error'
}

function platformLabel(platform: AgentSummary['platform']): string {
  if (platform === 'WINDOWS') return 'Windows'
  if (platform === 'MACOS') return 'macOS'
  return 'Linux'
}
</script>
