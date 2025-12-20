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
            class="btn btn-info w-full"
            :disabled="connecting || !host"
          >
            <span v-if="connecting" class="loading loading-spinner loading-sm"></span>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            {{ connecting ? 'Connecting...' : 'Connect' }}
          </button>
        </form>
      </div>
    </div>

    <!-- VNC Viewer (when connected) -->
    <div v-else class="flex flex-col h-full">
      <!-- VNC Header -->
      <div class="flex items-center justify-between px-4 py-2 bg-base-300 border-b border-base-200">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-success animate-pulse"></div>
          <span class="text-sm font-mono">{{ rfbState || `VNC: ${host}:${port}` }}</span>
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
      
      <!-- noVNC Canvas Container -->
      <div ref="vncContainerRef" class="flex-1 bg-black overflow-hidden"></div>

      <!-- Status Bar -->
      <div class="px-4 py-1 bg-base-300 border-t border-base-200 text-xs text-base-content/60 flex justify-between">
        <span>{{ vncStatus || 'Connected' }}</span>
        <span v-if="rfbState">{{ rfbState }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Use novnc-core package (CommonJS version for Node/bundler compatibility)
// @ts-ignore - no types available
import RFB from 'novnc-core'

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
const connecting = ref(false)
const error = ref('')
const vncStatus = ref('')
const rfbState = ref('')

// Form data
const host = ref(props.deviceIp || '')
const port = ref(5900)
const password = ref('')

// VNC refs
const vncContainerRef = ref<HTMLElement | null>(null)
let rfb: any = null

// Update host when deviceIp changes
watch(() => props.deviceIp, (newIp) => {
  if (newIp) host.value = newIp
})

async function connect() {
  if (connecting.value || connected.value) return
  if (!host.value) return

  connecting.value = true
  error.value = ''
  vncStatus.value = 'Initializing...'

  try {
    // Switch to connected view FIRST to render the container
    connected.value = true
    connecting.value = false
    vncStatus.value = 'Connecting...'
    
    // Wait for Vue to render the container
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    
    if (!vncContainerRef.value) {
      throw new Error('VNC container failed to initialize')
    }

    // Build WebSocket URL to our proxy
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/remote/vnc?host=${encodeURIComponent(host.value)}&port=${port.value}&deviceId=${props.deviceId}`

    // Create RFB instance
    rfb = new RFB(vncContainerRef.value, wsUrl, {
      credentials: password.value ? { password: password.value } : undefined,
    })

    // Event handlers
    rfb.addEventListener('connect', () => {
      console.log('[VNC] noVNC connected')
      vncStatus.value = 'Connected'
      rfbState.value = 'Ready'
      emit('connected')
    })

    rfb.addEventListener('disconnect', (e: any) => {
      console.log('[VNC] noVNC disconnected', e.detail)
      if (e.detail.clean) {
        vncStatus.value = 'Disconnected'
      } else {
        error.value = 'Connection lost unexpectedly'
      }
      handleDisconnected()
    })

    rfb.addEventListener('credentialsrequired', () => {
      console.log('[VNC] Credentials required')
      vncStatus.value = 'Authenticating...'
      if (password.value) {
        rfb.sendCredentials({ password: password.value })
      } else {
        error.value = 'VNC password required'
        handleDisconnected()
      }
    })

    rfb.addEventListener('securityfailure', (e: any) => {
      console.error('[VNC] Security failure:', e.detail)
      error.value = `Authentication failed: ${e.detail.reason || 'Invalid password'}`
      handleDisconnected()
    })

    rfb.addEventListener('desktopname', (e: any) => {
      console.log('[VNC] Desktop name:', e.detail.name)
      rfbState.value = e.detail.name
    })

    // Configure RFB
    rfb.scaleViewport = true
    rfb.resizeSession = true
    rfb.clipViewport = false
    rfb.dragViewport = false
    rfb.focusOnClick = true

  } catch (e: any) {
    console.error('[VNC] Connection error:', e)
    error.value = e.message || 'Failed to connect'
    connecting.value = false
    connected.value = false
    emit('error', e.message)
  }
}

function handleDisconnected() {
  connected.value = false
  connecting.value = false
  rfbState.value = ''
  emit('disconnected')
  cleanup()
}

function disconnect() {
  if (rfb) {
    try {
      rfb.disconnect()
    } catch (e) {
      console.error('[VNC] Error disconnecting:', e)
    }
  }
  handleDisconnected()
}

function toggleFullscreen() {
  if (!vncContainerRef.value) return

  if (!document.fullscreenElement) {
    vncContainerRef.value.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

function cleanup() {
  rfb = null
}

onUnmounted(() => {
  disconnect()
  cleanup()
})
</script>

<style>
/* noVNC canvas styling - make it fill the container */
:deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain;
}
</style>
