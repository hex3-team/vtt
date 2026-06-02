const decoder = new TextDecoder()

export class PacketReader {
    private view: DataView
    private pos: number = 0

    constructor(view: DataView) {
        this.view = view
    }

    get bytesLeft(): number {
        return this.view.byteLength - this.pos
    }

    /** 0 to 255 · 1 byte */
    u8(): number {
        return this.view.getUint8(this.pos++)
    }

    /** 0 to 65 535 · 2 bytes */
    u16(): number {
        const v = this.view.getUint16(this.pos)
        this.pos += 2
        return v
    }

    /** 0 to 4 294 967 295 · 4 bytes */
    u32(): number {
        const v = this.view.getUint32(this.pos)
        this.pos += 4
        return v
    }

    /** -128 to 127 · 1 byte */
    i8(): number {
        return this.view.getInt8(this.pos++)
    }

    /** -32 768 to 32 767 · 2 bytes */
    i16(): number {
        const v = this.view.getInt16(this.pos)
        this.pos += 2
        return v
    }

    /** -2 147 483 648 to 2 147 483 647 · 4 bytes */
    i32(): number {
        const v = this.view.getInt32(this.pos)
        this.pos += 4
        return v
    }

    /** ±3.4×10³⁸, ~7 significant digits · 4 bytes */
    f32(): number {
        const v = this.view.getFloat32(this.pos, false)
        this.pos += 4
        return v
    }

    /** ±1.8×10³⁰⁸, ~15 significant digits · 8 bytes */
    f64(): number {
        const v = this.view.getFloat64(this.pos, false)
        this.pos += 8
        return v
    }

    /** true/false · 1 byte */
    bool(): boolean {
        return this.u8() !== 0
    }

    /** UTF-8 string up to 65 535 bytes long · 2 + N bytes */
    str(): string {
        const len = this.u16()
        const bytes = new Uint8Array(this.view.buffer, this.pos + 1, len)
        this.pos += len
        return decoder.decode(bytes)
    }

    /** Read N raw bytes · N bytes */
    bytes(n: number): Uint8Array {
        const slice = new Uint8Array(this.view.buffer, this.pos, n)
        this.pos += n
        return slice
    }
}