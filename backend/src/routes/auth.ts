import { Packet } from "../core/packet"
import { PacketReader } from "../core/packetReader"
import { app } from "../index"
import { MessageType } from "../routes"

app.on(MessageType.HI, false).run(async(socket) => {
    const view = new DataView(
        socket.message.buffer, 
        socket.message.byteOffset,
        socket.message.byteLength
    )

    const reader = new PacketReader(view)
    const number = reader.u8()
    const number2 = reader.u8()
    const number3 = reader.u8()
    const string = reader.str()
    
    console.warn(number)
    console.warn(number2)
    console.warn(number3)
    console.warn(string)
    console.error(socket.message)

    const payload = new Packet()
        .u8(34)
        .u8(34)
        .u8(34)
        .str("ббобус")
        .build()

    socket.storage.id = 1
    socket.send(MessageType.HI, payload)
})

// app
//     .route('mouse::move')
//     .run(async(req) => {
//         const data = {name: req.storage.name, ...req.message}
//         const match = mouseCords.find((v) => v.name === req.storage.name)

//         if (match) {
//             match.x = req.message.x
//             match.y = req.message.y
//         } else {
//             mouseCords.push(data)
//         }

//         req.publish('table', 'mouse::move', data)
//     })