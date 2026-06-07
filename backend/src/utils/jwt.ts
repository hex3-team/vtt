import { createHmac } from "crypto";

export const JWT = new class {
    secret = Array.from(
        crypto.getRandomValues(new Uint8Array(20)),
        (v) => v.toString(16).padStart(2, '0')
    ).join('')

    head = {
        alg: 'HS256',
        typ: 'jwt',
        iss: 'vtt-server'
    }

    build(clientID: number) {
        const head = Buffer.from(JSON.stringify(this.head)).toString('base64')
        const body = Buffer.from(JSON.stringify({id: clientID})).toString('base64')
        const signature = createHmac('SHA256', this.secret)
            .update(`${head}.${body}`)
            .digest('base64')

        return `${head}.${body}.${signature}`
    }

    verify(token: string) {
        const [head, body, signature] = token.split('.')
        const newSignature = createHmac('SHA256', this.secret)
            .update(`${head}.${body}`)
            .digest('base64')

        if (newSignature === signature) return true
        return false
    }
}()