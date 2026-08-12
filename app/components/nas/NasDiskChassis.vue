<template>
  <div class="nas-disk-chassis space-y-4">
    <!-- HDD chassis bays -->
    <div>
      <div v-if="!hideLegend || title" class="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <p v-if="title" class="text-sm text-ink-muted">{{ title }}</p>
        <div v-if="!hideLegend" class="flex items-center gap-3 text-[10px] text-ink-subtle ml-auto">
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

      <div class="border border-base-300 rounded-none p-4 md:p-5 bg-[var(--nm-inverse-surface)]">
        <div class="flex flex-wrap justify-start gap-3 md:gap-4">
          <NasDiskBay
            v-for="bay in hddSlots"
            :key="`hdd-${bay.slot}`"
            :label="bay.slot"
            variant="hdd"
            :status="bay.status"
            :caption="bay.caption"
            @select="$emit('select', bay)"
          />
        </div>
      </div>
    </div>

    <!-- NVMe / M.2 expansion (only when not composed inside NasChassis) -->
    <div v-if="!hideNvme && nvmeSlots.length">
      <p class="text-sm text-ink-muted mb-2">{{ nvmeTitle }}</p>
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
import { buildHddSlots, buildNvmeSlots, type DiskBaySlot } from '~/utils/nas-disk-bays'

const props = withDefaults(defineProps<{
  title?: string
  nvmeTitle?: string
  columns?: number
  bays?: DiskBaySlot[]
  bayCount?: number | null
  hideLegend?: boolean
  hideNvme?: boolean
}>(), {
  title: 'Drive bays',
  nvmeTitle: 'M.2 / NVMe',
  columns: 4,
  bays: () => [],
  bayCount: null,
  hideLegend: false,
  hideNvme: false,
})

defineEmits<{ select: [bay: DiskBaySlot] }>()

const hddSlots = computed(() => buildHddSlots(props.bays, props.bayCount))
const nvmeSlots = computed(() => buildNvmeSlots(props.bays))
</script>
