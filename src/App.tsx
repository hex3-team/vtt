import { SocketBuilder } from "@utils/socket"
import "./App.style.scss"
import { useEffect } from "react"
import { Packet } from "@utils/packet"
import { PacketReader } from "@utils/packetReader"

enum ByteInput {
    HI
}

enum ByteOutput {
    HI
}

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

const socket = new SocketBuilder("wss://echo.websocket.org")
    .autoReconnect()
    .byteChannelHandler<ByteInput, ByteOutput>(byteChannelExtractor, byteChannelInjector)
    .build()

export function App() {
    useEffect(() => {
        socket.connect()
    }, [])

    useEffect(() => {
        console.log(socket.status)
    }, [socket.useStatus()])

    socket.byteChannel.use(ByteInput.HI, (payload) => {
        const reader = new PacketReader(payload)
        const number = reader.u8()
        const string = reader.str()
        const pi = reader.f32()
        const string2 = reader.str()

        console.log("FROM SERVER:")
        console.log(`type HI ${number} ${string} ${pi} ${string2}`)
    })

    socket.stringChannel.useUnhandled((message) => {
        console.log(message)

        if (message.startsWith("Request")) {
            const payload = new Packet()
                .u8(255)
                .str("sosal")
                .f32(3.14)
                .str("da")
                .build()

            socket.byteChannel.send(ByteOutput.HI, payload)
        }
    })

    return (
        <div className="container">
        </div>
    )
}
