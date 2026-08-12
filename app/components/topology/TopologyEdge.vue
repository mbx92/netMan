<template>
  <BaseEdge
    :id="id"
    :path="path"
    :marker-end="markerEnd"
    :style="style"
  />
  <EdgeLabelRenderer v-if="labelText">
    <div
      :style="{
        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
        pointerEvents: 'all',
      }"
      class="topology-edge__label nodrag nopan"
    >
      {{ labelText }}
    </div>
  </EdgeLabelRenderer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
} from '@vue-flow/core'

interface TopologyEdgeData {
  offset?: number
  linkType?: 'physical' | 'virtual' | 'uplink'
}

type HandlePosition = 'top' | 'right' | 'bottom' | 'left'

// Local props only — imported generics need the `typescript` package for Vue SFC
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: HandlePosition
  targetPosition: HandlePosition
  label?: string | unknown
  style?: Record<string, string | number>
  markerEnd?: string
  data?: TopologyEdgeData
}>()

const path = computed(() => {
  const offset = props.data?.offset ?? 0
  const [edgePath] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition as Position,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition as Position,
    borderRadius: 0,
    offset,
  })
  return edgePath
})

const labelText = computed(() => {
  const label = props.label
  return typeof label === 'string' ? label : undefined
})

const labelX = computed(() => (props.sourceX + props.targetX) / 2)
const labelY = computed(() => (props.sourceY + props.targetY) / 2)
</script>

<style scoped>
.topology-edge__label {
  position: absolute;
  background: var(--color-base-100, #ffffff);
  border: 1px solid var(--nm-hairline, #e0e0e0);
  padding: 1px 4px;
  font-size: 9px;
  font-family: "IBM Plex Mono", monospace;
  color: #525252;
  z-index: 10;
}
</style>
