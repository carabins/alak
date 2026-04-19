// Standalone smoke runner — run with `bun run test/smoke.ts` from the
// package dir. Not part of the bun test suite; it exists so you can pipe
// the generated file through `bun x tsc --noEmit` manually.

import { compileSources } from '../../graph/src/index'
import { generate } from '../src/index'
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const FIXTURE_DIR = join(import.meta.dir, '..', '..', '..', 'Kotelok-2', 'schema')
const files = readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.aql')).sort()
const sources = files.map(n => ({
  path: join(FIXTURE_DIR, n),
  source: readFileSync(join(FIXTURE_DIR, n), 'utf8'),
}))

const { ir, diagnostics } = compileSources(sources)
for (const d of diagnostics) {
  if (d.severity === 'error') console.error('[sdl error]', d.message)
}
if (!ir) process.exit(1)

const res = generate(ir)
const outDir = join(import.meta.dir, '..', '.smoke-out')
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
for (const f of res.files) {
  const path = join(outDir, f.path)
  writeFileSync(path, f.content)
  console.log('[smoke]', path)
}
for (const d of res.diagnostics) {
  console.log(`[gen ${d.severity}]`, d.message)
}
