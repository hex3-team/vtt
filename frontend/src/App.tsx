import "./App.style.scss"
import { useEffect } from "react"
import { Packet } from "./socket/packet"
import { socket } from "./socket"
import { ByteInput, ByteOutput } from "./socket/types"

export function App() {
    useEffect(() => {
        socket.connect()
    }, [])

    socket.useStatus((status) => {
        console.log(status)
    })

    socket.useConnected(() => {
        const payload = new Packet.Builder()
            .u8(10)
            .u8(12)
            .u8(103)
            .str("Амогус   ававыппвпы")
            .build()

        socket.byte.send(ByteOutput.HI, payload)
    })

    socket.byte.use(ByteInput.HI, (payload) => {
        const reader = new Packet.Reader(payload)
        const number = reader.u8()

        console.log("FROM SERVER:")
        console.log(`type HI ${number} ${reader.u8()} ${reader.u8()} ${reader.str()}`)
    })

    return (
        <div className="container">
        </div>
    )
}
