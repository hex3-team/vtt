import { WebSocket as uWebSocket } from "uWebSockets.js"
import { BaseByteHandler, BaseTextHandler } from "./wrapper"

export class Socket<
    SocketStorage,
    TO extends string,
    BO extends number
> {
    private raw: uWebSocket<SocketStorage>
    private textHandler: BaseTextHandler<any, TO> | null
    private byteHandler: BaseByteHandler<any, BO> | null

    get storage() { return this.raw.getUserData() }

    constructor(
        socket: uWebSocket<SocketStorage>,
        textHandler: BaseTextHandler<any, TO> | null,
        byteHandler: BaseByteHandler<any, BO> | null
    ) {
        this.raw = socket
        this.textHandler = textHandler
        this.byteHandler = byteHandler
    }

    send(type: TO, payload: any): boolean
    send(type: BO, payload: ArrayBuffer): boolean
    send(type: TO | BO, payload: any | ArrayBuffer): boolean {
        if (typeof type === "string") {
            try {
                const message = this.textHandler!.injector(type, payload)
                this.raw.send(message)

                return true
            } catch {
                return false
            }
        } else {
            try {
                const message = this.byteHandler!.injector(type, payload)
                this.raw.send(message)

                return true
            } catch {
                return false
            }
        }
    }
}