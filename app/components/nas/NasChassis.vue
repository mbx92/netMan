<template>
  <div class="nas-chassis space-y-4">
    <div class="flex items-center justify-between mb-2 gap-3 flex-wrap">
      <p class="text-sm text-ink-muted">{{ title }}</p>
      <div class="flex items-center gap-3 text-[10px] text-ink-subtle">
        <span class="inline-flex items-center gap-1">
          <span class="w-2 h-2 bg-success"></span> Healthy
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="w-2 h-2 bg-warning"></span> Warning
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="w-2 h-2 bg-error"></span> Critical
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="w-2 h-2 bg-base-300 border border-base-300"></span> Empty
        </span>
      </div>
    </div>

    <NasChassisRs1221
      v-if="chassisId === 'rs1221plus'"
      :slots="hddSlots"
      @select="$emit('select', $event)"
    />
    <NasChassisTs873a
      v-else-if="chassisId === 'ts873a'"
      :slots="hddSlots"
      @select="$emit('select', $event)"
    />
    <NasDiskChassis
      v-else
      :bays="bays"
      :bay-count="effectiveBayCount"
      title=""
      hide-legend
      hide-nvme
      @select="$emit('select', $event)"
    />

    <!-- NVMe / M.2 (shared for all chassis) -->
    <div v-if="nvmeSlots.length">
      <p class="text-sm text-ink-muted mb-2">
        {{ chassisId === 'ts873a' ? 'M.2 / NVMe (slot 9–10)' : nvmeTitle }}
      </p>
      <div class="border border-base-300 rounded-none p-4 md:p-5 inline-flex flex-wrap justify-start gap-3 md:gap-4 bg-[var(--nm-inverse-surface)]">
        <NasDiskBay
          v-for="bay in nvmeSlots"
          :key="`nvme-${bay.slot}`"
          :label="bay.slot"
          variant="nvme"
          :status="bay.status"
          :caption="bay.caption"
          @select="$emit('select', bay)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { chassisForNas, resolveNasModel } from '~/utils/nas-models'
import {
  buildHddSlots,
  buildNvmeSlots,
  buildQnapHddSlots,
  buildQnapNvmeSlots,
  type DiskBaySlot,
} from '~/utils/nas-disk-bays'

const props = withDefaults(defineProps<{
  title?: string
  nvmeTitle?: string
  model?: string | null
  vendor?: string | null
  bays?: DiskBaySlot[]
  bayCount?: number | null
}>(), {
  title: 'Drive bays',
  nvmeTitle: 'M.2 / NVMe',
  model: null,
  vendor: null,
  bays: () => [],
  bayCount: null,
})

defineEmits<{ select: [bay: DiskBaySlot] }>()

const known = computed(() => resolveNasModel(props.model))
const chassisId = computed(() => chassisForNas(props.model, props.vendor))
const effectiveBayCount = computed(() => {
  const n = Number(props.bayCount)
  if (Number.isFinite(n) && n > 0) return n
  if (known.value?.bayCount) return known.value.bayCount
  if (chassisId.value === 'ts873a' || chassisId.value === 'rs1221plus') return 8
  return null
})

const hddSlots = computed(() => {
  if (chassisId.value === 'ts873a') {
    return buildQnapHddSlots(props.bays, effectiveBayCount.value || 8)
  }
  return buildHddSlots(props.bays, effectiveBayCount.value)
})

const nvmeSlots = computed(() => {
  if (chassisId.value === 'ts873a') {
    return buildQnapNvmeSlots(props.bays)
  }
  return buildNvmeSlots(props.bays)
})
</script>
