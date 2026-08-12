<template>
  <Teleport to="body">
    <dialog
      class="modal"
      :class="{ 'modal-open': state.open }"
      :open="state.open || undefined"
      role="alertdialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="descId"
      @close="cancel"
    >
      <div class="modal-box glass-modal rounded-none !max-w-[514px]">
        <h3 :id="titleId" class="type-card-title">{{ state.title }}</h3>
        <p :id="descId" class="py-4 whitespace-pre-wrap">{{ state.message }}</p>
        <div class="modal-action">
          <button class="btn btn-ghost" type="button" @click="cancel">
            {{ state.cancelLabel }}
          </button>
          <button
            class="btn"
            :class="confirmBtnClass"
            type="button"
            autofocus
            @click="accept"
          >
            {{ state.confirmLabel }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit" @click.prevent="cancel">close</button>
      </form>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">
const { state, accept, cancel } = useConfirm()

const titleId = 'app-confirm-title'
const descId = 'app-confirm-desc'

const confirmBtnClass = computed(() => {
  switch (state.variant) {
    case 'primary': return 'btn-primary'
    case 'warning': return 'btn-warning'
    default: return 'btn-error'
  }
})

function onKeydown(e: KeyboardEvent) {
  if (!state.open) return
  if (e.key === 'Escape') {
    e.preventDefault()
    cancel()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>
