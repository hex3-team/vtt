import { readdirSync } from 'fs'
import { join } from 'path'
import { Application } from './core/app'

export const app = new Application('/api/ws', 3001)

const ROUTES_DIR_PATH = join(__dirname, 'routes')
import "./routes/auth"
// readdirSync(ROUTES_DIR_PATH).forEach((v) => {
//     import(join(ROUTES_DIR_PATH, v))
// })

process.on("uncaughtException", console.error)