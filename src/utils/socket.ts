/**
    const stringChannelExtractor = (message: string) => {
        const { type, ...payload } = JSON.parse(message)
        return { type, payload }
    }

    const stringChannelInjector = (type: T, payload: any) => {
        const json = JSON.parse(payload)
        json.type = type

        return JSON.stringify(json)
    }

    const socket = new Socket("wss://kekw.lol")
        .autoReconnect(10, 500) //attempts, delay
        .stringChannelHandler<StringInput, StringOutput>(extractor, injector)
        .byteChannelHandler<ByteInput, ByteOutput>(extractor, injector)
        .build()
    
    socket.connect()
    socket.disconnect()

    const stringChannel = socket.stringChannel
    const byteChannel = socket.byteChannel

    stringChannel.use(type: T, (payload: any) => void)
    stringChannel.useUnhandled((message: string) => void)

    byteChannel.use(type: T, (payload: DataView) => void)
    byteChannel.useUnhandled((message: DataView) => void)

    stringChannel.send(type: T, payload: any)
    stringChannel.sendRaw(payload: string)

    byteChannel.send(type: T, payload: ArrayBufferLike)
    byteChannel.sendRaw(payload: ArrayBufferLike)
*/

import { Deferred } from "@utils/deferred"
import { useEffect, useSyncExternalStore } from "react"
import mitt from "mitt"

type ByteTypeExtractorValue = { type: number, payload: DataView }
type ByteTypeExtractor = (message: ArrayBuffer) => ByteTypeExtractorValue

type ByteTypeInjector<T extends number> = (type: T, payload: ArrayBuffer) => ArrayBuffer

type StringTypeExtractorValue = { type: string, payload: any }
type StringTypeExtractor = (message: string) => StringTypeExtractorValue

type StringTypeInjector<T extends string> = (type: T, payload: any) => string

export class SocketBuilder<
    StringIn extends string = never,
    StringOut extends string = never,
    ByteIn extends number = never,
    ByteOut extends number = never
> {
    private url: string

    private reconnectMaxAttempts: number | null = null
    private reconnectDelayMs: number | null = null

    private stringChannelExtractor: StringTypeExtractor | null = null
    private stringChannelInjector: StringTypeInjector<StringOut> | null = null
    private byteChannelExtractor: ByteTypeExtractor| null = null
    private byteChannelInjector: ByteTypeInjector<ByteOut> | null = null

    constructor(url: string) {
        this.url = url
    }

    autoReconnect(maxAttempts: number = 10, delayMs: number = 500) {
        this.reconnectMaxAttempts = maxAttempts
        this.reconnectDelayMs = delayMs

        return this
    }

    stringChannelHandler<SI extends string, SO extends string>(
        extractor: StringTypeExtractor,
        injector: StringTypeInjector<SO>
    ): SocketBuilder<SI, SO, ByteIn, ByteOut> {
        this.stringChannelExtractor = extractor
        this.stringChannelInjector = injector as any
        return this as any
    }

    byteChannelHandler<BI extends number, BO extends number>(
        extractor: ByteTypeExtractor,
        injector: ByteTypeInjector<BO>
    ): SocketBuilder<StringIn, StringOut, BI, BO> {
        this.byteChannelExtractor = extractor
        this.byteChannelInjector = injector as any
        return this as any
    }

    build() {
        return new Socket<StringIn, StringOut, ByteIn, ByteOut>(
            this.url,
            this.reconnectMaxAttempts,
            this.reconnectDelayMs,
            this.stringChannelExtractor,
            this.stringChannelInjector,
            this.byteChannelExtractor,
            this.byteChannelInjector
        )
    }
}

export enum SocketStatus {
    Connecting = "Connecting",
    Connected = "Connected",
    Disconnecting = "Disconnecting",
    Disconnected = "Disconnected"
}

class Socket<
    StringIn extends string = never,
    StringOut extends string = never,
    ByteIn extends number = never,
    ByteOut extends number = never
> {
    private url: string

    private reconnectMaxAttempts: number | null = null
    private reconnectDelayMs: number | null = null

    private stringChannelExtractor: StringTypeExtractor | null = null
    private stringChannelInjector: StringTypeInjector<StringOut> | null = null
    private byteChannelExtractor: ByteTypeExtractor | null = null
    private byteChannelInjector: ByteTypeInjector<ByteOut> | null = null

    constructor(
        url: string,
        reconnectMaxAttempts: number | null,
        reconnectDelayMs: number | null,
        stringChannelExtractor: StringTypeExtractor | null,
        stringChannelInjector: StringTypeInjector<StringOut> | null,
        byteChannelExtractor: ByteTypeExtractor | null,
        byteChannelInjector: ByteTypeInjector<ByteOut> | null
    ) {
        this.url = url

        this.reconnectMaxAttempts = reconnectMaxAttempts
        this.reconnectDelayMs = reconnectDelayMs
        
        this.stringChannelExtractor = stringChannelExtractor
        this.stringChannelInjector = stringChannelInjector
        this.byteChannelExtractor = byteChannelExtractor
        this.byteChannelInjector = byteChannelInjector
    }

    private ws: WebSocket | null = null

    private reconnectAttempts = 0
    private manuallyClosed = false

    private _status = SocketStatus.Disconnected
    public get status() { return this._status }
    private statusListeners = new Set<() => void>()

    useStatus(): SocketStatus {
        return useSyncExternalStore(
            (cb) => {
                this.statusListeners.add(cb)
                return () => this.statusListeners.delete(cb)
            },
            () => this._status
        )
    }

    private setStatus(status: SocketStatus) {
        this._status = status
        this.statusListeners.forEach((cb) => cb())
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
        this.setStatus(SocketStatus.Connecting)

        this.ws = new WebSocket(this.url)
        this.ws.binaryType = "arraybuffer"

        this.ws.onopen = (e) => {
            this.reconnectAttempts = 0
            this.setStatus(SocketStatus.Connected)

            deferred.resolve(e)
        }

        this.ws.onclose = (e) => {
            this.setStatus(SocketStatus.Disconnected)

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
                this.stringChannelHandler(e.data)
            } else if (e.data instanceof ArrayBuffer) {
                this.byteChannelHandler(e.data)
            }
        }

        return deferred.promise
    }

    private stringChannelHandler(message: string) {
        try {
            const { type, payload } = this.stringChannelExtractor!(message)
            this.stringChannelEmitter.emit(type, payload)
        } catch {
            this.stringChannelUnhandledEmitter.emit("", message)
        }
    }

    private byteChannelHandler(message: ArrayBuffer) {
        try {
            const { type, payload } = this.byteChannelExtractor!(message)
            this.byteChannelEmitter.emit(String(type), payload)
        } catch {
            this.byteChannelUnhandledEmitter.emit("", new DataView(message))
        }
        
    }

    private stringChannelEmitter = mitt<Record<string, any>>()
    private stringChannelUnhandledEmitter = mitt<Record<string, string>>()
    private byteChannelEmitter = mitt<Record<string, DataView>>()
    private byteChannelUnhandledEmitter = mitt<Record<string, DataView>>()

    stringChannel = {
        use: (type: StringIn, cb: (payload: any) => void) => {
            useEffect(() => {
                this.stringChannelEmitter.on(type, cb)
                return () => this.stringChannelEmitter.off(type, cb)
            }, [])
        },

        useUnhandled: (cb: (message: string) => void) => {
            useEffect(() => {
                this.stringChannelUnhandledEmitter.on("", cb)
                return () => this.stringChannelUnhandledEmitter.off("", cb)
            }, [])
        },

        send: (type: StringOut, payload: any) => {
            if (!this.stringChannelInjector) {
                throw Error("stringChannelInjector not defined")
            }

            if (!this.ws) {
                throw Error("websocket has not connected")
            }

            const message = this.stringChannelInjector(type, payload)
            this.ws.send(message)
        },

        sendRaw: (message: string) => {
            if (!this.ws) {
                throw Error("websocket has not connected")
            }

            this.ws.send(message)
        }
    }

    byteChannel = {
        use: (type: ByteIn, cb: (payload: DataView) => void) => {
            useEffect(() => {
                this.byteChannelEmitter.on(String(type), cb)
                return () => this.byteChannelEmitter.off(String(type), cb)
            }, [])
        },

        useUnhandled: (cb: (message: DataView) => void) => {
            useEffect(() => {
                this.byteChannelUnhandledEmitter.on("", cb)
                return () => this.byteChannelUnhandledEmitter.off("", cb)
            }, [])
        },

        send: (type: ByteOut, payload: ArrayBuffer) => {
            if (!this.byteChannelInjector) {
                throw Error("byteChannelInjector not defined")
            }

            if (!this.ws) {
                throw Error("websocket has not connected")
            }

            const message = this.byteChannelInjector(type, payload)
            this.ws.send(message)
        },

        sendRaw: (message: ArrayBuffer) => {
            if (!this.ws) {
                throw Error("websocket has not connected")
            }
            
            this.ws.send(message)
        }
    }

    disconnect() {
        this.setStatus(SocketStatus.Disconnecting)

        this.manuallyClosed = true
        this.reconnectAttempts = 0

        this.ws?.close()
        this.ws = null
    }
}