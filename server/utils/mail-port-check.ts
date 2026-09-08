import { createConnection } from 'node:net'

export const MAIL_PORTS = [
  { port: 25, service: 'SMTP' }, { port: 465, service: 'SMTPS' },
  { port: 587, service: 'Submission' }, { port: 143, service: 'IMAP' },
  { port: 993, service: 'IMAPS' }, { port: 110, service: 'POP3' },
  { port: 995, service: 'POP3S' }, { port: 443, service: 'HTTPS' },
  { port: 7071, service: 'Zimbra Admin' },
]

export function checkMailPort(host: string, port: number, timeoutMs = 3000) {
  return new Promise<{ port: number; status: string; latencyMs: number; error?: string }>((resolve) => {
    const started = performance.now()
    const socket = createConnection({ host, port })
    let finished = false
    const finish = (status: string, error?: string) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      socket.destroy()
      resolve({ port, status, latencyMs: Math.round(performance.now() - started), ...(error ? { error } : {}) })
    }
    // Wall-clock deadline also bounds DNS resolution, unlike a socket idle timeout.
    const timer = setTimeout(() => finish('timeout', 'ETIMEDOUT'), timeoutMs)
    socket.once('connect', () => finish('open'))
    socket.once('error', (err: NodeJS.ErrnoException) => finish(err.code === 'ECONNREFUSED' ? 'closed' : 'error', err.code || 'CONNECTION_FAILED'))
  })
}
