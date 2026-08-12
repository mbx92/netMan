import { useIpMaskDirective } from '~/composables/useIpMask'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('ip-mask', useIpMaskDirective())
})
