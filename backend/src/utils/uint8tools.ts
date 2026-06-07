export const Uint8Tools = new class {
    encode(value: string) { return (new TextEncoder()).encode(value) }
    decode(array: Uint8Array) { return (new TextDecoder()).decode(array) }
}()