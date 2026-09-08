import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { checkMailPort } from '../server/utils/mail-port-check'

test('reports an open TCP listener and a refused connection after it closes', async () => {
  const server = createServer(socket => socket.end())
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  try {
    const open = await checkMailPort('127.0.0.1', address.port)
    assert.equal(open.status, 'open')
    assert.ok(open.latencyMs >= 0)
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
  }
  assert.equal((await checkMailPort('127.0.0.1', address.port)).status, 'closed')
})
