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
              {{ agent.platform === 'WINDOWS' ? 'Windows' : 'Linux' }}
              <span v-if="agent.osVersion"> • {{ agent.osVersion }}</span>
              <span v-if="agent.agentVersion"> • agent v{{ agent.agentVersion }}</span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button v-if="agent.platform === 'LINUX' && agent.status === 'ONLINE' && agent.deviceId" class="btn btn-success gap-2" @click="showSshModal = true">
            <Terminal class="w-4 h-4" :stroke-width="2" /> SSH
          </button>
          <button v-if="agent.platform === 'WINDOWS' && agent.status === 'ONLINE' && agent.deviceId" class="btn btn-info gap-2" @click="showVncModal = true">
            <Monitor class="w-4 h-4" :stroke-width="2" /> Remote Desktop
          </button>
          <button v-if="agent.status !== 'ONLINE'" class="btn btn-outline gap-2" @click="showInstall">
            <Download class="w-4 h-4" :stroke-width="2" /> Install Command
          </button>
          <NuxtLink v-if="agent.deviceId" :to="`/devices/${agent.deviceId}`" class="btn btn-ghost gap-2">
            <ExternalLink class="w-4 h-4" :stroke-width="2" /> View Device
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

      <!-- Remote Access -->
      <div class="bg-base-100 border border-base-300 rounded-none p-6">
        <h2 class="type-card-title mb-2">Remote Access</h2>
        <p v-if="agent.status === 'ONLINE'" class="type-body-sm text-base-content/60">
          {{ agent.platform === 'LINUX' ? 'SSH' : 'VNC' }} is relayed through this agent's own tunnel — no direct
          network path to the machine is needed.
        </p>
        <p v-else class="type-body-sm text-base-content/60">
          Agent must be online to open a remote session.
        </p>
      </div>
    </template>

    <!-- SSH Terminal Modal (Linux agents) -->
    <div v-if="showSshModal" class="modal modal-open" role="dialog" aria-modal="true">
      <div class="modal-box max-w-4xl h-[80vh] p-0 flex flex-col rounded-none">
        <div class="flex items-center justify-between p-4 border-b border-base-200">
          <h3 class="type-card-title">SSH Terminal - {{ agent?.hostname }}</h3>
          <button type="button" class="btn btn-sm btn-circle btn-ghost" @click="showSshModal = false">
            <X class="w-5 h-5" :stroke-width="2" />
          </button>
        </div>
        <div class="flex-1 overflow-hidden">
          <SshTerminal
            v-if="agent?.deviceId"
            :device-id="agent.deviceId"
            :device-name="agent.hostname"
            device-ip="agent-tunnel"
          />
        </div>
      </div>
      <button type="button" class="modal-backdrop" aria-label="Close" @click="showSshModal = false" />
    </div>

    <!-- VNC Viewer Modal (Windows agents) -->
    <div v-if="showVncModal" class="modal modal-open" role="dialog" aria-modal="true">
      <div class="modal-box max-w-6xl h-[85vh] p-0 flex flex-col rounded-none">
        <div class="flex items-center justify-between p-4 border-b border-base-200">
          <h3 class="type-card-title">Remote Desktop - {{ agent?.hostname }}</h3>
          <button type="button" class="btn btn-sm btn-circle btn-ghost" @click="showVncModal = false">
            <X class="w-5 h-5" :stroke-width="2" />
          </button>
        </div>
        <div class="flex-1 overflow-hidden">
          <VncViewer
            v-if="agent?.deviceId"
            :device-id="agent.deviceId"
            :device-name="agent.hostname"
            device-ip="agent-tunnel"
          />
        </div>
      </div>
      <button type="button" class="modal-backdrop" aria-label="Close" @click="showVncModal = false" />
    </div>

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
import { ArrowLeft, Copy, Cpu, Download, ExternalLink, HardDrive, MemoryStick, Monitor, Terminal, Trash2, X } from '@lucide/vue'
import type { AgentSummary, InstallCommands } from '~/composables/useAgents'

const route = useRoute()
const id = route.params.id as string

const { data: agent, pending } = await useFetch<AgentSummary>(`/api/agents/${id}`)

const { deleteAgent, regenerateInstall } = useAgents()

const installModal = ref<HTMLDialogElement | null>(null)
const installCommands = ref<InstallCommands | null>(null)
const tokenExpiresAt = ref<string | null>(null)
const showSshModal = ref(false)
const showVncModal = ref(false)

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
</script>
