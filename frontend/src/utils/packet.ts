const encoder = new TextEncoder()

export class Packet {
    private buf: number[] = []

    /** 0 to 255 · 1 byte */
    u8(v: number): this {
        this.buf.push(v & 0xFF)
        return this
    }

    /** 0 to 65 535 · 2 bytes */
    u16(v: number): this {
        this.buf.push((v >> 8) & 0xFF, v & 0xFF)
        return this
    }

    /** 0 to 4 294 967 295 · 4 bytes */
    u32(v: number): this {
        this.buf.push(
            (v >>> 24) & 0xFF,
            (v >>> 16) & 0xFF,
            (v >>>  8) & 0xFF,
             v         & 0xFF
        )
        return this
    }

    /** -128 to 127 · 1 byte */
    i8(v: number): this {
        this.buf.push(v & 0xFF)
        return this
    }

    /** -32 768 to 32 767 · 2 bytes */
    i16(v: number): this {
        this.buf.push((v >> 8) & 0xFF, v & 0xFF)
        return this
    }

    /** -2 147 483 648 to 2 147 483 647 · 4 bytes */
    i32(v: number): this {
        this.buf.push(
            (v >> 24) & 0xFF,
            (v >> 16) & 0xFF,
            (v >>  8) & 0xFF,
             v        & 0xFF
        )
        return this
    }

    /** ±3.4×10³⁸, ~7 significant digits · 4 bytes */
    f32(v: number): this {
        const tmp = new DataView(new ArrayBuffer(4))
        tmp.setFloat32(0, v, false)
        const b = new Uint8Array(tmp.buffer)
        this.buf.push(b[0], b[1], b[2], b[3])
        return this
    }

    /** ±1.8×10³⁰⁸, ~15 significant digits · 8 bytes */
    f64(v: number): this {
        const tmp = new DataView(new ArrayBuffer(8))
        tmp.setFloat64(0, v, false)
        const b = new Uint8Array(tmp.buffer)
        this.buf.push(b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7])
        return this
    }

    /** true/false · 1 byte */
    bool(v: boolean): this {
        this.buf.push(v ? 1 : 0)
        return this
    }

    /** UTF-8 string up to 65 535 bytes long · 2 + N bytes */
    str(v: string): this {
        const encoded = encoder.encode(v)
        this.u16(encoded.length)
        this.buf.push(...encoded)
        return this
    }

    /** Raw bytes, no length prefix · N bytes */
    bytes(v: Uint8Array): this {
        this.buf.push(...v)
        return this
    }

    build(): ArrayBuffer {
        return new Uint8Array(this.buf).buffer
    }
}