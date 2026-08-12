<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <AppConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import AppConfirmDialog from '~/components/ui/AppConfirmDialog.vue'
</script>
