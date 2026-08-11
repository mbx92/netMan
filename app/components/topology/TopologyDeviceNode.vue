<template>
  <div class="topology-device-node" :class="statusClass">
    <Handle type="target" :position="Position.Top" class="topology-handle" />
    <div class="topology-device-node__icon" :style="{ backgroundColor: accentColor }">
      <Router v-if="data.type === 'router'" :stroke-width="2" />
      <Cable v-else-if="data.type === 'switch'" :stroke-width="2" />
      <Wifi v-else-if="data.type === 'access_point'" :stroke-width="2" />
      <HardDrive v-else-if="data.type === 'server' || data.type === 'nas'" :stroke-width="2" />
      <Monitor v-else :stroke-width="2" />
    </div>
    <div class="topology-device-node__label">
      <div class="topology-device-node__name">{{ truncatedName }}</div>
      <div class="topology-device-node__meta">{{ typeLabel }}</div>
    </div>
    <Handle type="source" :position="Position.Bottom" class="topology-handle" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Cable, HardDrive, Monitor, Router, Wifi } from '@lucide/vue'
import { Handle, Position } from '@vue-flow/core'

interface TopologyNodeData {
  name: string
  type: string
  typeCode: string
  ip?: string
  mac?: string
  siteName?: string
  status?: 'online' | 'offline' | 'unknown'
  ports?: number
  color: string
}

const props = defineProps<{
  id: string
  data: TopologyNodeData
}>()

const accentColor = computed(() => props.data.color || '#6b7280')
const truncatedName = computed(() =>
  props.data.name.length > 16 ? `${props.data.name.slice(0, 16)}…` : props.data.name,
)
const typeLabel = computed(() => props.data.type.replace(/_/g, ' '))
const statusClass = computed(() => {
  if (props.data.status === 'online') return 'is-online'
  if (props.data.status === 'offline') return 'is-offline'
  return 'is-unknown'
})
</script>

<style scoped>
.topology-device-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 128px;
  cursor: pointer;
}

.topology-device-node__icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid #525252;
  border-radius: 0;
  color: #ffffff;
}

.topology-device-node.is-online .topology-device-node__icon {
  border-color: #24a148;
}

.topology-device-node.is-offline .topology-device-node__icon {
  border-color: #da1e28;
}

.topology-device-node__icon :deep(svg) {
  width: 22px;
  height: 22px;
}

.topology-device-node__label {
  text-align: center;
  max-width: 120px;
}

.topology-device-node__name {
  font-family: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: 0.16px;
  color: var(--color-base-content, #161616);
}

.topology-device-node__meta {
  font-family: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
  font-size: 10px;
  line-height: 1.3;
  letter-spacing: 0.32px;
  text-transform: uppercase;
  color: color-mix(in oklab, var(--color-base-content, #161616) 55%, transparent);
}

.topology-handle {
  width: 8px !important;
  height: 8px !important;
  border-radius: 0 !important;
  background: #0f62fe !important;
  border: 1px solid #ffffff !important;
}
</style>
