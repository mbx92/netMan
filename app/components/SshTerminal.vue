<template>
  <div class="flex flex-col h-full">
    <!-- Connection Form (when not connected) -->
    <div v-if="!connected" class="flex-1 flex items-center justify-center p-6">
      <div class="w-full max-w-md space-y-6">
        <div class="text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </div>
          <h3 class="text-xl font-semibold">SSH Terminal</h3>
          <p class="text-base-content/60 text-sm mt-1">Connect to {{ deviceName || 'device' }} via SSH</p>
        </div>

        <form @submit.prevent="connect" class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Host</span></label>
            <input 
              v-model="host" 
              type="text" 
              class="input input-bordered w-full" 
              readonly
              :placeholder="deviceIp || 'IP Address'"
            />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Port</span></label>
            <input 
              v-model.number="port" 
              type="number" 
              class="input input-bordered w-full" 
              placeholder="22"
            />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Username</span></label>
            <input 
              v-model="username" 
              type="text" 
              class="input input-bordered w-full" 
              placeholder="root"
              required
            />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Password</span></label>
            <input 
              v-model="password" 
              type="password" 
              class="input input-bordered w-full" 
              placeholder="••••••••"
              required
            />
          </div>
          
          <div v-if="error" class="alert alert-error text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span>{{ error }}</span>
          </div>

          <button 
            type="submit" 
            class="btn btn-success w-full"
            :disabled="connecting || !host || !username || !password"
          >
            <span v-if="connecting" class="loading loading-spinner loading-sm"></span>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
            {{ connecting ? 'Connecting...' : 'Connect' }}
          </button>
        </form>
      </div>
    </div>

    <!-- Terminal (when connected) -->
    <div v-else class="flex flex-col h-full">
      <!-- Terminal Header -->
      <div class="flex items-center justify-between px-4 py-2 bg-base-300 border-b border-base-200">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-success animate-pulse"></div>
          <span class="text-sm font-mono">{{ username }}@{{ host }}:{{ port }}</span>
        </div>
        <button class="btn btn-ghost btn-sm text-error" @click="disconnect">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
          </svg>
          Disconnect
        </button>
      </div>
      
      <!-- Terminal Container -->
      <div ref="terminalRef" class="flex-1 bg-black"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

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

// Form data
const host = ref(props.deviceIp || '')
const port = ref(22)
const username = ref('')
const password = ref('')

// Terminal refs
const terminalRef = ref<HTMLElement | null>(null)
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let ws: WebSocket | null = null
let resizeObserver: ResizeObserver | null = null

// Update host when deviceIp changes
watch(() => props.deviceIp, (newIp) => {
  if (newIp) host.value = newIp
})

async function connect() {
  if (connecting.value || connected.value) return
  if (!host.value || !username.value || !password.value) return

  connecting.value = true
  error.value = ''

  try {
    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    ws = new WebSocket(`${protocol}//${window.location.host}/api/remote/ssh`)

    ws.onopen = () => {
      // Send connect message
      ws!.send(JSON.stringify({
        type: 'connect',
        deviceId: props.deviceId,
        host: host.value,
        port: port.value,
        username: username.value,
        password: password.value
      }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      switch (data.type) {
        case 'connected':
          handleConnected()
          break
        case 'data':
          if (terminal) {
            terminal.write(data.data)
          }
          break
        case 'disconnected':
          handleDisconnected()
          break
        case 'error':
          error.value = data.message
          connecting.value = false
          emit('error', data.message)
          break
      }
    }

    ws.onerror = () => {
      error.value = 'WebSocket connection failed'
      connecting.value = false
    }

    ws.onclose = () => {
      if (connected.value) {
        handleDisconnected()
      }
    }
  } catch (e: any) {
    error.value = e.message
    connecting.value = false
  }
}

function handleConnected() {
  connecting.value = false
  connected.value = true
  emit('connected')
  
  // Initialize terminal after DOM update
  nextTick(() => {
    initTerminal()
  })
}

function handleDisconnected() {
  connected.value = false
  connecting.value = false
  emit('disconnected')
  cleanupTerminal()
}

function disconnect() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'disconnect' }))
    ws.close()
  }
  handleDisconnected()
}

function initTerminal() {
  if (!terminalRef.value) return

  // Create terminal
  terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    theme: {
      background: '#1a1a2e',
      foreground: '#e4e4e7',
      cursor: '#10b981',
      cursorAccent: '#1a1a2e',
      selectionBackground: '#3f3f46',
      black: '#18181b',
      red: '#ef4444',
      green: '#22c55e',
      yellow: '#eab308',
      blue: '#3b82f6',
      magenta: '#a855f7',
      cyan: '#06b6d4',
      white: '#f4f4f5',
      brightBlack: '#52525b',
      brightRed: '#f87171',
      brightGreen: '#4ade80',
      brightYellow: '#facc15',
      brightBlue: '#60a5fa',
      brightMagenta: '#c084fc',
      brightCyan: '#22d3ee',
      brightWhite: '#fafafa'
    }
  })

  // Add addons
  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(new WebLinksAddon())

  // Open terminal
  terminal.open(terminalRef.value)
  fitAddon.fit()

  // Send resize
  sendResize()

  // Handle input
  terminal.onData((data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'data', data }))
    }
  })

  // Handle resize
  terminal.onResize(({ cols, rows }) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  })

  // Watch for container resize
  resizeObserver = new ResizeObserver(() => {
    if (fitAddon) {
      fitAddon.fit()
    }
  })
  resizeObserver.observe(terminalRef.value)
}

function sendResize() {
  if (terminal && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'resize',
      cols: terminal.cols,
      rows: terminal.rows
    }))
  }
}

function cleanupTerminal() {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (terminal) {
    terminal.dispose()
    terminal = null
  }
  fitAddon = null
}

onUnmounted(() => {
  disconnect()
  cleanupTerminal()
})
</script>

<style>
.xterm {
  padding: 8px;
  height: 100%;
}
.xterm-viewport {
  overflow-y: auto !important;
}
</style>
