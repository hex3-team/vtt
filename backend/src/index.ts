import { App as uServer } from "uWebSockets.js"
import { BaseByteHandler, WebSocketWrapper } from "./webSocket/wrapper"
import { Packet } from "./webSocket/packet"
import { ByteInput, ByteOutput, SocketStorage } from "./webSocket/types"

const server = uServer()

const socket = new WebSocketWrapper(server, {
    byteHandler: new BaseByteHandler<ByteInput, ByteOutput>(),
    storage: {} as SocketStorage
})

socket.byte.on(ByteInput.HI, (socket, payload) => {
    const packet = new Packet.Builder()
        .str("hiiiiiii")
        .build()

    socket.send(ByteOutput.HI, packet)
})

server.listen(3000, () => {
    console.log("STARTED")
})


/**
socket.use(new LoggerMiddleware()) // md for text and byte ws channels
socket.byte.use(new GlobalByteMiddleware()) // md onfly for byte channel

const unsecured = socket.byte
cosnt secured = socket.byte.useScope(new AuthMiddleware())
*/

// type MiddlewareRT = Promise<void | false>

// abstract class ByteMiddleware {
//     static readonly key: string

//     get storage() { return {} }

//     /** @returns `false` to stop propagation */
//     onConnected?(socket: Socket): MiddlewareRT
//     onDisconnected?(socket: Socket): MiddlewareRT

//     onBeforeHandler?(socket: Socket, message: ArrayBuffer): MiddlewareRT
//     onAfterHandler?(socket: Socket, payload: DataView): MiddlewareRT

//     onBeforeSend?(socket: Socket, payload: ArrayBuffer): MiddlewareRT
//     onAfterSend?(socket: Socket, payload: ArrayBuffer): MiddlewareRT
// }

// class MD extends ByteMiddleware {
//     static override key = "MD"

//     override async onConnected(socket: Socket): MiddlewareRT {
//         if (!socket.storage.id) return false
//     }

//     override async onBeforeHandler(socket: Socket, message: ArrayBuffer): MiddlewareRT {
//         // this.storage[key] = "kewk"
//     }
// }