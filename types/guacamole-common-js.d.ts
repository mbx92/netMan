declare module 'guacamole-common-js' {
    export default class Guacamole {
        static WebSocketTunnel: typeof WebSocketTunnel
        static Client: typeof Client
        static Mouse: typeof Mouse
        static Keyboard: typeof Keyboard
    }

    class WebSocketTunnel {
        constructor(url: string)
    }

    class Client {
        constructor(tunnel: WebSocketTunnel)
        connect(): void
        disconnect(): void
        getDisplay(): Display
        sendMouseState(state: any): void
        sendKeyEvent(pressed: number, keysym: number): void
        onstatechange: ((state: number) => void) | null
        onerror: ((status: any) => void) | null
        onname: ((name: string) => void) | null
        static IDLE: number
        static CONNECTING: number
        static WAITING: number
        static CONNECTED: number
        static DISCONNECTING: number
        static DISCONNECTED: number
    }

    class Display {
        getElement(): HTMLElement
        scale(scale: number): void
    }

    class Mouse {
        constructor(element: HTMLElement)
        onmousedown: ((state: any) => void) | null
        onmouseup: ((state: any) => void) | null
        onmousemove: ((state: any) => void) | null
    }

    class Keyboard {
        constructor(element: Document | HTMLElement)
        onkeydown: ((keysym: number) => void) | null
        onkeyup: ((keysym: number) => void) | null
    }
}
