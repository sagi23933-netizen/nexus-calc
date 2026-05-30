/**
 * Export the entire application to a distributable .zip archive.
 *
 *   npm run zip
 *
 * Bundles all source (frontend, backend, MCP server, shared model, configs and
 * docs) while excluding heavy/derived directories (node_modules, dist, data,
 * the previous archive). Produces `new-level-multi-agentics.zip` at the app root.
 */

import archiver from 'archiver'
import { createWriteStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'new-level-multi-agentics.zip')

const EXCLUDE = ['node_modules/**', 'dist/**', 'data/**', '*.zip', '.git/**', '*.log']

const output = createWriteStream(OUT)
const archive = archiver('zip', { zlib: { level: 9 } })

output.on('close', () => {
  const mb = (archive.pointer() / (1024 * 1024)).toFixed(2)
  // eslint-disable-next-line no-console
  console.log(`\n  ✓ Wrote ${OUT}`)
  // eslint-disable-next-line no-console
  console.log(`  ✓ ${archive.pointer().toLocaleString()} bytes (${mb} MB)\n`)
})

archive.on('warning', (err) => {
  if (err.code !== 'ENOENT') throw err
})
archive.on('error', (err) => {
  throw err
})

archive.pipe(output)
archive.glob('**/*', { cwd: ROOT, ignore: EXCLUDE, dot: true }, { prefix: 'new-level-multi-agentics' })
await archive.finalize()
