import { Deferred } from "@utils/deferred"
import { useEffect } from "react"
import mitt from "mitt"

type ByteTypeExtractorValue = { type: number, payload: DataView }
type ByteTypeExtractor = (message: ArrayBuffer) => ByteTypeExtractorValue

type ByteTypeInjector<T extends number> = (type: T, payload: ArrayBuffer) => ArrayBuffer

type TextTypeExtractorValue = { type: string, payload: any }
type TextTypeExtractor = (message: string) => TextTypeExtractorValue

type TextTypeInjector<T extends string> = (type: T, payload: any) => string

export class SocketBuilder<
    TextIn extends string = never,
    TextOut extends string = never,
    ByteIn extends number = never,
    ByteOut extends number = never
> {
    private url: string

    private reconnectMaxAttempts: number | null = null
    private reconnectDelayMs: number | null = null

    private textExtractor: TextTypeExtractor | null = null
    private textInjector: TextTypeInjector<TextOut> | null = null
    private byteExtractor: ByteTypeExtractor| null = null
    private byteInjector: ByteTypeInjector<ByteOut> | null = null

    constructor(url: string) {
        this.url = url
    }

    autoReconnect(maxAttempts: number = 10, delayMs: number = 500) {
        this.reconnectMaxAttempts = maxAttempts
        this.reconnectDelayMs = delayMs

        return this
    }

    textHandler<SI extends string, SO extends string>(
        extractor: TextTypeExtractor,
        injector: TextTypeInjector<SO>
    ): SocketBuilder<SI, SO, ByteIn, ByteOut> {
        this.textExtractor = extractor
        this.textInjector = injector as any
        return this as any
    }

    byteHandler<BI extends number, BO extends number>(
        extractor: ByteTypeExtractor,
        injector: ByteTypeInjector<BO>
    ): SocketBuilder<TextIn, TextOut, BI, BO> {
        this.byteExtractor = extractor
        this.byteInjector = injector as any
        return this as any
    }

    build() {
        return new Socket<TextIn, TextOut, ByteIn, ByteOut>(
            this.url,
            this.reconnectMaxAttempts,
            this.reconnectDelayMs,
            this.textExtractor,
            this.textInjector,
            this.byteExtractor,
            this.byteInjector
        )
    }
}

export type SocketStatus =
    | "connecting"
    | "connected"
    | "disconnecting"
    | "disconnected"

type StatusCallback = (status: SocketStatus) => void

class Socket<
    TextIn extends string = never,
    TextOut extends string = never,
    ByteIn extends number = never,
    ByteOut extends number = never
> {
    private url: string

    private reconnectMaxAttempts: number | null = null
    private reconnectDelayMs: number | null = null

    private textExtractor: TextTypeExtractor | null = null
    private textInjector: TextTypeInjector<TextOut> | null = null
    private byteExtractor: ByteTypeExtractor | null = null
    private byteInjector: ByteTypeInjector<ByteOut> | null = null

    constructor(
        url: string,
        reconnectMaxAttempts: number | null,
        reconnectDelayMs: number | null,
        textExtractor: TextTypeExtractor | null,
        textInjector: TextTypeInjector<TextOut> | null,
        byteExtractor: ByteTypeExtractor | null,
        byteInjector: ByteTypeInjector<ByteOut> | null
    ) {
        this.url = url

        this.reconnectMaxAttempts = reconnectMaxAttempts
        this.reconnectDelayMs = reconnectDelayMs
        
        this.textExtractor = textExtractor
        this.textInjector = textInjector
        this.byteExtractor = byteExtractor
        this.byteInjector = byteInjector
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
                this.textHandler(e.data)
            } else if (e.data instanceof ArrayBuffer) {
                this.byteHandler(e.data)
            }
        }

        return deferred.promise
    }

    private textHandler(message: string) {
        try {
            const { type, payload } = this.textExtractor!(message)
            this.textEmitter.emit(type, payload)
        } catch {
            this.textUnhandledEmitter.emit("", message)
        }
    }

    private byteHandler(message: ArrayBuffer) {
        try {
            const { type, payload } = this.byteExtractor!(message)
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
            if (!this.textInjector) {
                throw Error("textInjector not defined")
            }

            if (!this.ws) {
                throw Error("connect method was not invoked")
            }

            this.ws.send(this.textInjector(type, payload))
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
            if (!this.byteInjector) {
                throw Error("byteInjector not defined")
            }

            if (!this.ws) {
                throw Error("connect method was not invoked")
            }

            this.ws.send(this.byteInjector(type, payload))
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