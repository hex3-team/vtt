import { SocketBuilder } from "@utils/socket"
import { ByteInput, ByteOutput } from "./types/socket"

function byteChannelExtractor(message: ArrayBuffer) {
    const type = new Uint8Array(message)[0]
    const payload = new DataView(message, 1, message.byteLength - 1)

    return { type, payload }
}

function byteChannelInjector(type: ByteOutput, payload: ArrayBuffer) {
    const buffer = new ArrayBuffer(1 + payload.byteLength)
    const message = new Uint8Array(buffer)

    message[0] = type
    message.set(new Uint8Array(payload), 1)

    return message.buffer
}

export const socket = new SocketBuilder("ws://localhost:3001/api/ws")
    .autoReconnect()
    .byteChannelHandler<ByteInput, ByteOutput>(byteChannelExtractor, byteChannelInjector)
    .build()
