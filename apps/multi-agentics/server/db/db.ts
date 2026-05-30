/**
 * SQLite connection bootstrap.
 *
 * Opens a single better-sqlite3 handle for the process, applies the schema, and
 * exposes it to the repositories. Synchronous by design — better-sqlite3 is
 * fast enough that the engine never blocks meaningfully on persistence, and it
 * keeps the call sites simple.
 */

import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data')
const DB_PATH = process.env.MA_DB_PATH || join(DATA_DIR, 'platform.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
  db.exec(schema)
  return db
}

/** Close the handle (used by tests / graceful shutdown). */
export function closeDb() {
  db?.close()
  db = null
}
