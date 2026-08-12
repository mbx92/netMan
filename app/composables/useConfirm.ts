export type ConfirmVariant = 'danger' | 'primary' | 'warning'

export type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
}

type ConfirmState = ConfirmOptions & {
  open: boolean
  resolve: ((value: boolean) => void) | null
}

const state = reactive<ConfirmState>({
  open: false,
  title: 'Confirm',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'danger',
  resolve: null,
})

function close(result: boolean) {
  const resolve = state.resolve
  state.open = false
  state.resolve = null
  resolve?.(result)
}

/**
 * Global confirm dialog — returns a Promise<boolean>.
 * Mount `<AppConfirmDialog />` once (e.g. in app.vue).
 *
 * @example
 * const ok = await confirmDialog({
 *   title: 'Delete port',
 *   message: 'This cannot be undone.',
 *   variant: 'danger',
 * })
 * if (!ok) return
 */
export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof options === 'string' ? { message: options } : options

  // Close any previous pending confirm as cancelled
  if (state.resolve) close(false)

  state.title = opts.title || 'Confirm'
  state.message = opts.message
  state.confirmLabel = opts.confirmLabel || (opts.variant === 'danger' ? 'Delete' : 'Confirm')
  state.cancelLabel = opts.cancelLabel || 'Cancel'
  state.variant = opts.variant || 'danger'
  state.open = true

  return new Promise<boolean>((resolve) => {
    state.resolve = resolve
  })
}

export function useConfirm() {
  return {
    state,
    confirm: confirmDialog,
    accept: () => close(true),
    cancel: () => close(false),
  }
}
