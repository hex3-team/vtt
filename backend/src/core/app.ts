import { App as uServer, TemplatedApp, WebSocket as uWebSocket } from "uWebSockets.js";
import EventEmitter from "events";
import { Socket } from "./socket";
import { RouteBuilder } from "./builder";
import { MessageType } from "../routes";

export class Application {
    private server: TemplatedApp
    public emitter = new EventEmitter()

    constructor(url: string, port: number) {
        this.server = uServer().ws(url, {
            message: this.handleMessage.bind(this)
        })

        this.server.listen(port, () => {
            console.debug('server started')
        })
    }

    private handleMessage(socket: uWebSocket<any>, data: ArrayBuffer) {
        const message = new Uint8Array(data)
        const type = String(message[0])

        this.emitter.emit(type, new Socket(socket, message.subarray(1)))
    }

    on(type: MessageType, auth: boolean = true) {
        return new RouteBuilder(type, auth)
    }
}