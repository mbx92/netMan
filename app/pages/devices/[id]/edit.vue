<template>
  <div class="animate-fade-in max-w-3xl mx-auto">
    <div class="mb-6">
      <NuxtLink :to="`/devices/${deviceId}`" class="btn btn-ghost btn-sm gap-2">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to Device
      </NuxtLink>
    </div>

    <div v-if="pending" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <div v-else-if="error" class="alert alert-error">
      <span>{{ error.statusMessage || 'Device not found' }}</span>
      <NuxtLink to="/devices" class="btn btn-ghost btn-sm">Back</NuxtLink>
    </div>

    <div v-else class="bg-base-100 border border-base-300 rounded-none p-6">
      <p class="page-kicker mb-2">Inventory</p>
      <h1 class="type-card-title mb-6">Edit Device</h1>

      <form class="space-y-4" @submit.prevent="saveDevice">
        <div class="form-control">
          <label class="label" for="name"><span class="label-text">Name *</span></label>
          <input id="name" v-model="form.name" type="text" class="input input-bordered w-full" required />
        </div>

        <div class="form-control">
          <label class="label" for="type"><span class="label-text">Type</span></label>
          <select id="type" v-model="form.typeCode" class="select select-bordered w-full">
            <option v-for="dt in deviceTypes" :key="dt.code" :value="dt.code">{{ dt.name }}</option>
          </select>
        </div>

        <div class="form-control">
          <label class="label" for="status"><span class="label-text">Status</span></label>
          <select id="status" v-model="form.status" class="select select-bordered w-full">
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="UNKNOWN">Unknown</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </div>

        <div class="form-control">
          <label class="label" for="ip"><span class="label-text">IP Address</span></label>
          <div class="flex gap-2">
            <input id="ip" v-model="form.ip" type="text" class="input input-bordered flex-1 font-mono" />
            <button
              type="button"
              class="btn btn-outline btn-primary gap-2"
              :disabled="!form.ip || lookingUpMac"
              @click="lookupMac"
            >
              <span v-if="lookingUpMac" class="loading loading-spinner loading-sm" />
              <Search v-else class="w-4 h-4" :stroke-width="2" />
              Lookup
            </button>
          </div>
          <label v-if="macLookupMessage" class="label">
            <span :class="['label-text-alt', macLookupSuccess ? 'text-success' : 'text-warning']">{{ macLookupMessage }}</span>
          </label>
        </div>

        <div class="form-control">
          <label class="label" for="mac"><span class="label-text">MAC Address</span></label>
          <input id="mac" v-model="form.mac" type="text" class="input input-bordered w-full font-mono" placeholder="AA:BB:CC:DD:EE:FF" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label" for="floor"><span class="label-text">Floor</span></label>
            <input id="floor" v-model="form.floor" type="text" class="input input-bordered w-full" placeholder="e.g., 1, GF, B1" />
          </div>
          <div class="form-control">
            <label class="label" for="location"><span class="label-text">Location</span></label>
            <input id="location" v-model="form.location" type="text" class="input input-bordered w-full" />
          </div>
        </div>

        <div class="form-control">
          <label class="label" for="site"><span class="label-text">Site</span></label>
          <select id="site" v-model="form.siteId" class="select select-bordered w-full">
            <option value="">No Site</option>
            <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
          </select>
        </div>

        <div class="form-control">
          <label class="label" for="owner"><span class="label-text">Owner</span></label>
          <input id="owner" v-model="form.owner" type="text" class="input input-bordered w-full" />
        </div>

        <div class="form-control">
          <label class="cursor-pointer label justify-start gap-3">
            <input v-model="form.wakeable" type="checkbox" class="checkbox checkbox-primary" />
            <span class="label-text">Supports Wake-on-LAN</span>
          </label>
        </div>

        <div v-if="form.typeCode === 'VM'" class="form-control">
          <label class="label" for="parent"><span class="label-text">Parent Host (Hypervisor)</span></label>
          <select id="parent" v-model="form.parentDeviceId" class="select select-bordered w-full">
            <option value="">None</option>
            <option v-for="host in availableHosts" :key="host.id" :value="host.id">
              {{ host.name }} {{ host.ip ? `(${host.ip})` : '' }}
            </option>
          </select>
        </div>

        <div class="form-control">
          <label class="cursor-pointer label justify-start gap-3">
            <input v-model="form.isManaged" type="checkbox" class="checkbox checkbox-info" />
            <span class="label-text">Managed Switch (supports SNMP/ping)</span>
          </label>
        </div>

        <div class="form-control">
          <label class="label" for="notes"><span class="label-text">Notes</span></label>
          <textarea id="notes" v-model="form.notes" class="textarea textarea-bordered w-full" rows="3" />
        </div>

        <p v-if="errorMessage" class="text-error type-body-sm">{{ errorMessage }}</p>

        <div class="flex gap-3 justify-end pt-2">
          <NuxtLink :to="`/devices/${deviceId}`" class="btn btn-ghost">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="loading loading-spinner loading-sm" />
            Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Search } from '@lucide/vue'

interface Site { id: string; name: string }
interface DeviceType { code: string; name: string }
interface HostOption { id: string; name: string; ip?: string | null; typeCode?: string }

const route = useRoute()
const deviceId = route.params.id as string

const { data: device, pending, error } = await useFetch(`/api/devices/${deviceId}`)
const { data: sitesData } = await useFetch('/api/sites')
const sites = computed(() => (sitesData.value?.sites as Site[]) || [])
const { data: deviceTypesData } = await useFetch<DeviceType[]>('/api/device-types')
const deviceTypes = computed(() => deviceTypesData.value || [])
const { data: hostsData } = await useFetch('/api/devices')
const availableHosts = computed(() => {
  const list = (hostsData.value?.devices as HostOption[]) || []
  return list.filter(d =>
    d.id !== deviceId
    && (d.typeCode?.includes('SERVER') || d.typeCode?.includes('PC') || d.typeCode?.includes('NAS')),
  )
})

const form = reactive({
  name: '',
  typeCode: '',
  status: 'UNKNOWN',
  ip: '',
  mac: '',
  floor: '',
  location: '',
  siteId: '',
  parentDeviceId: '',
  owner: '',
  wakeable: false,
  isManaged: true,
  notes: '',
})

watch(device, (d) => {
  if (!d) return
  form.name = d.name
  form.typeCode = d.typeCode
  form.status = d.status
  form.ip = d.ip || ''
  form.mac = d.mac || ''
  form.floor = d.floor || ''
  form.location = d.location || ''
  form.siteId = d.siteId || ''
  form.parentDeviceId = d.parentDeviceId || ''
  form.owner = d.owner || ''
  form.wakeable = d.wakeable
  form.isManaged = d.isManaged ?? true
  form.notes = d.notes || ''
}, { immediate: true })

const saving = ref(false)
const lookingUpMac = ref(false)
const macLookupMessage = ref('')
const macLookupSuccess = ref(false)
const errorMessage = ref('')

async function lookupMac() {
  if (!form.ip) return
  lookingUpMac.value = true
  macLookupMessage.value = ''
  try {
    const result = await $fetch<{ success: boolean; mac?: string; macFormatted?: string; source?: string }>('/api/discovery/mac', {
      method: 'POST',
      body: { ip: form.ip },
    })
    if (result.success && (result.macFormatted || result.mac)) {
      form.mac = result.macFormatted || result.mac || ''
      macLookupSuccess.value = true
      macLookupMessage.value = `Found: ${form.mac}${result.source ? ` (via ${result.source})` : ''}`
    } else {
      macLookupSuccess.value = false
      macLookupMessage.value = 'MAC address not found'
    }
  } catch {
    macLookupSuccess.value = false
    macLookupMessage.value = 'Failed to lookup MAC address'
  } finally {
    lookingUpMac.value = false
  }
}

async function saveDevice() {
  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/devices/${deviceId}`, {
      method: 'PUT',
      body: {
        name: form.name,
        typeCode: form.typeCode,
        status: form.status,
        ip: form.ip,
        mac: form.mac,
        floor: form.floor,
        location: form.location,
        siteId: form.siteId || null,
        parentDeviceId: form.parentDeviceId || null,
        owner: form.owner,
        wakeable: form.wakeable,
        isManaged: form.isManaged,
        notes: form.notes,
      },
    })
    await navigateTo(`/devices/${deviceId}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || 'Failed to save device'
  } finally {
    saving.value = false
  }
}
</script>
