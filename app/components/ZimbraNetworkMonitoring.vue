<template>
  <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
    <section class="border border-base-300 p-4 min-w-0">
      <div class="flex justify-between items-center gap-3 mb-3">
        <h3 class="font-semibold">SSL certificate</h3>
        <span class="badge" :class="ssl?.status === 'valid' ? 'badge-success' : 'badge-warning'">{{ sslLabel }}</span>
      </div>
      <template v-if="ssl && !ssl.error">
        <p class="text-3xl font-semibold">{{ ssl.daysRemaining }} <span class="text-sm font-normal text-base-content/60">days remaining</span></p>
        <dl class="text-sm mt-4 space-y-2 break-words">
          <div><dt class="text-base-content/60">Subject</dt><dd>{{ ssl.subject || 'Unavailable' }}</dd></div>
          <div><dt class="text-base-content/60">Domains</dt><dd>{{ ssl.dnsNames?.join(', ') || 'Unavailable' }}</dd></div>
          <div><dt class="text-base-content/60">Issuer</dt><dd>{{ ssl.issuer }}</dd></div>
          <div><dt class="text-base-content/60">Valid from / expires</dt><dd>{{ date(ssl.notBefore) }} / {{ date(ssl.notAfter) }}</dd></div>
        </dl>
      </template>
      <p v-else class="text-sm text-base-content/60">{{ ssl?.error || 'Update the agent to report SSL certificate monitoring.' }}</p>
      <p v-if="ssl" class="font-mono text-xs break-all mt-3 text-base-content/60">{{ ssl.path }}</p>
      <p class="text-xs text-base-content/60 mt-3">Local certificate validity only. Does not verify the certificate served by each port or its trust chain. Warning starts 30 days before expiry.</p>
    </section>
    <section class="border border-base-300 p-4 min-w-0">
      <h3 class="font-semibold mb-2">Mail port check</h3>
      <p class="text-sm text-base-content/60 mb-3">Test TCP connectivity from the netMan server to this mail server.</p>
      <div class="flex flex-wrap gap-2 mb-3">
        <select v-model="target" class="select select-bordered flex-1 min-w-0" aria-label="Port check destination" :disabled="checking">
          <option value="hostname">{{ agent.hostname }} (hostname)</option>
          <option v-if="agent.lastIp" value="ip">{{ agent.lastIp }} (IP)</option>
        </select>
        <button class="btn btn-primary" :disabled="checking" @click="checkPorts">{{ checking ? 'Checking...' : 'Check ports' }}</button>
      </div>
      <p v-if="error" role="alert" class="text-sm text-error mb-3">{{ error }}</p>
      <template v-if="result">
        <p class="text-xs text-base-content/60 mb-2 break-all">netMan → {{ result.host }} · {{ date(result.checkedAt) }}{{ checking ? ' (previous result)' : '' }}</p>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead><tr><th>Service</th><th>Port</th><th>Status</th><th>Time</th></tr></thead>
            <tbody><tr v-for="port in result.ports" :key="port.port">
              <td>{{ port.service }}</td><td class="font-mono">{{ port.port }}</td>
              <td><span class="badge badge-sm" :class="port.status === 'open' ? 'badge-success' : 'badge-warning'">{{ port.status }}</span><span v-if="port.error" class="block text-xs mt-1">{{ port.error }}</span></td>
              <td>{{ port.latencyMs }} ms</td>
            </tr></tbody>
          </table>
        </div>
      </template>
      <p v-else class="text-sm text-base-content/60">No checks yet. Select a destination and click Check ports.</p>
      <p class="text-xs text-base-content/60 mt-3">Open means a TCP connection succeeded; it does not confirm TLS or mail delivery. Disabled services and restricted admin ports may be closed. Results are kept until you leave this page.</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { MonitoringAgent } from '~/types/service-monitoring'
const props = defineProps<{ agent: MonitoringAgent }>()
const { $api } = useNuxtApp()
const ssl = computed(() => props.agent.lastMetrics?.zimbra?.ssl)
const sslLabel = computed(() => ({ valid: 'Valid dates', expired: 'Expired', expiring: 'Expiring soon', not_yet_valid: 'Not yet valid', unknown: 'Unknown' }[ssl.value?.status || 'unknown'] || 'Unknown'))
const target = ref('hostname')
const checking = ref(false)
const error = ref('')
const result = ref<{ host: string; checkedAt: string; ports: { port: number; service: string; status: string; latencyMs: number; error?: string }[] } | null>(null)
const date = (value?: string) => value ? new Date(value).toLocaleString() : 'Unavailable'
async function checkPorts() {
  checking.value = true
  error.value = ''
  try {
    result.value = await $api(`/agents/${props.agent.id}/mail-ports`, { method: 'POST', body: { target: target.value } })
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'Unable to check ports. Try again.'
  } finally {
    checking.value = false
  }
}
</script>
