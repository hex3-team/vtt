import { Deferred } from "@utils/deferred"
import { useEffect } from "react"
import mitt from "mitt"

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

interface SocketConfig<
    TextIn extends string = never,
    TextOut extends string = never,
    ByteIn extends number = never,
    ByteOut extends number = never
> {
    reconnectMaxAttempts?: number | null
    reconnectDelayMs?: number | null

    textHandler?: BaseTextHandler<TextIn, TextOut> | null
    byteHandler?: BaseByteHandler<ByteIn, ByteOut> | null
}

export type SocketStatus =
    | "connecting"
    | "connected"
    | "disconnecting"
    | "disconnected"

type StatusCallback = (status: SocketStatus) => void

export class Socket<
    TextIn extends string = never,
    TextOut extends string = never,
    ByteIn extends number = never,
    ByteOut extends number = never
> {
    private url: string

    private reconnectMaxAttempts: number | null = null
    private reconnectDelayMs: number | null = null

    private textHandler: BaseTextHandler<TextIn, TextOut> | null = null
    private byteHandler: BaseByteHandler<ByteIn, ByteOut> | null = null

    constructor(url: string, config?: SocketConfig<TextIn, TextOut, ByteIn, ByteOut>) {
        this.url = url

        this.reconnectMaxAttempts = config?.reconnectMaxAttempts ?? null
        this.reconnectDelayMs = config?.reconnectDelayMs ?? null

        this.textHandler = config?.textHandler ?? null
        this.byteHandler = config?.byteHandler ?? null
    }

    private ws: WebSocket | null = null

    private reconnectAttempts = 0
    private manuallyClosed = false

    private _status: SocketStatus = "disconnected"
    get status() { return this._status }

    private statusEmitter = mitt<Record<SocketStatus, undefined>>()
    private statusListeners = new Set<StatusCallback>()

    useStatus(cb: StatusCallback) {
        useEffect(() => {
            this.statusListeners.add(cb)
            
            return () => {
                this.statusListeners.delete(cb)
            }
        }, [])
    }

    useConnecting(cb: () => void) {
        useEffect(() => {
            this.statusEmitter.on("connecting", cb)

            return () => {
                this.statusEmitter.off("connecting", cb)
            }
        }, [])
    }

    useConnected(cb: () => void) {
        useEffect(() => {
            this.statusEmitter.on("connected", cb)

            return () => {
                this.statusEmitter.off("connected", cb)
            }
        }, [])
    }

    useDisconnecting(cb: () => void) {
        useEffect(() => {
            this.statusEmitter.on("disconnecting", cb)

            return () => {
                this.statusEmitter.off("disconnecting", cb)
            }
        }, [])
    }

    useDisconnected(cb: () => void) {
        useEffect(() => {
            this.statusEmitter.on("disconnected", cb)

            return () => {
                this.statusEmitter.off("disconnected", cb)
            }
        }, [])
    }

    private setStatus(status: SocketStatus) {
        this._status = status

        this.statusListeners
            .forEach((cb) => cb(this._status))
        
        this.statusEmitter.emit(this._status)
    }

    private tryReconnect() {
        if (this.reconnectAttempts >= this.reconnectMaxAttempts!) return
        this.reconnectAttempts++

        setTimeout(() => {
            if (!this.manuallyClosed) this.connect()
        }, this.reconnectDelayMs!)
    }

    connect() {
        const deferred = new Deferred<Event>()

        this.manuallyClosed = false
        this.setStatus("connecting")

        this.ws = new WebSocket(this.url)
        this.ws.binaryType = "arraybuffer"

        this.ws.onopen = (e) => {
            this.reconnectAttempts = 0
            this.setStatus("connected")

            deferred.resolve(e)
        }

        this.ws.onclose = (e) => {
            this.setStatus("disconnected")

            deferred.reject(e)

            if (!this.manuallyClosed && this.reconnectAttempts) {
                this.tryReconnect()
            }
        }

        this.ws.onerror = (e) => {
            deferred.reject(e)
        }

        this.ws.onmessage = (e) => {
            if (typeof e.data === "string") {
                this.textMessageHandler(e.data)
            } else if (e.data instanceof ArrayBuffer) {
                this.byteMessageHandler(e.data)
            }
        }

        return deferred.promise
    }

    private textMessageHandler(message: string) {
        try {
            const { type, payload } = this.textHandler!.extractor(message)
            this.textEmitter.emit(type, payload)
        } catch {
            this.textUnhandledEmitter.emit("", message)
        }
    }

    private byteMessageHandler(message: ArrayBuffer) {
        try {
            const { type, payload } = this.byteHandler!.extractor(message)
            this.byteEmitter.emit(String(type), payload)
        } catch {
            this.byteUnhandledEmitter.emit("", new DataView(message))
        }
    }

    private textEmitter = mitt<Record<string, any>>()
    private textUnhandledEmitter = mitt<Record<string, string>>()
    private byteEmitter = mitt<Record<string, DataView>>()
    private byteUnhandledEmitter = mitt<Record<string, DataView>>()

    text = {
        use: (type: TextIn, cb: (payload: any) => void) => {
            useEffect(() => {
                this.textEmitter.on(type, cb)
                return () => this.textEmitter.off(type, cb)
            }, [])
        },

        useUnhandled: (cb: (message: string) => void) => {
            useEffect(() => {
                this.textUnhandledEmitter.on("", cb)
                return () => this.textUnhandledEmitter.off("", cb)
            }, [])
        },

        send: (type: TextOut, payload: any) => {
            if (!this.textHandler) {
                throw Error("textInjector not defined")
            }

            if (!this.ws) {
                throw Error("connect method was not invoked")
            }

            this.ws.send(this.textHandler.injector(type, payload))
        },

        sendRaw: (message: string) => {
            if (!this.ws) {
                throw Error("connect method was not invoked")
            }

            this.ws.send(message)
        }
    }

    byte = {
        use: (type: ByteIn, cb: (payload: DataView) => void) => {
            useEffect(() => {
                this.byteEmitter.on(String(type), cb)
                return () => this.byteEmitter.off(String(type), cb)
            }, [])
        },

        useUnhandled: (cb: (message: DataView) => void) => {
            useEffect(() => {
                this.byteUnhandledEmitter.on("", cb)
                return () => this.byteUnhandledEmitter.off("", cb)
            }, [])
        },

        send: (type: ByteOut, payload: ArrayBuffer) => {
            if (!this.byteHandler) {
                throw Error("byteInjector not defined")
            }

            if (!this.ws) {
                throw Error("connect method was not invoked")
            }

            this.ws.send(this.byteHandler.injector(type, payload))
        },

        sendRaw: (message: ArrayBuffer) => {
            if (!this.ws) {
                throw Error("connect method was not invoked")
            }
            
            this.ws.send(message)
        }
    }

    disconnect() {
        this.setStatus("disconnecting")

        this.manuallyClosed = true
        this.reconnectAttempts = 0

        this.ws?.close()
        this.ws = null
    }
}