import { Socket } from "./socket"
import { MessageType } from "../routes"
import { app } from ".."

export type RouteCollback = (socket: Socket) => Promise<void>

export class RouteBuilder {
    public type: MessageType
    public auth: boolean = true

    constructor(type: MessageType, auth: boolean) {
        this.type = type
        this.auth = auth
    }

    run(callback: RouteCollback) {
        if (this.auth) {
            app.emitter.on(String(this.type), (request: Socket) => {
                if (!request.isAuthorized()) return
                callback(request)
            })
        } else {
            app.emitter.on(String(this.type), callback)
        }
    }
}