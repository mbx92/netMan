<template>
  <div class="animate-fade-in">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <p class="page-kicker mb-2">Operations</p>
        <h1 class="type-headline">Network Topology</h1>
        <p class="type-body-sm text-base-content/60 mt-1">Visual overview of your network infrastructure</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <select v-model="selectedSiteId" class="select select-bordered select-sm w-auto" @change="loadTopology">
          <option value="">All Sites</option>
          <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
        </select>
        <select v-model="selectedFloor" class="select select-bordered select-sm w-auto" @change="loadTopology">
          <option value="">All Floors</option>
          <option v-for="floor in floors" :key="floor" :value="floor">{{ floor }}</option>
        </select>
        <input
          v-model="locationSearch"
          type="text"
          placeholder="Location..."
          class="input input-bordered input-sm w-32"
          @input="debouncedSearch"
        />
        <button class="btn btn-outline btn-sm gap-2" :disabled="loading" @click="loadTopology">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" :stroke-width="2" />
          Refresh
        </button>
        <button class="btn btn-ghost btn-sm" :disabled="!flowNodes.length || !hasSettledOnce" @click="refit">
          Fit view
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
      <div v-for="card in statCards" :key="card.label" class="stat-card p-3">
        <div class="text-2xl font-bold" :class="card.className">
          <template v-if="initialLoading">
            <span class="inline-block h-7 w-10 bg-base-200 animate-pulse" />
          </template>
          <template v-else>{{ card.value }}</template>
        </div>
        <div class="type-caption text-base-content/60">{{ card.label }}</div>
      </div>
    </div>

    <div class="bg-base-100 border border-base-300 rounded-none overflow-hidden relative">
      <!-- First load skeleton -->
      <div
        v-if="initialLoading"
        class="flex flex-col items-center justify-center h-[600px] gap-4 topology-skeleton"
      >
        <div class="topology-skeleton__tiers" aria-hidden="true">
          <div class="topology-skeleton__row">
            <span /><span />
          </div>
          <div class="topology-skeleton__row">
            <span /><span /><span />
          </div>
          <div class="topology-skeleton__row">
            <span /><span /><span /><span /><span />
          </div>
        </div>
        <p class="type-mono text-base-content/50">Mapping fabric…</p>
      </div>

      <div
        v-else-if="!initialLoading && topologyNodes.length === 0"
        class="flex flex-col items-center justify-center h-[600px] text-center p-8"
      >
        <div class="w-20 h-20 rounded-none bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <Waypoints class="w-10 h-10 text-primary" :stroke-width="2" />
        </div>
        <h3 class="type-card-title mb-2">No Devices Found</h3>
        <p class="type-body-sm text-base-content/60 max-w-[28rem]">
          Add devices in the Devices page or configure MikroTik routers to see your network topology.
        </p>
      </div>

      <ClientOnly v-else>
        <div
          class="h-[600px] topology-canvas"
          :class="{ 'is-settling': !hasSettledOnce, 'is-refreshing': refreshing }"
        >
          <VueFlow
            id="netman-topology"
            v-model:nodes="flowNodes"
            v-model:edges="flowEdges"
            :node-types="nodeTypes"
            :edge-types="edgeTypes"
            :default-viewport="{ zoom: 0.9, x: 0, y: 0 }"
            :min-zoom="0.15"
            :max-zoom="2"
            :nodes-draggable="true"
            :nodes-connectable="false"
            :elements-selectable="true"
            @node-click="onNodeClick"
          >
            <Background :gap="24" :size="1" :color="gridColor" />
            <Controls :show-interactive="false" class="topology-controls" />
            <MiniMap
              class="topology-minimap"
              :node-color="miniMapNodeColor"
              :mask-color="minimapMask"
            />
          </VueFlow>

          <div v-if="refreshing" class="topology-canvas__overlay">
            <span class="loading loading-spinner loading-md text-primary" />
          </div>
        </div>
        <template #fallback>
          <div class="flex items-center justify-center h-[600px]">
            <span class="loading loading-spinner loading-lg text-primary" />
          </div>
        </template>
      </ClientOnly>
    </div>

    <div class="mt-4 bg-base-100 border border-base-300 rounded-none p-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 type-body-sm">
        <div>
          <div class="type-body-emphasis mb-2">Device Types</div>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="dt in deviceTypes"
              :key="dt.code"
              class="flex items-center gap-1"
            >
              <div
                class="w-3 h-3 rounded-none"
                :style="{ backgroundColor: dt.color || '#6b7280' }"
              />
              <span>{{ dt.name }}</span>
            </div>
          </div>
        </div>

        <div>
          <div class="type-body-emphasis mb-2">Connection Types</div>
          <div class="flex flex-wrap gap-3">
            <div class="flex items-center gap-1">
              <svg class="w-6 h-2" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke="#525252" stroke-width="2"/></svg>
              <span>Physical</span>
            </div>
            <div class="flex items-center gap-1">
              <svg class="w-6 h-2" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke="#0f62fe" stroke-width="2"/></svg>
              <span>Uplink</span>
            </div>
            <div class="flex items-center gap-1">
              <svg class="w-6 h-2" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke="#525252" stroke-width="1.5" stroke-dasharray="4,4"/></svg>
              <span>Virtual (VM)</span>
            </div>
          </div>
        </div>

        <div>
          <div class="type-body-emphasis mb-2">Status</div>
          <div class="flex gap-3">
            <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-full bg-success ring-2 ring-success/50" /> Online</div>
            <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-full bg-error ring-2 ring-error/50" /> Offline</div>
          </div>
        </div>
      </div>
    </div>

    <dialog class="modal" :class="{ 'modal-open': selectedNode }" :open="selectedNode || undefined" @close="selectedNode = null">
      <div class="modal-box glass-modal rounded-none">
        <div class="flex items-center gap-3 mb-4">
          <div :class="['w-12 h-12 rounded-none flex items-center justify-center', getNodeBgClass(selectedNode)]">
            <Router v-if="selectedNode?.type === 'router'" class="w-6 h-6" :stroke-width="2" />
            <EthernetPort v-else-if="selectedNode?.type === 'switch'" class="w-6 h-6" :stroke-width="2" />
            <Monitor v-else class="w-6 h-6" :stroke-width="2" />
          </div>
          <div>
            <h3 class="type-card-title">{{ selectedNode?.name }}</h3>
            <span :class="['badge badge-sm', selectedNode?.status === 'online' ? 'badge-success' : selectedNode?.status === 'offline' ? 'badge-error' : 'badge-ghost']">
              {{ selectedNode?.status || 'Unknown' }}
            </span>
          </div>
        </div>

        <div class="space-y-2 type-body-sm">
          <div class="flex justify-between"><span class="text-base-content/60">Type:</span><span class="capitalize">{{ selectedNode?.type }}</span></div>
          <div v-if="selectedNode?.ip" class="flex justify-between"><span class="text-base-content/60">IP:</span><span class="font-mono">{{ selectedNode.ip }}</span></div>
          <div v-if="selectedNode?.mac" class="flex justify-between"><span class="text-base-content/60">MAC:</span><span class="font-mono">{{ formatMac(selectedNode.mac) }}</span></div>
          <div v-if="selectedNode?.siteName" class="flex justify-between"><span class="text-base-content/60">Site:</span><span>{{ selectedNode.siteName }}</span></div>
          <div v-if="selectedNode?.ports" class="flex justify-between"><span class="text-base-content/60">Ports:</span><span>{{ selectedNode.ports }}</span></div>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="selectedNode = null">Close</button>
          <NuxtLink v-if="selectedNode?.id.startsWith('device-')" :to="`/devices/${selectedNode.id.replace('device-', '')}`" class="btn btn-primary">
            View Details
          </NuxtLink>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button @click="selectedNode = null">close</button></form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { markRaw } from 'vue'
import { EthernetPort, Monitor, RefreshCw, Router, Waypoints } from '@lucide/vue'
import {
  VueFlow,
  useVueFlow,
  type Node,
  type Edge,
  type NodeMouseEvent,
} from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import TopologyDeviceNode from '~/components/topology/TopologyDeviceNode.vue'
import TopologyEdge from '~/components/topology/TopologyEdge.vue'
import dagre from 'dagre'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

interface TopologyNode {
  id: string
  name: string
  type: 'router' | 'switch' | 'access_point' | 'server' | 'pc' | 'nas' | 'printer' | 'camera' | 'smart_tv' | 'vm' | 'unknown'
  typeCode: string
  ip?: string
  mac?: string
  siteId?: string
  siteName?: string
  status?: 'online' | 'offline' | 'unknown'
  ports?: number
  tier?: number
}

interface TopologyLink {
  source: string
  target: string
  label?: string
  linkType: 'physical' | 'virtual' | 'uplink'
}

interface Site {
  id: string
  name: string
}

interface DeviceTypeInfo {
  code: string
  name: string
  color: string | null
  icon: string | null
  topologyTier: number
}

/** Visual size of TopologyDeviceNode (keep in sync with component CSS) */
const NODE_W = 128
const NODE_H = 96

const selectedSiteId = ref('')
const selectedFloor = ref('')
const locationSearch = ref('')
const initialLoading = ref(true)
const refreshing = ref(false)
const hasSettledOnce = ref(false)
const topologyNodes = ref<TopologyNode[]>([])
const topologyLinks = ref<TopologyLink[]>([])
const sites = ref<Site[]>([])
const floors = ref<string[]>([])
const deviceTypes = ref<DeviceTypeInfo[]>([])
const stats = ref({ totalNodes: 0, routers: 0, switches: 0, devices: 0, online: 0, offline: 0 })
const selectedNode = ref<TopologyNode | null>(null)

const flowNodes = ref<Node[]>([])
const flowEdges = ref<Edge[]>([])

const nodeTypes = {
  device: markRaw(TopologyDeviceNode),
}

const edgeTypes = {
  topology: markRaw(TopologyEdge),
}

const { fitView, onNodesInitialized } = useVueFlow('netman-topology')
const { isDark } = useTheme()

const loading = computed(() => initialLoading.value || refreshing.value)
const gridColor = computed(() => (isDark.value ? '#393939' : '#e0e0e0'))
const minimapMask = computed(() =>
  isDark.value ? 'rgba(0, 0, 0, 0.45)' : 'rgba(22, 22, 22, 0.12)',
)

const statCards = computed(() => [
  { label: 'Total Nodes', value: stats.value.totalNodes, className: '' },
  { label: 'Routers', value: stats.value.routers, className: 'text-primary' },
  { label: 'Switches', value: stats.value.switches, className: 'text-info' },
  { label: 'Devices', value: stats.value.devices, className: 'text-secondary' },
  { label: 'Online', value: stats.value.online, className: 'text-success' },
  { label: 'Offline', value: stats.value.offline, className: 'text-error' },
])

onNodesInitialized(() => {
  // Wait until measured dimensions exist, then frame — avoids first-paint jump
  void settleViewport()
})

async function settleViewport() {
  if (!flowNodes.value.length) {
    hasSettledOnce.value = true
    return
  }
  await nextTick()
  await fitView({
    padding: 0.28,
    duration: hasSettledOnce.value ? 220 : 0,
    maxZoom: 1.05,
    minZoom: 0.2,
  })
  hasSettledOnce.value = true
}

function refit() {
  void fitView({ padding: 0.28, duration: 220, maxZoom: 1.05 })
}

let searchTimeout: ReturnType<typeof setTimeout>
function debouncedSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => loadTopology(), 500)
}

function getNodeColor(node: TopologyNode): string {
  const dt = deviceTypes.value.find(d => d.code === node.typeCode)
  if (dt?.color) return dt.color
  return '#6b7280'
}

function formatMac(mac: string | undefined): string {
  if (!mac) return '-'
  const clean = mac.replace(/[:\-]/g, '').toUpperCase()
  return clean.match(/.{1,2}/g)?.join(':') || mac
}

function getNodeBgClass(node: TopologyNode | null): string {
  if (!node) return 'bg-base-300'
  switch (node.type) {
    case 'router': return 'bg-primary text-primary-content'
    case 'switch': return 'bg-info text-info-content'
    case 'access_point': return 'bg-warning text-warning-content'
    case 'server': return 'bg-success text-success-content'
    case 'nas': return 'bg-accent text-accent-content'
    case 'pc': return 'bg-secondary text-secondary-content'
    default: return 'bg-base-300'
  }
}

function edgeStyle(linkType: TopologyLink['linkType']) {
  switch (linkType) {
    case 'uplink':
      return { stroke: '#0f62fe', strokeWidth: 2 }
    case 'virtual':
      return { stroke: '#525252', strokeWidth: 1.5, strokeDasharray: '5 5' }
    default:
      return { stroke: '#525252', strokeWidth: 2 }
  }
}

/**
 * Normalize edge direction for hierarchical TB layout:
 * always lower tier (router) → higher tier (endpoint).
 */
function normalizeEdgeForLayout(
  edge: { source: string; target: string },
  tierById: Map<string, number>,
) {
  const sourceTier = tierById.get(edge.source) ?? 2
  const targetTier = tierById.get(edge.target) ?? 2
  if (sourceTier > targetTier) {
    return { source: edge.target, target: edge.source }
  }
  return { source: edge.source, target: edge.target }
}

/**
 * Build a dagre layout for the graph.
 * Edges are normalized by tier so ranks stay hierarchical (TB).
 */
function layoutWithDagre(nodes: TopologyNode[], edges: { source: string; target: string }[]) {
  const tierById = new Map(nodes.map(n => [n.id, n.tier ?? 2]))
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: 'TB',
    nodesep: 90,
    ranksep: 150,
    edgesep: 40,
    marginx: 48,
    marginy: 48,
  })
  g.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H })
  }

  const seenLayoutEdges = new Set<string>()
  for (const edge of edges) {
    const directed = normalizeEdgeForLayout(edge, tierById)
    const key = `${directed.source}|${directed.target}`
    if (seenLayoutEdges.has(key)) continue
    seenLayoutEdges.add(key)
    g.setEdge(directed.source, directed.target)
  }

  dagre.layout(g)

  const positions = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    const n = g.node(node.id)
    if (n) {
      positions.set(node.id, { x: n.x - NODE_W / 2, y: n.y - NODE_H / 2 })
    }
  }
  return positions
}

/**
 * Fan-out smooth-step offsets so sibling edges leaving/entering the same
 * node spread horizontally by peer X order (reduces stacking without multi-handles).
 */
function computeSiblingFanoutOffsets(
  edges: { source: string; target: string }[],
  positions: Map<string, { x: number; y: number }>,
) {
  const OFFSET_STEP = 24
  const centerX = (id: string) => (positions.get(id)?.x ?? 0) + NODE_W / 2

  const outBySource = new Map<string, number[]>()
  const inByTarget = new Map<string, number[]>()

  edges.forEach((e, i) => {
    if (!outBySource.has(e.source)) outBySource.set(e.source, [])
    outBySource.get(e.source)!.push(i)
    if (!inByTarget.has(e.target)) inByTarget.set(e.target, [])
    inByTarget.get(e.target)!.push(i)
  })

  const outRank = new Map<number, number>()
  const inRank = new Map<number, number>()

  for (const [source, indices] of outBySource) {
    const sorted = [...indices].sort((a, b) => {
      const ax = centerX(edges[a].target)
      const bx = centerX(edges[b].target)
      return ax - bx || a - b
    })
    const n = sorted.length
    sorted.forEach((edgeIdx, rank) => {
      outRank.set(edgeIdx, (rank - (n - 1) / 2) * OFFSET_STEP)
    })
  }

  for (const [target, indices] of inByTarget) {
    const sorted = [...indices].sort((a, b) => {
      const ax = centerX(edges[a].source)
      const bx = centerX(edges[b].source)
      return ax - bx || a - b
    })
    const n = sorted.length
    sorted.forEach((edgeIdx, rank) => {
      inRank.set(edgeIdx, (rank - (n - 1) / 2) * OFFSET_STEP)
    })
  }

  const offsets = new Map<number, number>()
  edges.forEach((_, i) => {
    // Prefer outgoing fan-out; blend with incoming when both sides are busy
    const out = outRank.get(i) ?? 0
    const inn = inRank.get(i) ?? 0
    offsets.set(i, Math.abs(out) >= Math.abs(inn) ? out : inn)
  })

  // Extra separation for true parallel duplicates (same source→target)
  const pairKey = (s: string, t: string) => `${s}→${t}`
  const pairGroups = new Map<string, number[]>()
  edges.forEach((e, i) => {
    const key = pairKey(e.source, e.target)
    if (!pairGroups.has(key)) pairGroups.set(key, [])
    pairGroups.get(key)!.push(i)
  })
  for (const indices of pairGroups.values()) {
    if (indices.length < 2) continue
    const n = indices.length
    indices.forEach((edgeIdx, rank) => {
      const base = offsets.get(edgeIdx) ?? 0
      offsets.set(edgeIdx, base + (rank - (n - 1) / 2) * (OFFSET_STEP / 2))
    })
  }

  return offsets
}

function buildFlowGraph() {
  const nodes = topologyNodes.value
  const links = topologyLinks.value
  const tierById = new Map(nodes.map(n => [n.id, n.tier ?? 2]))

  // Deduplicate links (same source+target+type)
  const seen = new Set<string>()
  const uniqueLinks = links.filter(l => {
    const key = `${l.source}|${l.target}|${l.linkType}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Display edges follow hierarchy (lower tier → higher) so handles attach cleanly TB
  const displayLinks = uniqueLinks.map(link => {
    const directed = normalizeEdgeForLayout(link, tierById)
    return {
      ...link,
      source: directed.source,
      target: directed.target,
    }
  })

  const positions = layoutWithDagre(nodes, displayLinks)
  const edgeOffsets = computeSiblingFanoutOffsets(displayLinks, positions)

  flowNodes.value = nodes.map(node => {
    const pos = positions.get(node.id) ?? { x: 0, y: 0 }
    return {
      id: node.id,
      type: 'device',
      position: pos,
      data: {
        name: node.name,
        type: node.type,
        typeCode: node.typeCode,
        ip: node.ip,
        mac: node.mac,
        siteName: node.siteName,
        status: node.status,
        ports: node.ports,
        color: getNodeColor(node),
      },
      draggable: true,
    }
  })

  flowEdges.value = displayLinks.map((link, index) => {
    const offset = edgeOffsets.get(index) ?? 0
    return {
      id: `e-${link.source}-${link.target}-${index}`,
      source: link.source,
      target: link.target,
      label: link.label,
      type: 'topology',
      animated: link.linkType === 'uplink',
      style: edgeStyle(link.linkType),
      data: {
        offset,
        linkType: link.linkType,
      },
    } satisfies Edge
  })
}

async function loadTopology() {
  const isFirst = initialLoading.value || topologyNodes.value.length === 0
  if (isFirst) {
    initialLoading.value = true
  } else {
    refreshing.value = true
  }

  try {
    const queryParams: Record<string, string> = {}
    if (selectedSiteId.value) queryParams.siteId = selectedSiteId.value
    if (selectedFloor.value) queryParams.floor = selectedFloor.value
    if (locationSearch.value) queryParams.location = locationSearch.value

    const data = await $fetch<{
      nodes: TopologyNode[]
      links: TopologyLink[]
      stats: typeof stats.value
      sites: Site[]
      floors: string[]
      deviceTypes: DeviceTypeInfo[]
    }>('/api/topology', { query: queryParams })

    topologyNodes.value = data.nodes
    topologyLinks.value = data.links
    stats.value = data.stats
    sites.value = data.sites
    floors.value = data.floors
    deviceTypes.value = data.deviceTypes
    buildFlowGraph()
  } catch (error) {
    console.error('Failed to load topology:', error)
    hasSettledOnce.value = true
  } finally {
    initialLoading.value = false
    refreshing.value = false
  }
}

function onNodeClick({ node }: NodeMouseEvent) {
  const match = topologyNodes.value.find(n => n.id === node.id)
  selectedNode.value = match || null
}

function miniMapNodeColor(node: Node) {
  return (node.data as { color?: string })?.color || '#6b7280'
}

onMounted(() => {
  loadTopology()
})
</script>

<style scoped>
.topology-canvas {
  position: relative;
  transition: opacity 0.18s ease;
}

.topology-canvas.is-settling {
  opacity: 0;
  pointer-events: none;
}

.topology-canvas.is-refreshing {
  pointer-events: none;
}

.topology-canvas__overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--color-base-100) 55%, transparent);
}

.topology-canvas :deep(.vue-flow) {
  background: color-mix(in oklab, var(--color-base-200) 40%, transparent);
}

.topology-canvas :deep(.vue-flow__controls) {
  border: 1px solid var(--nm-hairline, #e0e0e0);
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
}

.topology-canvas :deep(.vue-flow__controls-button) {
  border-radius: 0;
  border-bottom: 1px solid var(--nm-hairline, #e0e0e0);
  background: var(--nm-canvas, #ffffff);
  width: 28px;
  height: 28px;
}

.topology-canvas :deep(.vue-flow__minimap) {
  border: 1px solid var(--nm-hairline, #e0e0e0);
  border-radius: 0;
  background: var(--nm-canvas, #ffffff);
}

.topology-canvas :deep(.vue-flow__edge-path) {
  stroke-linecap: square;
}

.topology-canvas :deep(.vue-flow__node) {
  border-radius: 0;
}

.topology-skeleton {
  background:
    linear-gradient(180deg, color-mix(in oklab, var(--nm-primary) 4%, transparent), transparent 40%),
    color-mix(in oklab, var(--color-base-200) 40%, transparent);
}

.topology-skeleton__tiers {
  display: flex;
  flex-direction: column;
  gap: 2.25rem;
  width: min(28rem, 80%);
}

.topology-skeleton__row {
  display: flex;
  justify-content: center;
  gap: 1.25rem;
}

.topology-skeleton__row span {
  display: block;
  width: 3rem;
  height: 3rem;
  background: var(--color-base-200);
  border: 1px solid var(--nm-hairline, #e0e0e0);
  animation: topology-pulse 1.2s ease-in-out infinite;
}

.topology-skeleton__row:nth-child(2) span {
  animation-delay: 0.1s;
}

.topology-skeleton__row:nth-child(3) span {
  animation-delay: 0.2s;
}

@keyframes topology-pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}
</style>
