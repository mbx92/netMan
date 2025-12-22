declare module 'guacamole-lite' {
    export class GuacamoleLite {
        constructor(config: { host: string; port: number }, settings: any)
        on(event: string, callback: Function): void
        send(data: string): void
        close(): void
    }
}
