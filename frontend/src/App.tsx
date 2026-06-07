import "./App.style.scss"
import { useEffect } from "react"
import { Packet } from "@utils/packet"
import { PacketReader } from "@utils/packetReader"
import { socket } from "./init"
import { ByteInput, ByteOutput } from "./types/socket"
import { SocketStatus } from "@utils/socket"

export function App() {
    useEffect(() => {
        socket.connect()
    }, [])

    useEffect(() => {
        if (socket.status == SocketStatus.Connected) {
            const payload = new Packet()
                .u8(10)
                .u8(12)
                .u8(103)
                .str("Амогус   ававыппвпы")
                .build()

            socket.byteChannel.send(ByteOutput.HI, payload)
        } 
        
        console.log(socket.status)
    }, [socket.useStatus()])

    socket.byteChannel.use(ByteInput.HI, (payload) => {
        const reader = new PacketReader(payload)
        const number = reader.u8()

        console.log("FROM SERVER:")
        console.log(`type HI ${number} ${reader.u8()} ${reader.u8()} ${reader.str()}`)
    })

    return (
        <div className="container">
        </div>
    )
}
