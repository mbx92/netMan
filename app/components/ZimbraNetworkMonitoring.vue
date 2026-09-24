<template>
  <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
    <section class="border border-base-300 p-4 min-w-0">
      <div class="flex justify-between items-center gap-3 mb-3">
        <h3 class="font-semibold">SSL certificate</h3>
        <div class="flex items-center gap-2">
          <span class="badge" :class="ssl?.status === 'valid' ? 'badge-success' : 'badge-warning'">{{ sslLabel }}</span>
          <button v-if="canManageSSL" class="btn btn-primary btn-sm" :disabled="!agent.isConnected || !supportsSSLDeploy" @click="openDeploy">Update SSL</button>
        </div>
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
      <p v-if="canManageSSL && !supportsSSLDeploy" class="text-xs text-warning mt-2">Update this agent to version 0.7.0 or newer before deploying SSL.</p>
      <p v-else-if="canManageSSL && !agent.isConnected" class="text-xs text-warning mt-2">The realtime agent connection is required to deploy a certificate.</p>
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
        <p class="text-xs text-base-content/60 mb-2 break-all">netMan -> {{ result.host }} | {{ date(result.checkedAt) }}{{ checking ? ' (previous result)' : '' }}</p>
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

    <div v-if="showDeploy" class="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="zimbra-ssl-title">
      <div class="modal-box max-w-3xl">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 id="zimbra-ssl-title" class="font-semibold text-lg">Update Zimbra SSL</h3>
            <p class="text-sm text-base-content/60 mt-1">The agent validates, backs up, deploys, restarts Zimbra, and checks the certificate served over TLS.</p>
          </div>
          <button class="btn btn-ghost btn-sm" :disabled="deploying" aria-label="Close" @click="closeDeploy">✕</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5" role="radiogroup" aria-label="SSL certificate mode">
          <button
            type="button"
            class="btn h-auto min-h-16 justify-start px-4 py-3 text-left"
            :class="sslMode === 'letsencrypt' ? 'btn-primary' : 'btn-outline'"
            role="radio"
            :aria-checked="sslMode === 'letsencrypt'"
            :disabled="!supportsLetsEncryptDeploy"
            @click="sslMode = 'letsencrypt'"
          >
            <span>
              <span class="block font-semibold">Let’s Encrypt</span>
              <span class="block text-xs font-normal opacity-75">{{ supportsLetsEncryptDeploy ? 'Otomatis menggunakan Certbot' : 'Memerlukan agent 0.7.1+' }}</span>
            </span>
          </button>
          <button
            type="button"
            class="btn h-auto min-h-16 justify-start px-4 py-3 text-left"
            :class="sslMode === 'premium' ? 'btn-primary' : 'btn-outline'"
            role="radio"
            :aria-checked="sslMode === 'premium'"
            @click="sslMode = 'premium'"
          >
            <span>
              <span class="block font-semibold">Sectigo / Comodo</span>
              <span class="block text-xs font-normal opacity-75">Unggah sertifikat premium</span>
            </span>
          </button>
        </div>

        <form class="mt-5 space-y-4" @submit.prevent="deploySSL">
          <label class="form-control w-full">
            <span class="label-text font-medium">Certificate domains</span>
            <textarea v-model="domainInput" class="textarea textarea-bordered mt-1" rows="2" required placeholder="mail.example.com, webmail.example.com"></textarea>
            <span class="label-text-alt text-base-content/60 mt-1">Comma or newline separated. Every domain must be covered by the certificate.</span>
          </label>

          <template v-if="sslMode === 'letsencrypt'">
            <label class="form-control w-full">
              <span class="label-text font-medium">ACME email</span>
              <input v-model.trim="acmeEmail" type="email" class="input input-bordered mt-1" required autocomplete="email" placeholder="admin@example.com" />
            </label>
            <div class="border border-info/40 bg-info/10 p-3 text-sm">
              Uses Certbot HTTP-01 standalone mode. Public DNS must point to this host and inbound TCP port 80 must be reachable and free during issuance.
            </div>
          </template>

          <template v-else>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label class="border border-base-300 p-3 cursor-pointer">
                <span class="block font-medium text-sm">Server certificate</span>
                <span class="block text-xs text-base-content/60 mt-1 break-all">{{ premiumFiles.certificate || '.crt / .pem' }}</span>
                <input class="file-input file-input-bordered file-input-sm w-full mt-3" type="file" accept=".crt,.pem,.cer,.cert" required @change="readPremiumFile($event, 'certificatePem', 'certificate')" />
              </label>
              <label class="border border-base-300 p-3 cursor-pointer">
                <span class="block font-medium text-sm">Private key</span>
                <span class="block text-xs text-base-content/60 mt-1 break-all">{{ premiumFiles.key || '.key / .pem' }}</span>
                <input class="file-input file-input-bordered file-input-sm w-full mt-3" type="file" accept=".key,.pem" required @change="readPremiumFile($event, 'privateKeyPem', 'key')" />
              </label>
              <label class="border border-base-300 p-3 cursor-pointer">
                <span class="block font-medium text-sm">CA bundle / chain</span>
                <span class="block text-xs text-base-content/60 mt-1 break-all">{{ premiumFiles.chain || '.ca-bundle / .crt / .pem' }}</span>
                <input class="file-input file-input-bordered file-input-sm w-full mt-3" type="file" accept=".ca-bundle,.crt,.pem,.cer,.cert" required @change="readPremiumFile($event, 'caChainPem', 'chain')" />
              </label>
            </div>
            <p class="text-xs text-base-content/60">Comodo/Sectigo deployments normally use the issued server certificate, its matching private key, and the CA bundle supplied by the provider. Files are sent directly to the connected agent and are not saved in the NetMan database.</p>
          </template>

          <label class="flex items-start gap-3 border border-warning/40 bg-warning/10 p-3 cursor-pointer">
            <input v-model="confirmed" type="checkbox" class="checkbox checkbox-warning mt-0.5" required />
            <span class="text-sm">I understand that Zimbra services will restart and mail/web access can be briefly interrupted. The agent will attempt automatic rollback if deployment or endpoint verification fails.</span>
          </label>

          <p v-if="deployError" class="border border-error/40 bg-error/10 p-3 text-sm" role="alert">{{ deployError }}</p>
          <div v-if="deployResult" class="border border-success/40 bg-success/10 p-3 text-sm" role="status">
            <p class="font-medium">Certificate deployed successfully</p>
            <p class="mt-1">Expires: {{ date(deployResult.notAfter) }}</p>
            <p class="font-mono text-xs break-all mt-1">SHA-256: {{ deployResult.fingerprint }}</p>
            <p class="text-xs mt-1">Backup: {{ deployResult.backupId }}</p>
          </div>

          <div class="modal-action">
            <button type="button" class="btn btn-ghost" :disabled="deploying" @click="closeDeploy">{{ deployResult ? 'Close' : 'Cancel' }}</button>
            <button type="submit" class="btn btn-primary" :disabled="deploying || !confirmed || !agent.isConnected">
              <span v-if="deploying" class="loading loading-spinner loading-sm"></span>
              {{ deploying ? 'Validating and deploying…' : 'Validate & deploy' }}
            </button>
          </div>
        </form>
      </div>
      <button class="modal-backdrop" aria-label="Close" :disabled="deploying" @click="closeDeploy"></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MonitoringAgent } from '~/types/service-monitoring'
const props = defineProps<{ agent: MonitoringAgent }>()
const emit = defineEmits<{ deployed: [] }>()
const { $api } = useNuxtApp()
const authStore = useAuthStore()
const canManageSSL = computed(() => authStore.user?.roleName === 'admin')
function supportsAgentVersion(minimumPatch: number) {
  const parts = String(props.agent.agentVersion || '').split('.').map(value => Number.parseInt(value, 10))
  if (parts.some(Number.isNaN)) return false
  const [major = 0, minor = 0, patch = 0] = parts
  return major > 0 || minor > 7 || (minor === 7 && patch >= minimumPatch)
}
const supportsSSLDeploy = computed(() => supportsAgentVersion(0))
const supportsLetsEncryptDeploy = computed(() => supportsAgentVersion(1))
const ssl = computed(() => props.agent.lastMetrics?.zimbra?.ssl)
const sslLabel = computed(() => ({ valid: 'Valid dates', expired: 'Expired', expiring: 'Expiring soon', not_yet_valid: 'Not yet valid', unknown: 'Unknown' }[ssl.value?.status || 'unknown'] || 'Unknown'))
const target = ref('hostname')
const checking = ref(false)
const error = ref('')
const result = ref<{ host: string; checkedAt: string; ports: { port: number; service: string; status: string; latencyMs: number; error?: string }[] } | null>(null)
const date = formatAbsoluteTime
const showDeploy = ref(false)
const sslMode = ref<'letsencrypt' | 'premium'>('letsencrypt')
const domainInput = ref('')
const acmeEmail = ref('')
const confirmed = ref(false)
const deploying = ref(false)
const deployError = ref('')
type SSLDeployDetails = { mode: string; subject: string; notAfter: string; fingerprint: string; backupId: string }
type SSLDeployJob = { status: 'pending' | 'succeeded' | 'failed'; details?: SSLDeployDetails; error?: string }
const deployResult = ref<SSLDeployDetails | null>(null)
const premiumMaterial = reactive({ certificatePem: '', privateKeyPem: '', caChainPem: '' })
const premiumFiles = reactive({ certificate: '', key: '', chain: '' })

function openDeploy() {
  domainInput.value = ssl.value?.dnsNames?.join(', ') || props.agent.hostname
  if (!supportsLetsEncryptDeploy.value) sslMode.value = 'premium'
  confirmed.value = false
  deployError.value = ''
  deployResult.value = null
  showDeploy.value = true
}

function closeDeploy() {
  if (deploying.value) return
  showDeploy.value = false
  premiumMaterial.certificatePem = ''
  premiumMaterial.privateKeyPem = ''
  premiumMaterial.caChainPem = ''
  premiumFiles.certificate = ''
  premiumFiles.key = ''
  premiumFiles.chain = ''
}

async function readPremiumFile(event: Event, material: keyof typeof premiumMaterial, label: keyof typeof premiumFiles) {
  deployError.value = ''
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 256 * 1024) {
    input.value = ''
    deployError.value = `${file.name} exceeds the 256 KiB limit.`
    return
  }
  premiumMaterial[material] = await file.text()
  premiumFiles[label] = file.name
}

const deployErrors: Record<string, string> = {
  ssl_deployment_in_progress: 'Another SSL deployment is already running on this agent.',
  agent_not_connected: 'The Zimbra agent disconnected before the deployment could start.',
  agent_timeout: 'The agent did not return a deployment result before the safety deadline.',
  ssl_deployment_command_failed: 'NetMan could not send the SSL deployment command to the agent.',
  secure_transport_required: 'Premium certificate deployment requires the agent to connect to NetMan over HTTPS/WSS.',
  certbot_not_installed: 'Certbot is not installed on the Zimbra server.',
  acme_issue_failed: 'Let’s Encrypt could not issue the certificate. Check public DNS and TCP port 80.',
  acme_port_80_in_use: 'TCP port 80 is still occupied after NetMan tried to stop Zimbra Proxy.',
  acme_proxy_stop_failed: 'NetMan could not stop Zimbra Proxy to free TCP port 80 for Certbot.',
  acme_proxy_restart_failed: 'The certificate was issued, but Zimbra Proxy could not be restarted. Inspect the Zimbra server immediately.',
  acme_issue_failed_proxy_restart_failed: 'Certificate issuance failed and Zimbra Proxy could not be restarted. Inspect the Zimbra server immediately.',
  acme_root_ca_unavailable: 'The issuing root CA is not available in /etc/ssl/certs on the Zimbra server.',
  certificate_key_mismatch: 'The uploaded private key does not match the server certificate.',
  certificate_hostname_mismatch: 'The certificate does not cover every configured domain.',
  certificate_not_currently_valid: 'The certificate is expired or not valid yet.',
  certificate_verify_failed: 'Zimbra rejected the certificate, private key, or CA chain.',
  certificate_deploy_failed_rolled_back: 'Deployment failed. The previous certificate was restored.',
  certificate_deploy_failed_rollback_failed: 'Deployment and automatic rollback failed. Inspect the Zimbra server immediately.',
  zimbra_restart_failed_rolled_back: 'Zimbra failed to restart with the new certificate. The previous certificate was restored.',
  zimbra_restart_failed_rollback_failed: 'Zimbra restart and automatic rollback failed. Inspect the server immediately.',
  endpoint_verification_failed_rolled_back: 'The new certificate was not served by Zimbra. The previous certificate was restored.',
  endpoint_verification_failed_rollback_failed: 'Endpoint verification and automatic rollback failed. Inspect the server immediately.',
  backup_failed: 'The active Zimbra certificate could not be backed up, so deployment was stopped.',
}

async function waitForSSLDeployment(deploymentId: string): Promise<SSLDeployJob> {
  // The agent has a 12-minute deployment deadline plus rollback time. Polling
  // keeps every HTTP request short so reverse proxies cannot turn it into 504.
  for (let attempt = 0; attempt < 400; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 3_000))
    const job = await $api<SSLDeployJob>(`/agents/${props.agent.id}/zimbra-ssl/deploy/${deploymentId}`)
    if (job.status !== 'pending') return job
  }
  return { status: 'failed', error: 'agent_timeout' }
}

async function deploySSL() {
  deployError.value = ''
  deployResult.value = null
  const domains = [...new Set(domainInput.value.split(/[\s,]+/).map(value => value.trim().toLowerCase()).filter(Boolean))]
  if (!domains.length) {
    deployError.value = 'Enter at least one certificate domain.'
    return
  }
  if (sslMode.value === 'premium' && (!premiumMaterial.certificatePem || !premiumMaterial.privateKeyPem || !premiumMaterial.caChainPem)) {
    deployError.value = 'Select the server certificate, matching private key, and CA bundle.'
    return
  }
  deploying.value = true
  try {
    const response = await $api<{ success: boolean; deploymentId: string; status: 'pending' }>(`/agents/${props.agent.id}/zimbra-ssl/deploy`, {
      method: 'POST',
      body: {
        sslMode: sslMode.value,
        domains,
        ...(sslMode.value === 'letsencrypt'
          ? { email: acmeEmail.value }
          : { ...premiumMaterial }),
      },
    })
    const job = await waitForSSLDeployment(response.deploymentId)
    if (job.status === 'failed') {
      const code = job.error || 'Zimbra SSL deployment failed.'
      deployError.value = deployErrors[code] || code
      return
    }
    if (!job.details) {
      deployError.value = 'The agent reported success without certificate details.'
      return
    }
    deployResult.value = job.details
    premiumMaterial.privateKeyPem = ''
    emit('deployed')
  } catch (error: any) {
    const code = error?.data?.statusMessage || error?.message || 'Zimbra SSL deployment failed.'
    deployError.value = deployErrors[code] || code
  } finally {
    deploying.value = false
  }
}

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
