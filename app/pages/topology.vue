<template>
  <div class="animate-fade-in">
    <!-- Page Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-3xl font-bold">Network Topology</h1>
        <p class="text-base-content/60 mt-1">Visual overview of your network infrastructure</p>
      </div>
      <div class="flex items-center gap-2">
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
        <button class="btn btn-outline btn-sm" :disabled="loading" @click="loadTopology">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Refresh
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
      <div class="bg-base-100 rounded-lg p-3 border border-base-200">
        <div class="text-2xl font-bold">{{ stats.totalNodes }}</div>
        <div class="text-xs text-base-content/60">Total Nodes</div>
      </div>
      <div class="bg-base-100 rounded-lg p-3 border border-base-200">
        <div class="text-2xl font-bold text-primary">{{ stats.routers }}</div>
        <div class="text-xs text-base-content/60">Routers</div>
      </div>
      <div class="bg-base-100 rounded-lg p-3 border border-base-200">
        <div class="text-2xl font-bold text-info">{{ stats.switches }}</div>
        <div class="text-xs text-base-content/60">Switches</div>
      </div>
      <div class="bg-base-100 rounded-lg p-3 border border-base-200">
        <div class="text-2xl font-bold text-secondary">{{ stats.devices }}</div>
        <div class="text-xs text-base-content/60">Devices</div>
      </div>
      <div class="bg-base-100 rounded-lg p-3 border border-base-200">
        <div class="text-2xl font-bold text-success">{{ stats.online }}</div>
        <div class="text-xs text-base-content/60">Online</div>
      </div>
      <div class="bg-base-100 rounded-lg p-3 border border-base-200">
        <div class="text-2xl font-bold text-error">{{ stats.offline }}</div>
        <div class="text-xs text-base-content/60">Offline</div>
      </div>
    </div>

    <!-- Topology Canvas -->
    <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 overflow-hidden">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center h-[600px]">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>
      
      <!-- Empty State -->
      <div v-else-if="nodes.length === 0" class="flex flex-col items-center justify-center h-[600px] text-center p-8">
        <div class="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/>
            <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="12" x2="5" y2="16"/><line x1="12" y1="12" x2="19" y2="16"/>
          </svg>
        </div>
        <h3 class="text-xl font-semibold mb-2">No Devices Found</h3>
        <p class="text-base-content/60 max-w-md">Add devices in the Devices page or configure MikroTik routers to see your network topology.</p>
      </div>

      <!-- Topology Graph -->
      <div v-else class="relative">
        <svg ref="svgRef" class="w-full h-[600px] bg-base-200/30 rounded-lg"></svg>
        
        <!-- Zoom controls -->
        <div class="absolute top-4 right-4 flex flex-col gap-1">
          <button class="btn btn-sm btn-square bg-base-100" @click="zoomIn">+</button>
          <button class="btn btn-sm btn-square bg-base-100" @click="zoomOut">-</button>
          <button class="btn btn-sm btn-square bg-base-100" @click="resetZoom">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="M12 8v4l2 2"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Legend (outside canvas) -->
    <div class="mt-4 bg-base-100 rounded-xl shadow-lg border border-base-200 p-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <!-- Device Types -->
          <div>
            <div class="font-semibold mb-2">Device Types</div>
            <div class="flex flex-wrap gap-2">
              <div 
                v-for="dt in deviceTypes" 
                :key="dt.code" 
                class="flex items-center gap-1"
              >
                <div 
                  class="w-3 h-3 rounded-full" 
                  :style="{ backgroundColor: dt.color || '#6b7280' }"
                ></div>
                <span>{{ dt.name }}</span>
              </div>
            </div>
          </div>
          
          <!-- Connection Types -->
          <div>
            <div class="font-semibold mb-2">Connection Types</div>
            <div class="flex flex-wrap gap-3">
              <div class="flex items-center gap-1">
                <svg class="w-6 h-2"><line x1="0" y1="4" x2="24" y2="4" stroke="#4b5563" stroke-width="2"/></svg>
                <span>Physical</span>
              </div>
              <div class="flex items-center gap-1">
                <svg class="w-6 h-2"><line x1="0" y1="4" x2="24" y2="4" stroke="#3b82f6" stroke-width="2"/></svg>
                <span>Uplink</span>
              </div>
              <div class="flex items-center gap-1">
                <svg class="w-6 h-2"><line x1="0" y1="4" x2="24" y2="4" stroke="#8b5cf6" stroke-width="1.5" stroke-dasharray="4,4"/></svg>
                <span>Virtual (VM)</span>
              </div>
            </div>
          </div>
          
          <!-- Status -->
          <div>
            <div class="font-semibold mb-2">Status</div>
            <div class="flex gap-3">
              <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-full bg-success ring-2 ring-success/50"></div> Online</div>
              <div class="flex items-center gap-1"><div class="w-3 h-3 rounded-full bg-error ring-2 ring-error/50"></div> Offline</div>
            </div>
          </div>
        </div>
    </div>

    <!-- Selected Node Details -->
    <dialog :class="['modal', selectedNode && 'modal-open']">
      <div class="modal-box glass-modal">
        <div class="flex items-center gap-3 mb-4">
          <div :class="['w-12 h-12 rounded-full flex items-center justify-center', getNodeBgClass(selectedNode)]">
            <svg v-if="selectedNode?.type === 'router'" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="10" y1="10" x2="10" y2="14"/></svg>
            <svg v-else-if="selectedNode?.type === 'switch'" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="10" rx="1"/><line x1="8" y1="4" x2="8" y2="8"/><line x1="12" y1="4" x2="12" y2="8"/><line x1="16" y1="4" x2="16" y2="8"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/></svg>
          </div>
          <div>
            <h3 class="font-bold text-lg">{{ selectedNode?.name }}</h3>
            <span :class="['badge badge-sm', selectedNode?.status === 'online' ? 'badge-success' : selectedNode?.status === 'offline' ? 'badge-error' : 'badge-ghost']">
              {{ selectedNode?.status || 'Unknown' }}
            </span>
          </div>
        </div>

        <div class="space-y-2 text-sm">
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
import * as d3 from 'd3'

interface TopologyNode {
  id: string
  name: string
  type: 'router' | 'switch' | 'access_point' | 'server' | 'pc' | 'nas' | 'printer' | 'camera' | 'smart_tv' | 'vm' | 'unknown'
  typeCode: string  // Original device type code from DB
  ip?: string
  mac?: string
  siteId?: string
  siteName?: string
  status?: 'online' | 'offline' | 'unknown'
  ports?: number
  tier?: number
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface TopologyLink {
  source: string | TopologyNode
  target: string | TopologyNode
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

// State
const svgRef = ref<SVGSVGElement | null>(null)
const selectedSiteId = ref('')
const selectedFloor = ref('')
const locationSearch = ref('')
const loading = ref(true)
const nodes = ref<TopologyNode[]>([])
const links = ref<TopologyLink[]>([])
const sites = ref<Site[]>([])
const floors = ref<string[]>([])
const deviceTypes = ref<DeviceTypeInfo[]>([])
const stats = ref({ totalNodes: 0, routers: 0, switches: 0, devices: 0, online: 0, offline: 0 })
const selectedNode = ref<TopologyNode | null>(null)

let simulation: d3.Simulation<TopologyNode, TopologyLink> | null = null
let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null
let g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
let zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null

// Debounced search for location
let searchTimeout: ReturnType<typeof setTimeout>
function debouncedSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => loadTopology(), 500)
}

async function loadTopology() {
  loading.value = true
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
    nodes.value = data.nodes
    links.value = data.links
    stats.value = data.stats
    sites.value = data.sites
    floors.value = data.floors
    deviceTypes.value = data.deviceTypes
  } catch (error) {
    console.error('Failed to load topology:', error)
  } finally {
    loading.value = false
    // After loading=false, SVG becomes visible. Wait for next tick then render
    await nextTick()
    if (nodes.value.length > 0) {
      // Additional delay to ensure DOM is fully rendered
      setTimeout(() => {
        renderTopology()
      }, 100)
    }
  }
}

// Lookup color from deviceTypes based on node's typeCode
function getNodeColor(node: TopologyNode): string {
  // Find matching deviceType by code
  const dt = deviceTypes.value.find(d => d.code === node.typeCode)
  if (dt?.color) return dt.color
  
  // Fallback to gray if not found
  return '#6b7280'
}

function formatMac(mac: string | undefined): string {
  if (!mac) return '-'
  // Remove existing separators and format with colons
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
    case 'camera': return 'bg-rose-500 text-white'
    case 'printer': return 'bg-cyan-500 text-white'
    case 'smart_tv': return 'bg-purple-500 text-white'
    default: return 'bg-base-300'
  }
}

function renderTopology() {
  if (!svgRef.value) {
    console.error('[Topology] SVG ref not available')
    return
  }

  // Clear previous
  d3.select(svgRef.value).selectAll('*').remove()

  // Get dimensions with fallback
  let width = svgRef.value.clientWidth
  let height = svgRef.value.clientHeight
  
  // Fallback if dimensions are 0
  if (width === 0) width = 1200
  if (height === 0) height = 600

  console.log('[Topology] Rendering with dimensions:', width, 'x', height, 'Nodes:', nodes.value.length)

  svg = d3.select(svgRef.value)
    .attr('width', width)
    .attr('height', height)
  g = svg.append('g')

  // Zoom behavior
  zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g!.attr('transform', event.transform)
    })
  svg.call(zoom)

  // Group nodes by tier for hierarchical layout
  // Tier 0 = Routers (top)
  // Tier 1 = Switches (middle)  
  // Tier 2 = End devices: Servers, PCs, APs, etc. (bottom)
  const tier0 = nodes.value.filter(n => n.tier === 0 || n.type === 'router')
  const tier1 = nodes.value.filter(n => n.tier === 1 || n.type === 'switch')
  const tier2 = nodes.value.filter(n => n.tier === 2 || !['router', 'switch'].includes(n.type))

  // Remove duplicates (a node should be in only one tier)
  const usedIds = new Set<string>()
  const filterTier = (tier: TopologyNode[]) => tier.filter(n => {
    if (usedIds.has(n.id)) return false
    usedIds.add(n.id)
    return true
  })
  const routers = filterTier(tier0)
  const switches = filterTier(tier1)
  const devices = filterTier(tier2)

  // Calculate positions - hierarchical layout
  const tierHeight = height / 4
  const offsetY = 60

  // Position Tier 0 (Routers) at top
  routers.forEach((node, i) => {
    node.x = (width / (routers.length + 1)) * (i + 1)
    node.y = offsetY + tierHeight * 0.5
  })

  // Position Tier 1 (Switches) in middle
  switches.forEach((node, i) => {
    node.x = (width / (switches.length + 1)) * (i + 1)
    node.y = offsetY + tierHeight * 1.5
  })

  // Position Tier 2 (Devices including APs) at bottom
  devices.forEach((node, i) => {
    node.x = (width / (devices.length + 1)) * (i + 1)
    node.y = offsetY + tierHeight * 2.5
  })

  // Draw links between connected devices (from port assignments via API)
  const link = g.append('g')
    .selectAll('line')
    .data(links.value)
    .join('line')
    // Solid line for physical, dashed for virtual
    .attr('stroke-dasharray', (d: any) => d.linkType === 'virtual' ? '5,5' : null)
    // Different colors: physical=gray, virtual=purple, uplink=blue
    .attr('stroke', (d: any) => {
      switch (d.linkType) {
        case 'virtual': return '#8b5cf6'  // purple for VM connections
        case 'uplink': return '#3b82f6'   // blue for uplinks
        default: return '#4b5563'          // gray for physical
      }
    })
    .attr('stroke-width', (d: any) => d.linkType === 'virtual' ? 1.5 : 2)
    .attr('x1', (d: any) => {
      const source = nodes.value.find(n => n.id === d.source || n.id === d.source?.id)
      return source?.x || 0
    })
    .attr('y1', (d: any) => {
      const source = nodes.value.find(n => n.id === d.source || n.id === d.source?.id)
      return source?.y || 0
    })
    .attr('x2', (d: any) => {
      const target = nodes.value.find(n => n.id === d.target || n.id === d.target?.id)
      return target?.x || 0
    })
    .attr('y2', (d: any) => {
      const target = nodes.value.find(n => n.id === d.target || n.id === d.target?.id)
      return target?.y || 0
    })

  // Create node groups
  const allNodes = [...routers, ...switches, ...devices]
  const node = g.append('g')
    .selectAll('g')
    .data(allNodes)
    .join('g')
    .attr('cursor', 'grab')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .call(d3.drag<SVGGElement, TopologyNode>()
      .on('start', function() {
        d3.select(this).attr('cursor', 'grabbing')
      })
      .on('drag', function(event, d) {
        d.x = event.x
        d.y = event.y
        d3.select(this).attr('transform', `translate(${d.x},${d.y})`)
        // Update links
        link.attr('x1', (ld: any) => {
          const source = allNodes.find(n => n.id === ld.source || n.id === ld.source?.id)
          return source?.x || 0
        })
        .attr('y1', (ld: any) => {
          const source = allNodes.find(n => n.id === ld.source || n.id === ld.source?.id)
          return source?.y || 0
        })
        .attr('x2', (ld: any) => {
          const target = allNodes.find(n => n.id === ld.target || n.id === ld.target?.id)
          return target?.x || 0
        })
        .attr('y2', (ld: any) => {
          const target = allNodes.find(n => n.id === ld.target || n.id === ld.target?.id)
          return target?.y || 0
        })
      })
      .on('end', function() {
        d3.select(this).attr('cursor', 'grab')
      })
    )
    .on('click', (_event, d) => {
      selectedNode.value = d
    })

  // Node circles
  node.append('circle')
    .attr('r', 28)
    .attr('fill', d => getNodeColor(d))
    .attr('stroke', d => d.status === 'online' ? '#22c55e' : d.status === 'offline' ? '#ef4444' : '#4b5563')
    .attr('stroke-width', 3)

  // Node icons using SVG paths (Tabler-style)
  node.append('path')
    .attr('d', d => {
      switch (d.type) {
        case 'router': 
          // Router icon - similar to tabler router
          return 'M-10,-5 L10,-5 L10,5 L-10,5 Z M-7,-2 L-7,2 M-4,-2 L-4,2 M-1,-2 L-1,2 M2,-2 L2,2 M5,-2 L5,2'
        case 'switch':
          // Switch/ethernet icon
          return 'M-10,-6 L10,-6 L10,6 L-10,6 Z M-7,6 L-7,10 M-3,6 L-3,10 M1,6 L1,10 M5,6 L5,10 M7,6 L7,10'
        case 'access_point':
          // Wifi/AP icon
          return 'M-3,4 A6,6 0 0,1 3,4 M-6,1 A9,9 0 0,1 6,1 M-9,-2 A12,12 0 0,1 9,-2 M0,7 L0,10'
        case 'server':
          // Server icon
          return 'M-8,-10 L8,-10 L8,-4 L-8,-4 Z M-8,-3 L8,-3 L8,3 L-8,3 Z M-8,4 L8,4 L8,10 L-8,10 Z M-5,-7 L-5,-7'
        case 'pc':
          // Desktop/PC icon
          return 'M-8,-8 L8,-8 L8,4 L-8,4 Z M-4,4 L-4,8 L4,8 L4,4 M-6,8 L6,8'
        default:
          // Generic device icon
          return 'M-8,-8 L8,-8 L8,8 L-8,8 Z'
      }
    })
    .attr('fill', 'none')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 2)
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')

  // Node labels below
  node.append('text')
    .text(d => d.name.length > 14 ? d.name.slice(0, 14) + '...' : d.name)
    .attr('text-anchor', 'middle')
    .attr('dy', 48)
    .attr('font-size', 11)
    .attr('fill', '#e5e7eb')
    .attr('font-weight', '500')

  // Type label
  node.append('text')
    .text(d => d.type.replace('_', ' ').toUpperCase())
    .attr('text-anchor', 'middle')
    .attr('dy', 62)
    .attr('font-size', 8)
    .attr('fill', '#9ca3af')
}

function zoomIn() {
  if (svg && zoom) svg.transition().call(zoom.scaleBy, 1.3)
}

function zoomOut() {
  if (svg && zoom) svg.transition().call(zoom.scaleBy, 0.7)
}

function resetZoom() {
  if (svg && zoom) svg.transition().call(zoom.transform, d3.zoomIdentity)
}

onMounted(() => {
  loadTopology()
})
</script>
