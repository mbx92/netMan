<template>
  <div class="flex flex-col h-full">
    <!-- Connection Form (when not connected) -->
    <div v-if="!connected" class="flex-1 flex items-center justify-center p-6">
      <div class="w-full max-w-md space-y-6">
        <div class="text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-info/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <h3 class="text-xl font-semibold">VNC Remote Desktop</h3>
          <p class="text-base-content/60 text-sm mt-1">Connect to {{ deviceName || 'device' }} via VNC</p>
        </div>

        <form @submit.prevent="connect" class="space-y-4">
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
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span>{{ error }}</span>
          </div>

          <button 
            type="submit" 
            class="btn btn-info flex-1"
            :disabled="connecting || !host"
          >
            <span v-if="connecting" class="loading loading-spinner loading-sm"></span>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            {{ connecting ? 'Connecting...' : 'Connect' }}
          </button>
          <button 
            type="button"
            class="btn btn-info w-full"
            :disabled="!host"
            @click="openInNewWindow"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
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
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
          <button class="btn btn-ghost btn-sm text-error" @click="disconnect">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
            </svg>
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
const props = defineProps<{
  deviceId: string
  deviceName?: string
  deviceIp?: string
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
