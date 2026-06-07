import { WebSocket as uWebSocket } from "uWebSockets.js";
import { MessageType } from "../routes";

export class Socket {
    private socket: uWebSocket<SocketStorage>
    public get storage() { return this.socket.getUserData() }
    public message: Uint8Array

    constructor(socket: uWebSocket<any>, message: Uint8Array) {
        this.socket = socket
        this.message = message
    }

    private makeMessage(type: MessageType, data?: Uint8Array) {
        const message = new Uint8Array((data?.length ?? 0) + 1)
        message[0] = type

        if (data) message.set(data, 1)
        return message
    }

    isAuthorized() {
        return this.socket.getUserData().id != null
    }

    subscribe(type: MessageType) {
        this.socket.subscribe(String(type))
        return this
    }

    unsubscribe(type: MessageType) {
        this.socket.unsubscribe(String(type))
        return this
    }

    publish(type: MessageType, data?: Uint8Array) {
        this.socket.publish(String(type), this.makeMessage(type, data))
    }

    send(type: MessageType, data?: Uint8Array) {
        this.socket.send(this.makeMessage(type, data), true)
    }
}

export interface SocketStorage {
    id?: number
}