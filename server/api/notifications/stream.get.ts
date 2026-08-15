import { subscribeNotifications } from '../../utils/notification-bus'

// GET /api/notifications/stream - SSE endpoint for real-time notification push
export default defineEventHandler((event) => {
    setHeader(event, 'Content-Type', 'text/event-stream')
    setHeader(event, 'Cache-Control', 'no-cache')
    setHeader(event, 'Connection', 'keep-alive')
    setHeader(event, 'Access-Control-Allow-Origin', '*')

    const response = event.node.res
    let isConnected = true

    const unsubscribe = subscribeNotifications((notification) => {
        if (!isConnected) return
        response.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`)
    })

    const heartbeatId = setInterval(() => {
        if (!isConnected) {
            clearInterval(heartbeatId)
            return
        }
        response.write(`: heartbeat\n\n`)
    }, 30000)

    event.node.req.on('close', () => {
        isConnected = false
        unsubscribe()
        clearInterval(heartbeatId)
        console.log('[SSE] Client disconnected from notification stream')
    })

    console.log('[SSE] Client connected to notification stream')

    event._handled = true
})
