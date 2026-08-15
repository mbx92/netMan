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
      <button class="btn btn-primary gap-2" @click="openCreateModal">
        <Plus class="w-4 h-4" :stroke-width="2" />
        Add Agent
      </button>
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
                <div class="font-medium">{{ agent.hostname }}</div>
                <div v-if="agent.agentVersion" class="text-xs text-base-content/60">v{{ agent.agentVersion }}</div>
              </td>
              <td>
                <span class="badge badge-ghost gap-1">
                  <component :is="agent.platform === 'WINDOWS' ? Monitor : Server" class="w-3 h-3" :stroke-width="2" />
                  {{ agent.platform === 'WINDOWS' ? 'Windows' : 'Linux' }}
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
      <div class="modal-box max-w-lg">
        <h3 class="font-bold text-lg mb-4">Add Agent</h3>
        <form class="space-y-4" @submit.prevent="submitCreate">
          <div class="form-control">
            <label class="label"><span class="label-text">Platform</span></label>
            <div class="join w-full">
              <button
                type="button"
                :class="['btn join-item flex-1', form.platform === 'WINDOWS' ? 'btn-primary' : 'btn-outline']"
                @click="form.platform = 'WINDOWS'"
              >
                <Monitor class="w-4 h-4" :stroke-width="2" /> Windows PC
              </button>
              <button
                type="button"
                :class="['btn join-item flex-1', form.platform === 'LINUX' ? 'btn-primary' : 'btn-outline']"
                @click="form.platform = 'LINUX'"
              >
                <Server class="w-4 h-4" :stroke-width="2" /> Linux Server
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
              <Monitor class="w-3.5 h-3.5" :stroke-width="2" /> Windows (PowerShell, run as Administrator)
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
import { Copy, Download, Eye, Monitor, Plus, Server, Trash2 } from '@lucide/vue'
import type { AgentSummary, InstallCommands } from '~/composables/useAgents'

const { data: agents, pending, refresh: loadAgents } = await useFetch<AgentSummary[]>('/api/agents')

interface Site { id: string; name: string }
const { data: sitesData } = await useFetch<Site[]>('/api/sites')
const sites = computed(() => sitesData.value || [])

const { createAgent, deleteAgent, regenerateInstall } = useAgents()

const createModal = ref<HTMLDialogElement | null>(null)
const installModal = ref<HTMLDialogElement | null>(null)
const creating = ref(false)
const installCommands = ref<InstallCommands | null>(null)
const tokenExpiresAt = ref<string | null>(null)

const form = reactive({ platform: 'WINDOWS' as 'WINDOWS' | 'LINUX', name: '', siteId: '' })

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
    alert(e?.data?.statusMessage || 'Failed to create agent')
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
  if (!confirm(`Delete agent "${agent.hostname}"? This does not remove it from the target machine.`)) return
  await deleteAgent(agent.id)
  await loadAgents()
}

function copy(text: string | undefined) {
  if (!text) return
  navigator.clipboard.writeText(text)
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
</script>
