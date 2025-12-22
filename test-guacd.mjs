/**
 * Test script to manually test guacd connection and handshake
 * Run: node test-guacd.mjs
 */
import net from 'net'

const HOST = '10.5.80.99'
const PORT = 5900
const PASSWORD = 'yourpassword' // Replace with actual password

console.log('Testing guacd connection...')

const socket = new net.Socket()

socket.connect(4822, '127.0.0.1', () => {
    console.log('✓ Connected to guacd on 127.0.0.1:4822')

    // Send select instruction
    const select = '6.select,3.vnc;'
    console.log('→ Sending:', select)
    socket.write(select)
})

let receivedData = ''

socket.on('data', (data) => {
    receivedData += data.toString('utf8')
    console.log('← Received:', data.toString('utf8'))

    // If we received args, send connect
    if (receivedData.includes('4.args')) {
        const connectArgs = [
            HOST,
            PORT.toString(),
            PASSWORD
        ]
        const connectParts = connectArgs.map(arg => `${arg.length}.${arg}`).join(',')
        const connect = `7.connect,${connectParts};`

        console.log('→ Sending:', connect)
        socket.write(connect)
    }
})

socket.on('error', (err) => {
    console.error('✗ Socket error:', err.message)
})

socket.on('close', () => {
    console.log('✗ Socket closed')
    process.exit(0)
})

// Timeout after 10 seconds
setTimeout(() => {
    console.log('✗ Timeout - no response')
    socket.destroy()
    process.exit(1)
}, 10000)
