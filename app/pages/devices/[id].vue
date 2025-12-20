<template>
  <div class="animate-fade-in">
    <!-- Loading State -->
    <div v-if="pending" class="flex items-center justify-center h-64">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span>{{ error.statusMessage || 'Device not found' }}</span>
      <NuxtLink to="/devices" class="btn btn-ghost btn-sm">Back to Devices</NuxtLink>
    </div>

    <!-- Device Content -->
    <template v-else-if="device">
      <!-- Header -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-4">
          <NuxtLink to="/devices" class="btn btn-ghost btn-circle">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </NuxtLink>
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-3xl font-bold">{{ device.name }}</h1>
              <span :class="['badge', getStatusBadgeClass(device.status)]">
                {{ device.status }}
              </span>
            </div>
            <p class="text-base-content/60 mt-1">{{ device.deviceType?.name || device.typeCode }}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <!-- SSH Button (for Linux servers) -->
          <button 
            v-if="canSSH && device.ip" 
            class="btn btn-success"
            @click="showSshModal = true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            SSH
          </button>
          <!-- VNC Button (for Windows PCs) -->
          <button 
            v-if="canVNC && device.ip" 
            class="btn btn-info"
            @click="showVncModal = true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            VNC
          </button>
          <button 
            v-if="device.wakeable && device.mac" 
            class="btn btn-warning"
            @click="sendWoL(device.mac)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
            Wake Device
          </button>
          <button class="btn btn-outline" @click="editMode = true">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main Info Card -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Device Information -->
          <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
            <h2 class="text-lg font-semibold mb-4">Device Information</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="text-sm text-base-content/60">IP Address</label>
                <div class="flex items-center gap-2 mt-1">
                  <!-- Network Icon -->
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="5" y="8" width="14" height="10" rx="1"/>
                    <rect x="7" y="10" width="10" height="6" rx="0.5"/>
                    <line x1="8" y1="4" x2="8" y2="8"/>
                    <line x1="10" y1="4" x2="10" y2="8"/>
                    <line x1="12" y1="4" x2="12" y2="8"/>
                    <line x1="14" y1="4" x2="14" y2="8"/>
                    <line x1="16" y1="4" x2="16" y2="8"/>
                  </svg>
                  <span class="font-mono text-lg">{{ device.ip || '-' }}</span>
                </div>
              </div>
              <div>
                <label class="text-sm text-base-content/60">MAC Address</label>
                <div class="font-mono text-lg mt-1">{{ formatMac(device.mac) }}</div>
              </div>
              <div>
                <label class="text-sm text-base-content/60">Hostname</label>
                <div class="text-lg mt-1">{{ device.hostname || '-' }}</div>
              </div>
              <div>
                <label class="text-sm text-base-content/60">Floor</label>
                <div class="text-lg mt-1">{{ device.floor || '-' }}</div>
              </div>
              <div>
                <label class="text-sm text-base-content/60">Location</label>
                <div class="text-lg mt-1">{{ device.location || '-' }}</div>
              </div>
              <div>
                <label class="text-sm text-base-content/60">Owner</label>
                <div class="text-lg mt-1">{{ device.owner || '-' }}</div>
              </div>
              <div>
                <label class="text-sm text-base-content/60">Wake-on-LAN</label>
                <div class="mt-1">
                  <span :class="['badge', device.wakeable ? 'badge-success' : 'badge-ghost']">
                    {{ device.wakeable ? 'Supported' : 'Not Supported' }}
                  </span>
                </div>
              </div>
              <div v-if="device.typeCode?.includes('SWITCH')">
                <label class="text-sm text-base-content/60">Management</label>
                <div class="mt-1">
                  <span :class="['badge', device.isManaged ? 'badge-info' : 'badge-warning']">
                    {{ device.isManaged ? 'Managed' : 'Unmanaged' }}
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Assigned To Section -->
            <div v-if="connectedToPort" class="mt-6 pt-6 border-t border-base-200">
              <label class="text-sm text-base-content/60">Assigned To</label>
              <div class="flex items-center gap-3 mt-2 p-3 bg-base-200/50 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="5" y="8" width="14" height="10" rx="1"/>
                  <rect x="7" y="10" width="10" height="6" rx="0.5"/>
                  <line x1="8" y1="4" x2="8" y2="8"/>
                  <line x1="10" y1="4" x2="10" y2="8"/>
                  <line x1="12" y1="4" x2="12" y2="8"/>
                  <line x1="14" y1="4" x2="14" y2="8"/>
                  <line x1="16" y1="4" x2="16" y2="8"/>
                </svg>
                <div>
                  <NuxtLink 
                    :to="`/devices/${connectedToPort.device.id}`"
                    class="font-semibold text-primary hover:underline"
                  >
                    {{ connectedToPort.device.name }}
                  </NuxtLink>
                  <div class="text-sm text-base-content/60">
                    Port: <span class="font-mono">{{ connectedToPort.portName }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-if="device.notes" class="mt-6 pt-6 border-t border-base-200">
              <label class="text-sm text-base-content/60">Notes</label>
              <p class="mt-1 whitespace-pre-wrap">{{ device.notes }}</p>
            </div>
          </div>

          <!-- Network Ports (for switches/routers) -->
          <div v-if="isNetworkDevice" class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
            <ClientOnly>
              <PortGrid 
                :ports="portsWithStatus" 
                :available-devices="availableDevices"
                :is-network-device="true"
                :is-live="sseConnected"
                @assign="handleAssign"
                @unassign="handleUnassign"
                @delete-port="handleDeletePort"
                @add-ports="showAddPortsModal = true"
                @refresh="fetchPorts"
              />
              <template #fallback>
                <div class="flex items-center justify-center py-8">
                  <span class="loading loading-spinner loading-md"></span>
                </div>
              </template>
            </ClientOnly>
          </div>
          
          <!-- Legacy Port Table (if not using PortGrid) -->
          <div v-else-if="device.ports?.length" class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
            <h2 class="text-lg font-semibold mb-4">Network Ports</h2>
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr class="border-base-200">
                    <th>Port</th>
                    <th>Status</th>
                    <th>VLAN</th>
                    <th>Speed</th>
                    <th>MAC Learned</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="port in device.ports" :key="port.id" class="border-base-200">
                    <td class="font-mono">{{ port.portName }}</td>
                    <td>
                      <span :class="['badge badge-sm', getPortStatusClass(port.status)]">
                        {{ port.status }}
                      </span>
                    </td>
                    <td>{{ port.vlan || '-' }}</td>
                    <td>{{ port.speed || '-' }}</td>
                    <td class="font-mono text-xs">
                      {{ port.macLearned?.length || 0 }} addresses
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Status Card -->
          <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
            <h2 class="text-lg font-semibold mb-4">Status</h2>
            <div class="flex items-center gap-3 mb-4">
              <div :class="['w-4 h-4 rounded-full', getStatusDotClass(device.status)]"></div>
              <span class="text-2xl font-bold">{{ device.status }}</span>
            </div>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between">
                <span class="text-base-content/60">Last Seen</span>
                <span>{{ formatDateTime(device.lastSeen) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-base-content/60">Created</span>
                <span>{{ formatDateTime(device.createdAt) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-base-content/60">Updated</span>
                <span>{{ formatDateTime(device.updatedAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Recent Sessions -->
          <div class="bg-base-100 rounded-xl shadow-lg border border-base-200 p-6">
            <h2 class="text-lg font-semibold mb-4">Recent Sessions</h2>
            <div v-if="!device.sessions?.length" class="text-base-content/60 text-sm">
              No recent sessions
            </div>
            <div v-else class="space-y-3">
              <div v-for="session in device.sessions" :key="session.id" class="flex items-start gap-3 text-sm">
                <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span class="text-xs font-semibold text-primary">{{ session.protocol.charAt(0) }}</span>
                </div>
                <div>
                  <div class="font-medium">{{ session.protocol }}</div>
                  <div class="text-base-content/60">
                    {{ session.user }} • {{ formatTimeAgo(session.startedAt) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Edit Modal -->
    <dialog :class="['modal', editMode && 'modal-open']">
      <div class="modal-box max-w-lg glass-modal">
        <h3 class="font-bold text-lg mb-4">Edit Device</h3>
        <form @submit.prevent="saveDevice">
          <div class="space-y-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Name</span></label>
              <input v-model="editData.name" type="text" class="input input-bordered w-full" required />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Type</span></label>
              <select v-model="editData.type" class="select select-bordered w-full">
                <option v-for="dt in deviceTypes" :key="dt.code" :value="dt.code">{{ dt.name }}</option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Status</span></label>
              <select v-model="editData.status" class="select select-bordered w-full">
                <option value="ONLINE">Online</option>
                <option value="OFFLINE">Offline</option>
                <option value="UNKNOWN">Unknown</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">IP Address</span></label>
              <div class="flex gap-2">
                <input v-model="editData.ip" type="text" class="input input-bordered flex-1" />
                <button 
                  type="button" 
                  class="btn btn-outline btn-primary"
                  :disabled="!editData.ip || lookingUpMac"
                  @click="lookupMac"
                >
                  <span v-if="lookingUpMac" class="loading loading-spinner loading-sm"></span>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  Lookup
                </button>
              </div>
              <label v-if="macLookupMessage" class="label">
                <span :class="['label-text-alt', macLookupSuccess ? 'text-success' : 'text-warning']">{{ macLookupMessage }}</span>
              </label>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">MAC Address</span></label>
              <input v-model="editData.mac" type="text" class="input input-bordered w-full" placeholder="AA:BB:CC:DD:EE:FF" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label"><span class="label-text">Floor</span></label>
                <input v-model="editData.floor" type="text" class="input input-bordered w-full" placeholder="e.g., 1, GF, B1" />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Location</span></label>
                <input v-model="editData.location" type="text" class="input input-bordered w-full" />
              </div>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Site</span></label>
              <select v-model="editData.siteId" class="select select-bordered w-full">
                <option value="">No Site</option>
                <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Owner</span></label>
              <input v-model="editData.owner" type="text" class="input input-bordered w-full" />
            </div>
            <div class="form-control">
              <label class="cursor-pointer label justify-start gap-3">
                <input v-model="editData.wakeable" type="checkbox" class="checkbox checkbox-primary" />
                <span class="label-text">Supports Wake-on-LAN</span>
              </label>
            </div>
            <!-- Parent Host (for VMs) -->
            <div v-if="editData.type === 'VM'" class="form-control">
              <label class="label"><span class="label-text">Parent Host (Hypervisor)</span></label>
              <select v-model="editData.parentDeviceId" class="select select-bordered w-full">
                <option value="">None</option>
                <option v-for="host in availableHosts" :key="host.id" :value="host.id">
                  {{ host.name }} {{ host.ip ? `(${host.ip})` : '' }}
                </option>
              </select>
            </div>
            <div class="form-control">
              <label class="cursor-pointer label justify-start gap-3">
                <input v-model="editData.isManaged" type="checkbox" class="checkbox checkbox-info" />
                <span class="label-text">Managed Switch (supports SNMP/ping)</span>
              </label>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Notes</span></label>
              <textarea v-model="editData.notes" class="textarea textarea-bordered w-full" rows="3"></textarea>
            </div>
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="editMode = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <span v-if="saving" class="loading loading-spinner loading-sm"></span>
              Save Changes
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="editMode = false">close</button>
      </form>
    </dialog>

    <!-- Add Ports Modal -->
    <dialog :class="['modal', showAddPortsModal && 'modal-open']">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Add Network Ports</h3>
        <div class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Number of ports</span></label>
            <input v-model.number="portCountToAdd" type="number" min="1" max="48" class="input input-bordered w-full" />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Port name prefix</span></label>
            <input v-model="portPrefix" type="text" placeholder="e.g., eth, ether, port" class="input input-bordered w-full" />
            <label class="label"><span class="label-text-alt">Ports will be named: {{ portPrefix }}1, {{ portPrefix }}2, ...</span></label>
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showAddPortsModal = false">Cancel</button>
          <button class="btn btn-primary" @click="addPorts">Add Ports</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showAddPortsModal = false">close</button>
      </form>
    </dialog>

    <!-- Feedback Modal -->
    <dialog :class="['modal', showFeedbackModal && 'modal-open']">
      <div class="modal-box glass-modal">
        <div class="flex items-start gap-3">
          <div :class="['w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', feedbackType === 'success' ? 'bg-success/20 text-success' : feedbackType === 'error' ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning']">
            <svg v-if="feedbackType === 'success'" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <svg v-else-if="feedbackType === 'error'" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <h3 class="font-bold text-lg">{{ feedbackTitle }}</h3>
            <p class="py-2 text-base-content/80">{{ feedbackMessage }}</p>
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="showFeedbackModal = false">OK</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showFeedbackModal = false">close</button>
      </form>
    </dialog>

    <!-- SSH Terminal Modal -->
    <dialog :class="['modal', showSshModal && 'modal-open']">
      <div class="modal-box max-w-4xl h-[80vh] p-0 flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-base-200">
          <h3 class="font-bold text-lg">SSH Terminal - {{ device?.name }}</h3>
          <button class="btn btn-sm btn-circle btn-ghost" @click="closeSshModal">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="flex-1 overflow-hidden">
          <ClientOnly>
            <SshTerminal
              v-if="showSshModal && device"
              :device-id="device.id"
              :device-name="device.name"
              :device-ip="device.ip || undefined"
              @connected="onRemoteConnected('SSH')"
              @disconnected="onRemoteDisconnected('SSH')"
              @error="onRemoteError"
            />
          </ClientOnly>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="closeSshModal">close</button>
      </form>
    </dialog>

    <!-- VNC Viewer Modal -->
    <dialog :class="['modal', showVncModal && 'modal-open']">
      <div class="modal-box max-w-6xl h-[85vh] p-0 flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-base-200">
          <h3 class="font-bold text-lg">VNC Remote Desktop - {{ device?.name }}</h3>
          <button class="btn btn-sm btn-circle btn-ghost" @click="closeVncModal">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="flex-1 overflow-hidden">
          <ClientOnly>
            <VncViewer
              v-if="showVncModal && device"
              :device-id="device.id"
              :device-name="device.name"
              :device-ip="device.ip || undefined"
              @connected="onRemoteConnected('VNC')"
              @disconnected="onRemoteDisconnected('VNC')"
              @error="onRemoteError"
            />
          </ClientOnly>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="closeVncModal">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
interface ConnectedDevice {
  id: string
  name: string
  ip: string | null
  type: string
  status: string
}

interface Port {
  id: string
  portName: string
  portNumber: number
  status: string
  vlan: string | null
  speed: string | null
  description: string | null
  macLearned: string[]
  connectedDeviceId: string | null
  connectedDevice: ConnectedDevice | null
}

interface PortWithStatus extends Port {
  pingStatus?: 'online' | 'offline' | 'unknown'
}


interface Session {
  id: string
  user: string
  protocol: string
  startedAt: string
}

interface Device {
  id: string
  name: string
  typeCode: string  // Changed from type to typeCode
  deviceType?: { code: string; name: string; isNetworkDevice: boolean; canHavePorts: boolean }
  ip: string | null
  mac: string | null
  hostname: string | null
  floor: string | null
  location: string | null
  status: string
  lastSeen: string | null
  owner: string | null
  notes: string | null
  wakeable: boolean
  isManaged: boolean
  portCount: number | null
  // Router API fields
  apiPort: number | null
  apiUser: string | null
  apiPass: string | null
  apiVersion: string | null
  isApiActive: boolean
  lastApiSync: string | null
  siteId: string | null
  site?: { id: string; name: string }
  createdAt: string
  updatedAt: string
  ports: Port[]
  sessions: Session[]
}

interface Site {
  id: string
  name: string
}

const route = useRoute()
const deviceId = route.params.id as string

// Fetch device
const { data: device, pending, error, refresh } = await useFetch<Device>(`/api/devices/${deviceId}`)

// Fetch sites for dropdown
const { data: sitesData } = await useFetch('/api/sites')
const sites = computed(() => sitesData.value?.sites as Site[] || [])

// Fetch device types for dropdown
interface DeviceTypeOption { code: string; name: string }
const { data: deviceTypesData } = await useFetch<DeviceTypeOption[]>('/api/device-types')
const deviceTypes = computed(() => deviceTypesData.value || [])

// Feedback modal
const showFeedbackModal = ref(false)
const feedbackType = ref<'success' | 'error' | 'warning'>('success')
const feedbackTitle = ref('')
const feedbackMessage = ref('')

function showFeedback(type: 'success' | 'error' | 'warning', title: string, message: string) {
  feedbackType.value = type
  feedbackTitle.value = title
  feedbackMessage.value = message
  showFeedbackModal.value = true
}

// PortGrid state
const portsWithStatus = ref<PortWithStatus[]>([])
const availableDevices = ref<{ id: string; name: string; ip: string | null; typeCode: string }[]>([])
const showAddPortsModal = ref(false)
const portCountToAdd = ref(8)
const portPrefix = ref('eth')

// Connected to port (which switch/port this device is assigned to)
const connectedToPort = ref<{
  portId: string
  portName: string
  portNumber: number
  device: {
    id: string
    name: string
    type: string
    ip: string | null
  }
} | null>(null)

// Fetch connected to port
async function fetchConnectedTo() {
  try {
    const response = await $fetch<{ connectedToPort: typeof connectedToPort.value }>(`/api/devices/${deviceId}/connected-to`)
    connectedToPort.value = response.connectedToPort
  } catch (e) {
    console.error('Failed to fetch connected to port:', e)
  }
}

// Check if device is a network device (switch/router/AP)
const isNetworkDevice = computed(() => {
  const networkTypes = ['SWITCH', 'SWITCH_MANAGED', 'SWITCH_UNMANAGED', 'ROUTER', 'ACCESS_POINT']
  return device.value && device.value.typeCode && networkTypes.includes(device.value.typeCode)
})

// Check if device supports SSH (Linux servers/PCs)
const canSSH = computed(() => {
  if (!device.value?.typeCode) return false
  const sshTypes = ['SERVER_LINUX', 'PC_LINUX', 'ROUTER']
  return sshTypes.some(t => device.value!.typeCode.includes(t))
})

// Check if device supports VNC (Windows PCs/servers)
const canVNC = computed(() => {
  if (!device.value?.typeCode) return false
  const vncTypes = ['PC_WINDOWS', 'SERVER_WINDOWS']
  return vncTypes.some(t => device.value!.typeCode.includes(t))
})

// Remote access modal state
const showSshModal = ref(false)
const showVncModal = ref(false)

function closeSshModal() {
  showSshModal.value = false
}

function closeVncModal() {
  showVncModal.value = false
}

function onRemoteConnected(protocol: string) {
  console.log(`[Remote] ${protocol} connected to ${device.value?.name}`)
}

function onRemoteDisconnected(protocol: string) {
  console.log(`[Remote] ${protocol} disconnected from ${device.value?.name}`)
}

function onRemoteError(message: string) {
  showFeedback('error', 'Connection Error', message)
}

// Fetch ports with ping status
async function fetchPorts() {
  if (!isNetworkDevice.value) return
  
  try {
    const response = await $fetch<{ ports: PortWithStatus[] }>(`/api/devices/${deviceId}/ports`)
    portsWithStatus.value = response.ports
  } catch (e) {
    console.error('Failed to fetch ports:', e)
  }
}

// Fetch available devices for assignment
async function fetchAvailableDevices() {
  try {
    const response = await $fetch<{ devices: { id: string; name: string; ip: string | null; typeCode: string }[] }>('/api/devices')
    availableDevices.value = response.devices.filter(d => d.id !== deviceId)
  } catch (e) {
    console.error('Failed to fetch devices:', e)
  }
}

// Handle port assignment
async function handleAssign(portId: string, connectedDeviceId: string) {
  try {
    await $fetch(`/api/ports/${portId}/assign`, {
      method: 'POST',
      body: { connectedDeviceId },
    })
    await fetchPorts()
  } catch (e) {
    showFeedback('error', 'Failed', 'An error occurred')
  }
}

// Handle port unassignment
async function handleUnassign(portId: string) {
  try {
    await $fetch(`/api/ports/${portId}/assign`, {
      method: 'POST',
      body: { connectedDeviceId: null },
    })
    await fetchPorts()
  } catch (e) {
    showFeedback('error', 'Failed', 'An error occurred')
  }
}

// Handle port deletion
async function handleDeletePort(portId: string) {
  try {
    await $fetch(`/api/ports/${portId}`, {
      method: 'DELETE',
    })
    await fetchPorts()
    refresh()
  } catch (e) {
    showFeedback('error', 'Failed', 'An error occurred')
  }
}

// Add ports to device
async function addPorts() {
  try {
    const ports = Array.from({ length: portCountToAdd.value }, (_, i) => ({
      portName: `${portPrefix.value}${i + 1}`,
      portNumber: i + 1,
    }))
    
    await $fetch(`/api/devices/${deviceId}/ports`, {
      method: 'POST',
      body: { ports },
    })
    
    showAddPortsModal.value = false
    await fetchPorts()
    refresh()
  } catch (e) {
    showFeedback('error', 'Failed', 'An error occurred')
  }
}
// SSE connection for real-time port status
let eventSource: EventSource | null = null
const sseConnected = ref(false)
const lastUpdate = ref<string | null>(null)

function connectSSE() {
  if (!isNetworkDevice.value || eventSource) return
  
  console.log('[SSE] Connecting to port status stream...')
  eventSource = new EventSource(`/api/devices/${deviceId}/ports/stream`)
  
  eventSource.addEventListener('portStatus', (event) => {
    try {
      const data = JSON.parse(event.data)
      lastUpdate.value = data.timestamp
      sseConnected.value = true
      
      // Update ports with new status
      if (data.ports && Array.isArray(data.ports)) {
        // Merge SSE data with existing port data
        portsWithStatus.value = portsWithStatus.value.map(port => {
          const update = data.ports.find((p: any) => p.id === port.id)
          if (update) {
            return {
              ...port,
              pingStatus: update.pingStatus,
            }
          }
          return port
        })
        
        // If no ports yet, fetch full data
        if (portsWithStatus.value.length === 0) {
          fetchPorts()
        }
      }
    } catch (e) {
      console.error('[SSE] Error parsing port status:', e)
    }
  })
  
  eventSource.addEventListener('error', () => {
    console.log('[SSE] Connection error, reconnecting in 5s...')
    sseConnected.value = false
    closeSSE()
    setTimeout(connectSSE, 5000)
  })
  
  eventSource.onopen = () => {
    console.log('[SSE] Connected to port status stream')
    sseConnected.value = true
  }
}

function closeSSE() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
    sseConnected.value = false
  }
}

// Load initial data and connect SSE on mount
onMounted(async () => {
  // Fetch connected-to port for all devices
  await fetchConnectedTo()
  
  // Fetch available devices for all (needed for VM parent host selection)
  await fetchAvailableDevices()
  
  if (isNetworkDevice.value) {
    await fetchPorts()
    connectSSE()
  }
})

// Clean up SSE connection on unmount
onUnmounted(() => {
  closeSSE()
})

// Available hosts for VM parent selection (servers and other devices that can host VMs)
const availableHosts = computed(() => {
  return availableDevices.value.filter(d => 
    d.typeCode?.includes('SERVER') || d.typeCode?.includes('PC') || d.typeCode?.includes('NAS')
  )
})

// Edit mode
const editMode = ref(false)
const saving = ref(false)
const lookingUpMac = ref(false)
const macLookupMessage = ref('')
const macLookupSuccess = ref(false)
const editData = reactive({
  name: '',
  type: '',
  status: '',
  ip: '',
  mac: '',
  floor: '',
  location: '',
  siteId: '',
  parentDeviceId: '',  // Parent host for VMs
  owner: '',
  wakeable: false,
  isManaged: true,
  notes: '',
})

// Initialize edit data when device loads
watch(device, (d) => {
  if (d) {
    editData.name = d.name
    editData.type = d.typeCode
    editData.status = d.status
    editData.ip = d.ip || ''
    editData.mac = d.mac || ''
    editData.floor = d.floor || ''
    editData.location = d.location || ''
    editData.siteId = d.siteId || ''
    editData.parentDeviceId = d.parentDeviceId || ''
    editData.owner = d.owner || ''
    editData.wakeable = d.wakeable
    editData.isManaged = d.isManaged ?? true
    editData.notes = d.notes || ''
  }
}, { immediate: true })

// MAC Address Lookup
async function lookupMac() {
  if (!editData.ip) return
  
  lookingUpMac.value = true
  macLookupMessage.value = ''
  
  try {
    const result = await $fetch<{ success: boolean; mac?: string; hostname?: string; source?: string }>('/api/discovery/mac', {
      method: 'POST',
      body: { ip: editData.ip },
    })
    
    if (result.success && result.mac) {
      editData.mac = result.mac
      macLookupSuccess.value = true
      macLookupMessage.value = `Found: ${result.mac}${result.source ? ` (via ${result.source})` : ''}`
    } else {
      macLookupSuccess.value = false
      macLookupMessage.value = 'MAC address not found in local ARP or MikroTik'
    }
  } catch (err) {
    macLookupSuccess.value = false
    macLookupMessage.value = 'Failed to lookup MAC address'
  } finally {
    lookingUpMac.value = false
  }
}

async function saveDevice() {
  saving.value = true
  try {
    await $fetch(`/api/devices/${deviceId}`, {
      method: 'PUT',
      body: {
        name: editData.name,
        typeCode: editData.type,  // Send typeCode to API
        status: editData.status,
        ip: editData.ip,
        mac: editData.mac,
        floor: editData.floor,
        location: editData.location,
        siteId: editData.siteId || null,
        parentDeviceId: editData.parentDeviceId || null,  // Parent host for VMs
        owner: editData.owner,
        wakeable: editData.wakeable,
        isManaged: editData.isManaged,
        notes: editData.notes,
      },
    })
    editMode.value = false
    refresh()
  } catch (e) {
    showFeedback('error', 'Failed to Save', 'An error occurred while saving the device')
  } finally {
    saving.value = false
  }
}

// Wake on LAN
async function sendWoL(mac: string | null) {
  if (!mac) {
    showFeedback('warning', 'No MAC Address', 'Device does not have a MAC address configured')
    return
  }
  try {
    await $fetch(`/api/wol/${mac}`, { method: 'POST' })
    showFeedback('success', 'Wake-on-LAN Sent', 'Magic packet sent to device')
  } catch (e) {
    showFeedback('error', 'WoL Failed', 'Failed to send Wake-on-LAN packet')
  }
}

// Display helpers
function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    ONLINE: 'badge-success',
    OFFLINE: 'badge-error',
    UNKNOWN: 'badge-warning',
    MAINTENANCE: 'badge-info',
  }
  return classes[status] || ''
}

function getStatusDotClass(status: string): string {
  const classes: Record<string, string> = {
    ONLINE: 'bg-success pulse-dot',
    OFFLINE: 'bg-error',
    UNKNOWN: 'bg-warning',
    MAINTENANCE: 'bg-info',
  }
  return classes[status] || 'bg-base-300'
}

function getPortStatusClass(status: string): string {
  const classes: Record<string, string> = {
    UP: 'badge-success',
    DOWN: 'badge-error',
    DISABLED: 'badge-ghost',
  }
  return classes[status] || ''
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    SMART_TV: 'Smart TV',
    PC_WINDOWS: 'Windows PC',
    PC_LINUX: 'Linux PC',
    SERVER_LINUX: 'Linux Server',
    SERVER_WINDOWS: 'Windows Server',
    PRINTER: 'Printer',
    VM: 'Virtual Machine',
    ROUTER: 'Router',
    SWITCH: 'Switch',
    SWITCH_MANAGED: 'Managed Switch',
    SWITCH_UNMANAGED: 'Unmanaged Switch',
    ACCESS_POINT: 'Access Point',
    OTHER: 'Other',
  }
  return labels[type] || type
}

function formatMac(mac: string | null): string {
  if (!mac) return '-'
  // Remove existing separators and format with colons
  const clean = mac.replace(/[:\-]/g, '').toUpperCase()
  return clean.match(/.{1,2}/g)?.join(':') || mac
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}
</script>
