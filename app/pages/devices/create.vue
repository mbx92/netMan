<template>
  <div class="animate-fade-in max-w-3xl mx-auto">
    <div class="mb-6">
      <NuxtLink to="/devices" class="btn btn-ghost btn-sm gap-2">
        <ArrowLeft class="w-4 h-4" :stroke-width="2" />
        Back to Devices
      </NuxtLink>
    </div>

    <div class="bg-base-100 border border-base-300 rounded-none p-6">
      <p class="page-kicker mb-2">Inventory</p>
      <h1 class="type-card-title mb-6">Add Device</h1>

      <form class="space-y-4" @submit.prevent="addDevice">
        <div class="form-control">
          <label class="label" for="name"><span class="label-text">Name *</span></label>
          <input id="name" v-model="form.name" type="text" class="input input-bordered w-full" required />
        </div>

        <div class="form-control">
          <label class="label" for="type"><span class="label-text">Type *</span></label>
          <select id="type" v-model="form.typeCode" class="select select-bordered w-full" required>
            <option v-for="dt in deviceTypes" :key="dt.code" :value="dt.code">{{ dt.name }}</option>
          </select>
        </div>

        <div class="form-control">
          <label class="label" for="ip"><span class="label-text">IP Address</span></label>
          <div class="flex gap-2">
            <input id="ip" v-model="form.ip" type="text" class="input input-bordered flex-1 font-mono" placeholder="192.168.1.100" />
            <button
              type="button"
              class="btn btn-outline btn-primary gap-2"
              :disabled="!form.ip || lookingUpMac"
              @click="lookupMac"
            >
              <span v-if="lookingUpMac" class="loading loading-spinner loading-sm" />
              <Search v-else class="w-4 h-4" :stroke-width="2" />
              Lookup MAC
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

        <div class="form-control">
          <label class="label" for="site"><span class="label-text">Site</span></label>
          <select id="site" v-model="form.siteId" class="select select-bordered w-full">
            <option value="">No Site</option>
            <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
          </select>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label" for="floor"><span class="label-text">Floor</span></label>
            <input id="floor" v-model="form.floor" type="text" class="input input-bordered w-full" placeholder="e.g., 1, GF, B1" />
          </div>
          <div class="form-control">
            <label class="label" for="location"><span class="label-text">Location</span></label>
            <input id="location" v-model="form.location" type="text" class="input input-bordered w-full" placeholder="e.g., Server Room" />
          </div>
        </div>

        <div class="form-control">
          <label class="cursor-pointer label justify-start gap-3">
            <input v-model="form.wakeable" type="checkbox" class="checkbox checkbox-primary" />
            <span class="label-text">Supports Wake-on-LAN</span>
          </label>
        </div>

        <div v-if="form.typeCode?.includes('SWITCH')" class="form-control">
          <label class="cursor-pointer label justify-start gap-3">
            <input v-model="form.isManaged" type="checkbox" class="checkbox checkbox-info" />
            <span class="label-text">Managed (supports SNMP/ping)</span>
          </label>
        </div>

        <div class="form-control">
          <label class="label" for="notes"><span class="label-text">Notes</span></label>
          <textarea id="notes" v-model="form.notes" class="textarea textarea-bordered w-full" rows="3" />
        </div>

        <p v-if="errorMessage" class="text-error type-body-sm">{{ errorMessage }}</p>

        <div class="flex gap-3 justify-end pt-2">
          <NuxtLink to="/devices" class="btn btn-ghost">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="loading loading-spinner loading-sm" />
            Add Device
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

const { data: sitesData } = await useFetch('/api/sites')
const sites = computed(() => (sitesData.value?.sites as Site[]) || [])

const { data: deviceTypesData } = await useFetch<DeviceType[]>('/api/device-types')
const deviceTypes = computed(() => deviceTypesData.value || [])

const form = reactive({
  name: '',
  typeCode: 'PC_WINDOWS',
  ip: '',
  mac: '',
  siteId: '',
  floor: '',
  location: '',
  wakeable: false,
  isManaged: true,
  notes: '',
})

const saving = ref(false)
const lookingUpMac = ref(false)
const macLookupMessage = ref('')
const macLookupSuccess = ref(false)
const errorMessage = ref('')

async function lookupMac() {
  if (!form.ip) return
  lookingUpMac.value = true
  macLookupMessage.value = ''
  macLookupSuccess.value = false
  try {
    const result = await $fetch<{
      success: boolean
      macFormatted?: string
      message: string
    }>('/api/discovery/mac', {
      method: 'POST',
      body: { ip: form.ip },
    })
    if (result.success && result.macFormatted) {
      form.mac = result.macFormatted
      macLookupMessage.value = `MAC found: ${result.macFormatted}`
      macLookupSuccess.value = true
    } else {
      macLookupMessage.value = result.message
    }
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    macLookupMessage.value = err.data?.statusMessage || 'Failed to lookup MAC address'
  } finally {
    lookingUpMac.value = false
  }
}

async function addDevice() {
  saving.value = true
  errorMessage.value = ''
  try {
    const created = await $fetch<{ id: string }>('/api/devices', {
      method: 'POST',
      body: form,
    })
    await navigateTo(created?.id ? `/devices/${created.id}` : '/devices')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || 'Failed to add device'
  } finally {
    saving.value = false
  }
}
</script>
