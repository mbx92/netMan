<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="type-headline">Agents</h1>
        <p class="type-body-sm text-base-content/60 mt-1">
          Windows &amp; Linux machines monitored via the netMan agent — reachable even behind NAT
        </p>
      </div>
        <div class="flex items-center gap-2">
          <NuxtLink to="/download" class="btn btn-outline gap-2">
            <Download class="w-4 h-4" :stroke-width="2" />
            Installer
          </NuxtLink>
          <button class="btn btn-primary gap-2" @click="openCreateModal">
            <Plus class="w-4 h-4" :stroke-width="2" />
            Add Agent
          </button>
        </div>
    </div>

    <!-- Agent Table -->
    <div class="bg-base-100 border border-base-300 rounded-none overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr class="bg-base-200/50">
              <th>Status</th>
              <th>Hostname</th>
              <th>Platform</th>
              <th>CPU</th>
              <th>Memory</th>
              <th>Disk</th>
              <th>Last Seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending" class="h-32">
              <td colspan="8" class="text-center">
                <span class="loading loading-spinner loading-lg text-primary"></span>
              </td>
            </tr>
            <tr v-else-if="!agents?.length" class="h-32">
              <td colspan="8" class="text-center text-base-content/60">
                No agents enrolled yet — click "Add Agent" to install one on a Windows PC or Linux server
              </td>
            </tr>
            <tr
              v-for="agent in agents"
              :key="agent.id"
              class="hover:bg-base-200/50 cursor-pointer"
              @click="navigateTo(`/agents/${agent.id}`)"
            >
              <td>
                <div class="flex items-center gap-2">
                  <div :class="['w-2.5 h-2.5 rounded-full', getStatusDotClass(agent.status)]"></div>
                  <span :class="['badge badge-sm', getStatusBadgeClass(agent.status)]">{{ agent.status }}</span>
                </div>
              </td>
              <td>
                <div v-if="renamingAgentId === agent.id" class="flex items-center gap-1" @click.stop>
                  <input
                    v-model="renameValue"
                    type="text"
                    autofocus
                    class="input input-bordered input-xs w-40"
                    placeholder="Alias"
                    @keyup.enter="saveRename(agent)"
                    @keyup.escape="cancelRename"
                    @blur="saveRename(agent)"
                    @focus="($event.target as HTMLInputElement).select()"
                  />
                </div>
                <div v-else class="flex items-center gap-1.5 group">
                  <div class="font-medium">{{ agent.alias || agent.hostname }}</div>
                  <button
                    class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 shrink-0 px-1"
                    @click.stop="startRename(agent)"
                  >
                    <Pencil class="w-3 h-3" :stroke-width="2" />
                  </button>
                </div>
                <div v-if="agent.alias" class="text-xs text-base-content/60">{{ agent.hostname }}</div>
                <div v-if="agent.agentVersion" class="text-xs text-base-content/60">v{{ agent.agentVersion }}</div>
              </td>
              <td>
                <span class="badge badge-ghost gap-1">
                  <component :is="platformIcon(agent.platform)" class="w-3 h-3" :stroke-width="2" />
                  {{ platformLabel(agent.platform) }}
                </span>
              </td>
              <td class="text-sm">{{ formatPercent(agent.lastCpuPercent) }}</td>
              <td class="text-sm">{{ formatPercent(agent.lastMemPercent) }}</td>
              <td class="text-sm">{{ formatPercent(agent.lastDiskPercent) }}</td>
              <td class="text-sm text-base-content/60">{{ formatTimeAgo(agent.lastSeen) }}</td>
              <td>
                <div class="flex items-center gap-1" @click.stop>
                  <button
                    v-if="agent.status !== 'ONLINE'"
                    class="btn btn-ghost btn-xs tooltip"
                    data-tip="Re-generate install command"
                    @click="showInstall(agent)"
                  >
                    <Download class="w-4 h-4" :stroke-width="2" />
                  </button>
                  <NuxtLink :to="`/agents/${agent.id}`" class="btn btn-ghost btn-xs">
                    <Eye class="w-4 h-4" :stroke-width="2" />
                  </NuxtLink>
                  <button class="btn btn-ghost btn-xs text-error" @click="confirmDelete(agent)">
                    <Trash2 class="w-4 h-4" :stroke-width="2" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="p-4 border-t border-base-200 text-sm text-base-content/60">
        Total: {{ agents?.length || 0 }} agents
      </div>
    </div>

    <!-- Add Agent Modal -->
    <dialog ref="createModal" class="modal">
      <div class="modal-box max-w-[586px]">
        <h3 class="font-bold text-lg mb-4">Add Agent</h3>
        <form class="space-y-4" @submit.prevent="submitCreate">
          <div class="form-control">
            <label class="label"><span class="label-text">Platform</span></label>
            <div class="join">
              <button
                type="button"
                :class="['btn btn-sm join-item', form.platform === 'WINDOWS' ? 'btn-primary' : 'btn-outline']"
                @click="form.platform = 'WINDOWS'"
              >
                <Monitor class="w-4 h-4" :stroke-width="2" /> Windows
              </button>
              <button
                type="button"
                :class="['btn btn-sm join-item', form.platform === 'LINUX' ? 'btn-primary' : 'btn-outline']"
                @click="form.platform = 'LINUX'"
              >
                <Server class="w-4 h-4" :stroke-width="2" /> Linux
              </button>
              <button
                type="button"
                :class="['btn btn-sm join-item', form.platform === 'MACOS' ? 'btn-primary' : 'btn-outline']"
                @click="form.platform = 'MACOS'"
              >
                <Laptop class="w-4 h-4" :stroke-width="2" /> macOS
              </button>
            </div>
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Name (optional)</span></label>
            <input v-model="form.name" type="text" class="input input-bordered w-full" placeholder="e.g. Finance PC 12" />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Site (optional)</span></label>
            <select v-model="form.siteId" class="select select-bordered w-full">
              <option value="">No site</option>
              <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
            </select>
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="closeCreateModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="creating">
              <span v-if="creating" class="loading loading-spinner loading-sm"></span>
              Generate Install Command
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop"><button @click="closeCreateModal">close</button></form>
    </dialog>

    <!-- Install Command Modal -->
    <dialog ref="installModal" class="modal">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-1">Install Command</h3>
        <p class="type-body-sm text-base-content/60 mb-4">
          Run this on the target machine. The token expires
          <span class="font-medium">{{ tokenExpiresAt ? formatTimeAgo(tokenExpiresAt) : '' }}</span>
          — regenerate from the agent list if it lapses before install.
        </p>

        <div class="space-y-3">
          <div>
            <div class="text-xs font-medium text-base-content/60 mb-1 flex items-center gap-1">
              <Monitor class="w-3.5 h-3.5" :stroke-width="2" /> Windows (PowerShell as Administrator — paste as-is, do not save a .ps1)
            </div>
            <div class="flex items-start gap-2">
              <pre class="flex-1 bg-base-300 text-xs p-3 rounded-none overflow-x-auto whitespace-pre-wrap break-all">{{ installCommands?.windows }}</pre>
              <button class="btn btn-ghost btn-xs" @click="copy(installCommands?.windows)">
                <Copy class="w-4 h-4" :stroke-width="2" />
              </button>
            </div>
          </div>
          <div>
            <div class="text-xs font-medium text-base-content/60 mb-1 flex items-center gap-1">
              <Server class="w-3.5 h-3.5" :stroke-width="2" /> Linux (root/sudo)
            </div>
            <div class="flex items-start gap-2">
              <pre class="flex-1 bg-base-300 text-xs p-3 rounded-none overflow-x-auto whitespace-pre-wrap break-all">{{ installCommands?.linux }}</pre>
              <button class="btn btn-ghost btn-xs" @click="copy(installCommands?.linux)">
                <Copy class="w-4 h-4" :stroke-width="2" />
              </button>
            </div>
          </div>
          <div>
            <div class="text-xs font-medium text-base-content/60 mb-1 flex items-center gap-1">
              <Laptop class="w-3.5 h-3.5" :stroke-width="2" /> macOS (root/sudo)
            </div>
            <div class="flex items-start gap-2">
              <pre class="flex-1 bg-base-300 text-xs p-3 rounded-none overflow-x-auto whitespace-pre-wrap break-all">{{ installCommands?.macos }}</pre>
              <button class="btn btn-ghost btn-xs" @click="copy(installCommands?.macos)">
                <Copy class="w-4 h-4" :stroke-width="2" />
              </button>
            </div>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-primary" @click="closeInstallModal">Done</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button @click="closeInstallModal">close</button></form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { Copy, Download, Eye, Laptop, Monitor, Pencil, Plus, Server, Trash2 } from '@lucide/vue'
import type { AgentSummary, InstallCommands } from '~/composables/useAgents'

const { data: agents, pending, refresh: loadAgents } = await useFetch<AgentSummary[]>('/api/agents')

interface Site { id: string; name: string }
const { data: sitesData } = await useFetch<{ sites: Site[] }>('/api/sites')
const sites = computed(() => sitesData.value?.sites || [])

const { createAgent, deleteAgent, regenerateInstall, updateAgentAlias } = useAgents()

const createModal = ref<HTMLDialogElement | null>(null)
const installModal = ref<HTMLDialogElement | null>(null)
const creating = ref(false)
const installCommands = ref<InstallCommands | null>(null)
const tokenExpiresAt = ref<string | null>(null)

const form = reactive({ platform: 'WINDOWS' as AgentSummary['platform'], name: '', siteId: '' })

function openCreateModal() {
  form.platform = 'WINDOWS'
  form.name = ''
  form.siteId = ''
  createModal.value?.showModal()
}
function closeCreateModal() {
  createModal.value?.close()
}
function closeInstallModal() {
  installModal.value?.close()
}

async function submitCreate() {
  creating.value = true
  try {
    const result = await createAgent({
      platform: form.platform,
      name: form.name || undefined,
      siteId: form.siteId || undefined,
    })
    closeCreateModal()
    installCommands.value = result.install
    tokenExpiresAt.value = result.tokenExpiresAt
    installModal.value?.showModal()
    await loadAgents()
  } catch (e: any) {
    await alertDialog({
      title: 'Failed to Create Agent',
      message: e?.data?.statusMessage || 'Failed to create agent',
      variant: 'danger',
    })
  } finally {
    creating.value = false
  }
}

async function showInstall(agent: AgentSummary) {
  const result = await regenerateInstall(agent.id)
  installCommands.value = result.install
  tokenExpiresAt.value = result.tokenExpiresAt
  installModal.value?.showModal()
  await loadAgents()
}

async function confirmDelete(agent: AgentSummary) {
  const ok = await confirmDialog({
    title: 'Delete Agent',
    message: `Delete agent "${agent.hostname}"? This does not remove it from the target machine.`,
    confirmLabel: 'Delete',
    variant: 'danger',
  })
  if (!ok) return
  await deleteAgent(agent.id)
  await loadAgents()
}

function copy(text: string | undefined) {
  if (!text) return
  navigator.clipboard.writeText(text)
}

const renamingAgentId = ref<string | null>(null)
const renameValue = ref('')

function startRename(agent: AgentSummary) {
  renamingAgentId.value = agent.id
  renameValue.value = agent.alias || agent.hostname
}

function cancelRename() {
  renamingAgentId.value = null
}

async function saveRename(agent: AgentSummary) {
  if (renamingAgentId.value !== agent.id) return // already saved or cancelled
  renamingAgentId.value = null
  const newAlias = renameValue.value.trim()
  if (newAlias === (agent.alias || agent.hostname)) return
  await updateAgentAlias(agent.id, newAlias || null)
  await loadAgents()
}

function formatPercent(value: number | null): string {
  return value == null ? '-' : `${Math.round(value)}%`
}

function getStatusDotClass(status: string): string {
  if (status === 'ONLINE') return 'bg-success'
  if (status === 'PENDING') return 'bg-warning'
  return 'bg-error'
}

function getStatusBadgeClass(status: string): string {
  if (status === 'ONLINE') return 'badge-success'
  if (status === 'PENDING') return 'badge-warning'
  return 'badge-error'
}

function platformIcon(platform: AgentSummary['platform']) {
  if (platform === 'WINDOWS') return Monitor
  if (platform === 'MACOS') return Laptop
  return Server
}

function platformLabel(platform: AgentSummary['platform']): string {
  if (platform === 'WINDOWS') return 'Windows'
  if (platform === 'MACOS') return 'macOS'
  return 'Linux'
}
</script>
