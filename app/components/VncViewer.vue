<template>
  <div class="flex flex-col h-full">
    <!-- Connection Form (when not connected) -->
    <div v-if="!connected" class="flex-1 flex items-center justify-center p-6">
      <div class="w-full max-w-[28rem] space-y-6">
        <div class="text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-none bg-info/20 flex items-center justify-center">
            <Monitor class="w-8 h-8 text-info" :stroke-width="2" />
          </div>
          <h3 class="type-card-title">VNC Remote Desktop</h3>
          <p class="type-body-sm text-base-content/60 mt-1">Connect to {{ deviceName || 'device' }} via VNC</p>
        </div>

        <form @submit.prevent="connect" class="space-y-4">
          <div v-if="viaAgent" class="alert bg-base-200 text-sm">
            <Monitor class="w-4 h-4 shrink-0" :stroke-width="2" />
            <span>Relayed through {{ deviceName || 'this device' }}'s agent tunnel — no host or port needed.</span>
          </div>
          <template v-else>
            <div class="form-control">
              <label class="label"><span class="label-text">Host</span></label>
              <input 
                v-model="host" 
                type="text" 
                class="input input-bordered w-full" 
                :placeholder="deviceIp || 'IP Address'"
              />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Port</span></label>
              <input 
                v-model.number="port" 
                type="number" 
                class="input input-bordered w-full" 
                placeholder="5900"
              />
            </div>
          </template>
          <div class="form-control">
            <label class="label"><span class="label-text">VNC Password</span></label>
            <input 
              v-model="password" 
              type="password" 
              class="input input-bordered w-full" 
              placeholder="••••••••"
            />
            <label class="label">
              <span class="label-text-alt text-base-content/60">Leave empty if no password set on VNC server</span>
            </label>
          </div>
          
          <div v-if="error" class="alert alert-error text-sm">
            <XCircle class="w-5 h-5" :stroke-width="2" />
            <span>{{ error }}</span>
          </div>

          <button 
            type="submit" 
            class="btn btn-info flex-1"
            :disabled="connecting || !host"
          >
            <span v-if="connecting" class="loading loading-spinner loading-sm"></span>
            <Monitor v-else class="w-4 h-4" :stroke-width="2" />
            {{ connecting ? 'Connecting...' : 'Connect' }}
          </button>
          <button 
            v-if="!viaAgent"
            type="button"
            class="btn btn-info w-full"
            :disabled="!host"
            @click="openInNewWindow"
          >
            <ExternalLink class="w-4 h-4" :stroke-width="2" />
            Open VNC Viewer
          </button>
        </form>
      </div>
    </div>

    <!-- VNC Viewer (when connected) -->
    <div v-else class="flex flex-col h-full">
      <!-- VNC Header -->
      <div class="flex items-center justify-between px-4 py-2 bg-base-300 border-b border-base-200">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full" :class="vncConnected ? 'bg-success animate-pulse' : 'bg-warning'"></div>
          <span class="text-sm font-mono">VNC: {{ host }}:{{ port }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button 
            class="btn btn-ghost btn-sm"
            @click="toggleFullscreen"
            title="Fullscreen"
          >
            <Maximize class="w-4 h-4" :stroke-width="2" />
          </button>
          <button class="btn btn-ghost btn-sm text-error" @click="disconnect">
            <Power class="w-4 h-4" :stroke-width="2" />
            Disconnect
          </button>
        </div>
      </div>
      
      <!-- noVNC iframe -->
      <iframe 
        ref="vncIframeRef"
        :src="iframeSrc"
        class="flex-1 w-full border-0"
      ></iframe>
      
      <!-- Status Bar -->
      <div class="px-4 py-1 bg-base-300 border-t border-base-200 text-xs text-base-content/60">
        <span>{{ vncStatus || 'Connected' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ExternalLink, Maximize, Monitor, Power, XCircle } from '@lucide/vue'

const props = defineProps<{
  deviceId: string
  deviceName?: string
  deviceIp?: string
  /** Session is relayed through the device's agent tunnel — host/port are server-resolved, not user input. */
  viaAgent?: boolean
}>()

const emit = defineEmits<{
  (e: 'connected'): void
  (e: 'disconnected'): void
  (e: 'error', message: string): void
}>()

// Connection state
const connected = ref(false)
const vncConnected = ref(false)
const connecting = ref(false)
const error = ref('')
const vncStatus = ref('')
const iframeSrc = ref('')

// Form data
const host = ref(props.deviceIp || '')
const port = ref(5900)
const password = ref('')

// Refs
const vncIframeRef = ref<HTMLIFrameElement | null>(null)

// Update host when deviceIp changes
watch(() => props.deviceIp, (newIp) => {
  if (newIp) host.value = newIp
})

onUnmounted(() => {
  disconnect()
})

function connect() {
  console.log('[VNC] Connect button clicked')
  
  if (connecting.value || connected.value) return
  if (!host.value) return

  connecting.value = true
  error.value = ''
  vncStatus.value = 'Connecting...'

  // Build iframe URL to noVNC viewer
  const params = new URLSearchParams({
    host: host.value,
    port: port.value.toString(),
    deviceId: props.deviceId,
    password: password.value || ''
  })
  
  iframeSrc.value = `/novnc/vnc.html?${params.toString()}`
  console.log('[VNC] Loading noVNC viewer:', iframeSrc.value)
  
  connected.value = true
  connecting.value = false
  vncConnected.value = true
  vncStatus.value = 'Connected'
  emit('connected')
}

function disconnect() {
  connected.value = false
  vncConnected.value = false
  connecting.value = false
  iframeSrc.value = ''
  emit('disconnected')
}

function toggleFullscreen() {
  if (!vncIframeRef.value) return

  if (!document.fullscreenElement) {
    vncIframeRef.value.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

function openInNewWindow() {
  if (!host.value) return
  
  // Create .vnc connection file content
  const vncContent = `[Connection]
Host=${host.value}
Port=${port.value}
`
  
  // Download as .vnc file
  const blob = new Blob([vncContent], { type: 'application/x-vnc' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${host.value}.vnc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  console.log('[VNC] Downloaded .vnc file for:', host.value)
}
</script>
