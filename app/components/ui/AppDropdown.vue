<template>
  <div ref="rootRef" class="app-dropdown relative inline-block">
    <div ref="triggerRef" class="app-dropdown__trigger" @click.stop="toggle">
      <slot name="trigger" :open="open" :toggle="toggle" :close="close" />
    </div>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="app-dropdown__panel"
        :class="align === 'start' ? 'is-start' : 'is-end'"
        :style="panelStyle"
        role="menu"
        @click.stop
      >
        <slot :close="close" />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    align?: 'start' | 'end'
    matchWidth?: boolean
  }>(),
  {
    align: 'end',
    matchWidth: false,
  },
)

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

function updatePosition() {
  const trigger = triggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const top = `${Math.round(rect.bottom + 4)}px`
  const width = props.matchWidth ? `${Math.round(rect.width)}px` : undefined

  if (props.align === 'start') {
    panelStyle.value = {
      top,
      left: `${Math.round(rect.left)}px`,
      ...(width ? { minWidth: width, width } : {}),
    }
  } else {
    panelStyle.value = {
      top,
      left: 'auto',
      right: `${Math.round(window.innerWidth - rect.right)}px`,
      ...(width ? { minWidth: width, width } : {}),
    }
  }
}

function openMenu() {
  open.value = true
  nextTick(() => {
    updatePosition()
  })
}

function close() {
  open.value = false
}

function toggle() {
  if (open.value) close()
  else openMenu()
}

function onDocClick(e: MouseEvent) {
  const target = e.target as Node
  if (rootRef.value?.contains(target)) return
  if (panelRef.value?.contains(target)) return
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

function onScroll() {
  if (open.value) updatePosition()
}

onMounted(() => {
  document.addEventListener('click', onDocClick, true)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onScroll)
  window.addEventListener('scroll', onScroll, true)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick, true)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onScroll)
  window.removeEventListener('scroll', onScroll, true)
})

defineExpose({ open, close, toggle })
</script>

<style scoped>
.app-dropdown__panel {
  position: fixed;
  z-index: 200;
  min-width: 11rem;
  background: var(--nm-canvas);
  color: var(--nm-ink);
  border: 1px solid var(--nm-hairline);
  border-radius: 0;
  box-shadow: none;
  padding: 0;
}
</style>
