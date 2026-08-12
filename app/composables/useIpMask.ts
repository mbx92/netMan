import { ref, watch, type Ref } from 'vue'

const IP_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

function normalizeIpInput(value: string): string {
  // Remove everything except digits
  const digits = value.replace(/[^\d]/g, '').slice(0, 12)

  // Auto-insert dots every 3 digits max, capping each octet at 255
  const parts: string[] = []
  for (let i = 0; i < digits.length; i += 3) {
    let octet = digits.slice(i, i + 3)
    // Cap octet to 255 as user types to avoid invalid intermediate values
    const num = parseInt(octet, 10)
    if (!Number.isNaN(num) && num > 255) {
      octet = '255'
    }
    parts.push(octet)
  }

  return parts.slice(0, 4).join('.')
}

function isValidIp(value: string): boolean {
  if (!IP_PATTERN.test(value)) return false
  const parts = value.split('.').map(Number)
  return parts.every((part) => part >= 0 && part <= 255)
}

/**
 * Composable for IP address input masking with auto-inserted dots.
 * Returns a reactive model value that is automatically formatted as the user types.
 *
 * @example
 * const { ip, isValid } = useIpMask()
 * <input v-model="ip" type="text" placeholder="192.168.1.1" />
 */
export function useIpMask(initialValue = '') {
  const ip = ref(initialValue)
  const isValid = ref(isValidIp(initialValue))

  watch(ip, (value) => {
    const formatted = normalizeIpInput(value)
    if (formatted !== value) {
      ip.value = formatted
    }
    isValid.value = isValidIp(formatted)
  })

  return { ip, isValid }
}

/**
 * Directive `v-ip-mask` for applying IP masking to any input.
 * Automatically inserts dots and caps octets at 255.
 *
 * @example
 * <input v-ip-mask v-model="host" type="text" />
 */
export function useIpMaskDirective() {
  return {
    mounted(el: HTMLInputElement) {
      const handler = (event: Event) => {
        const target = event.target as HTMLInputElement
        const formatted = normalizeIpInput(target.value)
        if (formatted !== target.value) {
          target.value = formatted
          target.dispatchEvent(new Event('input', { bubbles: true }))
        }
      }

      el.addEventListener('input', handler)
      ;(el as unknown as { _ipMaskHandler?: (event: Event) => void })._ipMaskHandler = handler
    },
    unmounted(el: HTMLInputElement) {
      const handler = (el as unknown as { _ipMaskHandler?: (event: Event) => void })._ipMaskHandler
      if (handler) {
        el.removeEventListener('input', handler)
      }
    },
  }
}

export { normalizeIpInput, isValidIp }
