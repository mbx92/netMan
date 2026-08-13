export type ConfirmVariant = 'danger' | 'primary' | 'warning'

export type ConfirmMode = 'confirm' | 'alert'

export type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  /** confirm = OK/Cancel; alert = single OK (replaces window.alert) */
  mode?: ConfirmMode
}

type ConfirmState = ConfirmOptions & {
  open: boolean
  mode: ConfirmMode
  resolve: ((value: boolean) => void) | null
}

const state = reactive<ConfirmState>({
  open: false,
  title: 'Confirm',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'danger',
  mode: 'confirm',
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
 * Never use window.confirm / window.alert.
 */
export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof options === 'string' ? { message: options } : options
  const mode: ConfirmMode = opts.mode || 'confirm'

  if (state.resolve) close(false)

  state.mode = mode
  state.title = opts.title || (mode === 'alert' ? 'Notice' : 'Confirm')
  state.message = opts.message
  state.confirmLabel = opts.confirmLabel || (mode === 'alert' ? 'OK' : (opts.variant === 'danger' ? 'Delete' : 'Confirm'))
  state.cancelLabel = opts.cancelLabel || 'Cancel'
  state.variant = opts.variant || (mode === 'alert' ? 'primary' : 'danger')
  state.open = true

  return new Promise<boolean>((resolve) => {
    state.resolve = resolve
  })
}

/** Single-button notice — drop-in replacement for window.alert */
export async function alertDialog(options: ConfirmOptions | string): Promise<void> {
  const opts = typeof options === 'string' ? { message: options } : options
  await confirmDialog({
    ...opts,
    mode: 'alert',
    variant: opts.variant || 'primary',
    confirmLabel: opts.confirmLabel || 'OK',
  })
}

export function useConfirm() {
  return {
    state,
    confirm: confirmDialog,
    alert: alertDialog,
    accept: () => close(true),
    cancel: () => close(state.mode === 'alert'),
  }
}
