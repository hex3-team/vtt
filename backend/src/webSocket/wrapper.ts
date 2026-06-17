import { TemplatedApp, WebSocket as uWebSocket } from "uWebSockets.js"
import EventEmitter from "events"
import { Socket } from "./socket"

const decoder = new TextDecoder()

export interface ExtractorValue<T, P> {
    type: T
    payload: P
}

abstract class BaseHandler<I, O, M, P, ET, EP, IV> {
    declare private _input: I;
    declare private _output: O;

    abstract extractor(message: M): ExtractorValue<ET, EP>
    abstract injector(type: O, payload: P): IV
}

export class BaseTextHandler<I extends string, O extends string>
extends BaseHandler<I, O, string, any, string, any, string>
{
    override extractor(message: string) {
        const { type, payload } = JSON.parse(message)
        return { type, payload }
    }

    override injector(type: O, payload: any) {
        const message = { type, payload }
        return JSON.stringify(message)
    }
}

export class BaseByteHandler<I extends number, O extends number>
extends BaseHandler<I, O, ArrayBuffer, ArrayBuffer, number, DataView, ArrayBuffer>
{
    override extractor(message: ArrayBuffer) {
        const type = new Uint8Array(message)[0]
        const payload = new DataView(message, 1, message.byteLength - 1)

        return { type, payload }
    }
    
    override injector(type: O, payload: ArrayBuffer) {
        const buffer = new ArrayBuffer(1 + payload.byteLength)
        const message = new Uint8Array(buffer)

        message[0] = type
        message.set(new Uint8Array(payload), 1)

        return message.buffer
    }
}

interface WebSocketWrapperConfig<
    SocketStorage,
    TI extends string,
    TO extends string,
    BI extends number,
    BO extends number
> {
    url?: string | null
    textHandler?: BaseTextHandler<TI, TO> | null
    byteHandler?: BaseByteHandler<BI, BO> | null
    storage: SocketStorage
}

type SocketOnConnected<SocketStorage, TO extends string, BO extends number> = (socket: Socket<SocketStorage, TO, BO>) => void
type SocketOnDisconnected<SocketStorage, TO extends string, BO extends number> = (socket: Socket<SocketStorage, TO, BO>, code: number) => void

export class WebSocketWrapper<
    SocketStorage,
    TI extends string,
    TO extends string,
    BI extends number,
    BO extends number
> {
    private textEmitter: EventEmitter
    private textUnhandledEmitter: EventEmitter
    private byteEmitter: EventEmitter
    private byteUnhandledEmitter: EventEmitter

    private textHandler: BaseTextHandler<TI, TO> | null
    private byteHandler: BaseByteHandler<BI, BO> | null

    constructor(server: TemplatedApp, config: WebSocketWrapperConfig<SocketStorage, TI, TO, BI, BO>) {
        server.ws(config.url ?? "", {
            message: this.messageHandler.bind(this),
            open: this.openHandler.bind(this),
            close: this.closeHandler.bind(this)
        })

        this.textEmitter = new EventEmitter()
        this.textUnhandledEmitter = new EventEmitter()
        this.byteEmitter = new EventEmitter()
        this.byteUnhandledEmitter = new EventEmitter()

        this.textHandler = config.textHandler ?? null
        this.byteHandler = config.byteHandler ?? null
    }

    private messageHandler(socket: uWebSocket<SocketStorage>, message: ArrayBuffer, isBinary: boolean) {
        if (isBinary) {
            try {
                const { type, payload } = this.byteHandler!.extractor(message)
                this.byteEmitter.emit(String(type), socket, payload)
            } catch {
                this.byteUnhandledEmitter.emit("", new DataView(message))
            }
        } else {
            const textMessage = decoder.decode(message)

            try {
                const { type, payload } = this.textHandler!.extractor(textMessage)
                this.textEmitter.emit(type, socket, payload)
            } catch {
                this.textUnhandledEmitter.emit("", textMessage)
            }
        }
    }

    private onConnectListeners = new Set<SocketOnConnected<SocketStorage, TO, BO>>()
    private onCloseListeners = new Set<SocketOnDisconnected<SocketStorage, TO, BO>>()

    private openHandler(raw: uWebSocket<SocketStorage>) {
        const socket = new Socket(raw, this.textHandler, this.byteHandler)
        this.onConnectListeners.forEach((cb) => cb(socket))
    }

    private closeHandler(raw: uWebSocket<SocketStorage>, code: number) {
        const socket = new Socket(raw, this.textHandler, this.byteHandler)
        this.onCloseListeners.forEach((cb) => cb(socket, code))
    }

    onConnected(cb: SocketOnConnected<SocketStorage, TO, BO>) {
        this.onConnectListeners.add(cb)
    }

    onDisconnected(cb: SocketOnDisconnected<SocketStorage, TO, BO>) {
        this.onCloseListeners.add(cb)
    }

    text = {
        on: (type: TI, cb: (socket: Socket<SocketStorage, TO, BO>, payload: any) => void) => {
            this.textEmitter.on(type, cb)
        }
    }

    byte = {
        on: (type: BI, cb: (socket: Socket<SocketStorage, TO, BO>, payload: DataView) => void) => {
            this.byteEmitter.on(String(type), cb)
        }
    }
}