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
              <input
                v-if="renamingAgent"
                v-model="renameValue"
                type="text"
                autofocus
                class="input input-bordered input-sm w-64"
                placeholder="Alias"
                @keyup.enter="saveRename"
                @keyup.escape="renamingAgent = false"
                @blur="saveRename"
                @focus="($event.target as HTMLInputElement).select()"
              />
              <template v-else>
                <h1 class="type-headline">{{ agent.alias || agent.hostname }}</h1>
                <button class="btn btn-ghost btn-xs btn-square" @click="startRename">
                  <Pencil class="w-3.5 h-3.5" :stroke-width="2" />
                </button>
              </template>
              <span :class="['badge', getStatusBadgeClass(agent.status)]">{{ agent.status }}</span>
            </div>
            <p class="type-body-sm text-base-content/60 mt-1">
              {{ platformLabel(agent.platform) }}
              <span v-if="agent.alias"> • {{ agent.hostname }}</span>
              <span v-if="agent.osVersion"> • {{ agent.osVersion }}</span>
              <span v-if="agent.agentVersion"> • agent v{{ agent.agentVersion }}</span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button v-if="agent.platform !== 'WINDOWS' && agent.status === 'ONLINE' && agent.deviceId" class="btn btn-success gap-2" @click="showSshModal = true">
            <Terminal class="w-4 h-4" :stroke-width="2" /> SSH
          </button>
          <button v-if="agent.platform === 'WINDOWS' && agent.status === 'ONLINE' && agent.deviceId" class="btn btn-info gap-2" @click="showVncModal = true">
            <Monitor class="w-4 h-4" :stroke-width="2" /> Remote Desktop
          </button>
          <button
            v-if="agent.status === 'ONLINE'"
            class="btn btn-outline btn-warning gap-2"
            :disabled="powerActionPending !== null"
            @click="confirmPowerAction('restart')"
          >
            <span v-if="powerActionPending === 'restart'" class="loading loading-spinner loading-sm"></span>
            <RotateCcw v-else class="w-4 h-4" :stroke-width="2" />
            Restart
          </button>
          <button
            v-if="agent.status === 'ONLINE'"
            class="btn btn-outline btn-error gap-2"
            :disabled="powerActionPending !== null"
            @click="confirmPowerAction('shutdown')"
          >
            <span v-if="powerActionPending === 'shutdown'" class="loading loading-spinner loading-sm"></span>
            <Power v-else class="w-4 h-4" :stroke-width="2" />
            Shut Down
          </button>
          <button v-if="agent.status !== 'PENDING' && !isUpToDate" class="btn btn-outline gap-2" @click="showUpdateModal = true">
            <RefreshCw class="w-4 h-4" :stroke-width="2" /> Update Agent
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
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
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
        <div class="bg-base-100 border border-base-300 rounded-none p-4">
          <div class="flex items-center gap-2 text-base-content/60 text-sm mb-1">
            <Layers class="w-4 h-4" :stroke-width="2" /> Swap
          </div>
          <div class="text-2xl font-semibold">{{ formatPercent(agent.lastMetrics?.swapPercent) }}</div>
        </div>
      </div>

      <!-- History chart -->
      <div class="mb-6">
        <AgentMetricChart :agent-id="id" />
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
          <div v-if="agent.diskInfo?.length">
            <dt class="text-base-content/60">Disk drive{{ agent.diskInfo.length > 1 ? 's' : '' }}</dt>
            <dd class="font-medium">
              <div v-for="(disk, i) in agent.diskInfo" :key="i">
                {{ [disk.vendor, disk.model].filter(Boolean).join(' ') || 'Unknown' }}
              </div>
            </dd>
          </div>
          <div v-if="agent.memoryType || agent.memorySlotsTotal">
            <dt class="text-base-content/60">Memory</dt>
            <dd class="font-medium">
              {{ agent.memoryType || 'Unknown type' }}
              <span v-if="agent.memorySlotsTotal" class="text-base-content/60">
                · {{ agent.memorySlotsUsed ?? '?' }}/{{ agent.memorySlotsTotal }} slots used
              </span>
            </dd>
          </div>
          <div v-if="agent.vncPassword">
            <dt class="text-base-content/60">VNC Password</dt>
            <dd class="font-mono font-medium flex items-center gap-1">
              <span>{{ showVncPassword ? agent.vncPassword : '••••••••' }}</span>
              <button class="btn btn-ghost btn-xs btn-square" @click="showVncPassword = !showVncPassword">
                <component :is="showVncPassword ? EyeOff : Eye" class="w-3.5 h-3.5" :stroke-width="2" />
              </button>
              <button class="btn btn-ghost btn-xs btn-square" @click="copy(agent.vncPassword)">
                <Copy class="w-3.5 h-3.5" :stroke-width="2" />
              </button>
            </dd>
          </div>
          <div>
            <dt class="text-base-content/60">Load average (1 / 5 / 15m)</dt>
            <dd class="font-mono font-medium">{{ formatLoadAvg(agent.lastMetrics) }}</dd>
          </div>
          <div>
            <dt class="text-base-content/60">Logged-in users</dt>
            <dd class="font-medium">{{ agent.lastMetrics?.loggedInUsers?.join(', ') || '-' }}</dd>
          </div>
          <div>
            <dt class="text-base-content/60">Network I/O</dt>
            <dd class="font-mono font-medium">
              ↓{{ formatRate(agent.lastMetrics?.netRxBytesPerSec) }} ↑{{ formatRate(agent.lastMetrics?.netTxBytesPerSec) }}
            </dd>
          </div>
          <div>
            <dt class="text-base-content/60">Disk I/O</dt>
            <dd class="font-mono font-medium">
              R:{{ formatRate(agent.lastMetrics?.diskReadBytesPerSec) }} W:{{ formatRate(agent.lastMetrics?.diskWriteBytesPerSec) }}
            </dd>
          </div>
        </dl>

        <div v-if="agent.lastMetrics?.partitions?.length" class="mt-4 pt-4 border-t border-base-200">
          <div class="text-sm text-base-content/60 mb-2">Disk partitions</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div
              v-for="p in agent.lastMetrics.partitions"
              :key="p.mountpoint"
              class="flex items-center justify-between text-xs font-mono bg-base-200/50 px-2 py-1"
            >
              <span class="truncate">{{ p.mountpoint }}</span>
              <span class="font-medium shrink-0 ml-2">{{ formatPercent(p.percent) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Processes -->
      <div v-if="agent.lastMetrics?.topProcesses?.length" class="bg-base-100 border border-base-300 rounded-none p-6 mb-6">
        <h2 class="type-card-title mb-4">Top Processes (by memory)</h2>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr class="bg-base-200/50">
                <th>Process</th>
                <th>PID</th>
                <th>CPU</th>
                <th>Memory</th>
                <th v-if="agent.status === 'ONLINE'"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="proc in agent.lastMetrics.topProcesses" :key="proc.pid">
                <td class="font-medium">{{ proc.name }}</td>
                <td class="text-base-content/60">{{ proc.pid }}</td>
                <td>{{ formatPercent(proc.cpuPercent) }}</td>
                <td>{{ formatPercent(proc.memPercent) }}</td>
                <td v-if="agent.status === 'ONLINE'" class="text-right">
                  <button
                    class="btn btn-ghost btn-xs text-error gap-1"
                    :disabled="killingPid === proc.pid"
                    @click="confirmKillProcess(proc.pid, proc.name)"
                  >
                    <span v-if="killingPid === proc.pid" class="loading loading-spinner loading-xs"></span>
                    <XCircle v-else class="w-3.5 h-3.5" :stroke-width="2" />
                    Kill
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Remote Access -->
      <div class="bg-base-100 border border-base-300 rounded-none p-6">
        <h2 class="type-card-title mb-2">Remote Access</h2>
        <p v-if="agent.status === 'ONLINE'" class="type-body-sm text-base-content/60">
          {{ agent.platform === 'WINDOWS' ? 'VNC' : 'SSH' }} is relayed through this agent's own tunnel — no direct
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
        <div class="flex-1 overflow-y-auto">
          <SshTerminal
            v-if="agent?.deviceId"
            :device-id="agent.deviceId"
            :device-name="agent.hostname"
            device-ip="agent-tunnel"
            :via-agent="true"
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
        <div class="flex-1 overflow-y-auto">
          <VncViewer
            v-if="agent?.deviceId"
            :device-id="agent.deviceId"
            :device-name="agent.hostname"
            device-ip="agent-tunnel"
            :via-agent="true"
            :initial-password="agent.vncPassword"
          />
        </div>
      </div>
      <button type="button" class="modal-backdrop" aria-label="Close" @click="showVncModal = false" />
    </div>

    <!-- Update Agent Modal -->
    <div v-if="showUpdateModal" class="modal modal-open" role="dialog" aria-modal="true">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-1">Update Agent</h3>
        <p class="type-body-sm text-base-content/60 mb-4">
          Agents v0.6.0 and later check this server automatically. On Windows a
          tray notification appears; the user clicks Update and the service
          replaces the binary silently (credentials and VNC password stay put).
          Linux and macOS apply the same update without a prompt. Use the
          command below for agents still on an older build — after that, they
          self-update.
        </p>
        <div class="flex items-start gap-2">
          <pre class="flex-1 bg-base-300 text-xs p-3 rounded-none overflow-x-auto whitespace-pre-wrap break-all">{{ updateCommand }}</pre>
          <button class="btn btn-ghost btn-xs" @click="copy(updateCommand)"><Copy class="w-4 h-4" :stroke-width="2" /></button>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="showUpdateModal = false">Done</button>
        </div>
      </div>
      <button type="button" class="modal-backdrop" aria-label="Close" @click="showUpdateModal = false" />
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
            <div class="text-xs font-medium text-base-content/60 mb-1">Windows (PowerShell as Administrator — paste as-is, do not save a .ps1)</div>
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
import { ArrowLeft, Copy, Cpu, Download, Eye, EyeOff, ExternalLink, HardDrive, Layers, MemoryStick, Monitor, Pencil, Power, RefreshCw, RotateCcw, Terminal, Trash2, X, XCircle } from '@lucide/vue'
import type { AgentMetricsSnapshot, AgentSummary, InstallCommands } from '~/composables/useAgents'

const route = useRoute()
const id = route.params.id as string

const { data: agent, pending, refresh: refreshAgent } = await useFetch<AgentSummary>(`/api/agents/${id}`)

const { deleteAgent, regenerateInstall, updateAgentAlias, killProcess, sendPowerAction } = useAgents()

const installModal = ref<HTMLDialogElement | null>(null)
const installCommands = ref<InstallCommands | null>(null)
const tokenExpiresAt = ref<string | null>(null)
const showSshModal = ref(false)
const showVncModal = ref(false)
const showUpdateModal = ref(false)

const UPDATE_SCRIPT_BY_PLATFORM: Record<AgentSummary['platform'], string> = {
  WINDOWS: 'update-windows.ps1',
  LINUX: 'update-linux.sh',
  MACOS: 'update-macos.sh',
}

const updateCommand = computed(() => {
  if (!agent.value) return ''
  const appUrl = useRuntimeConfig().public.appUrl as string
  const script = UPDATE_SCRIPT_BY_PLATFORM[agent.value.platform]
    if (agent.value.platform === 'WINDOWS') {
      return `& ([scriptblock]::Create((irm -useb '${appUrl}/api/agents/install/${script}'))) -Server '${appUrl}'`
    }
  return `curl -fsSL ${appUrl}/api/agents/install/${script} | sudo bash -s -- --server '${appUrl}'`
})

// Only true once a reconnected agent has actually confirmed it's running the
// latest build (agentVersion is set on every hello, not just at enroll) —
// null/older means "unknown or stale," which should still offer the update.
const isUpToDate = computed(() => {
  const latest = useRuntimeConfig().public.agentLatestVersion as string
  return agent.value?.agentVersion === latest
})

async function showInstall() {
  const result = await regenerateInstall(id)
  installCommands.value = result.install
  tokenExpiresAt.value = result.tokenExpiresAt
  installModal.value?.showModal()
}

const showVncPassword = ref(false)
const renamingAgent = ref(false)
const renameValue = ref('')

function startRename() {
  if (!agent.value) return
  renameValue.value = agent.value.alias || agent.value.hostname
  renamingAgent.value = true
}

async function saveRename() {
  if (!renamingAgent.value || !agent.value) return
  renamingAgent.value = false
  const newAlias = renameValue.value.trim()
  if (newAlias === (agent.value.alias || agent.value.hostname)) return
  await updateAgentAlias(id, newAlias || null)
  await refreshAgent()
}

async function confirmDelete() {
  if (!agent.value) return
  const ok = await confirmDialog({
    title: 'Delete Agent',
    message: `Delete agent "${agent.value.hostname}"? This does not remove it from the target machine.`,
    confirmLabel: 'Delete',
    variant: 'danger',
  })
  if (!ok) return
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

const powerActionPending = ref<'restart' | 'shutdown' | null>(null)

async function confirmPowerAction(action: 'restart' | 'shutdown') {
  if (!agent.value) return
  const label = action === 'restart' ? 'Restart' : 'Shut Down'
  const ok = await confirmDialog({
    title: `${label} Machine`,
    message: `${label} "${agent.value.alias || agent.value.hostname}" now? Any unsaved work on that machine will be lost, and it will drop offline until it comes back up.`,
    confirmLabel: label,
    variant: 'danger',
  })
  if (!ok) return

  powerActionPending.value = action
  try {
    await sendPowerAction(id, action)
    alertDialog(`${label} command sent — the machine will go offline shortly.`)
    await refreshAgent()
  } catch (err: any) {
    alertDialog(err?.data?.statusMessage || err?.message || `Failed to ${action} the machine`)
  } finally {
    powerActionPending.value = null
  }
}

const killingPid = ref<number | null>(null)

async function confirmKillProcess(pid: number, name: string) {
  const ok = await confirmDialog({
    title: 'Kill Process',
    message: `Kill "${name}" (PID ${pid}) on ${agent.value?.alias || agent.value?.hostname}? This cannot be undone.`,
    confirmLabel: 'Kill',
    variant: 'danger',
  })
  if (!ok) return

  killingPid.value = pid
  try {
    await killProcess(id, pid, name)
    await refreshAgent()
  } catch (err: any) {
    alertDialog(err?.data?.statusMessage || err?.message || 'Failed to kill process')
  } finally {
    killingPid.value = null
  }
}

function formatRate(bytesPerSec: number | null | undefined): string {
  if (bytesPerSec == null) return '-'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let value = bytesPerSec
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

function formatLoadAvg(metrics: AgentMetricsSnapshot | null | undefined): string {
  if (!metrics || metrics.loadAvg1 == null) return '-'
  const fmt = (v: number | null | undefined) => (v == null ? '-' : v.toFixed(2))
  return `${fmt(metrics.loadAvg1)} / ${fmt(metrics.loadAvg5)} / ${fmt(metrics.loadAvg15)}`
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
