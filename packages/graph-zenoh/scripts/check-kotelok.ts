// Regenerate the compile-verification scaffold and run `cargo check`.
//
//   1. Parse the Kotelok .aql fixture through @alaq/graph.
//   2. Pipe the IR through @alaq/graph-zenoh.
//   3. Overwrite artifacts/graph-zenoh-check/src/kotelok.rs with the result.
//   4. Spawn `cargo check` against that scaffold.
//
// Run from repo root:  bun run packages/graph-zenoh/scripts/check-kotelok.ts

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { compileSources } from '../../graph/src/index'
import { generate } from '../src/index'

const REPO_ROOT = resolve(import.meta.dir, '..', '..', '..')
const FIXTURE_DIR = join(REPO_ROOT, 'packages', 'graph', 'test', 'fixtures', 'kotelok')
const CHECK_DIR = join(REPO_ROOT, 'artifacts', 'graph-zenoh-check')
const TARGET_RS = join(CHECK_DIR, 'src', 'kotelok.rs')
const MANIFEST = join(CHECK_DIR, 'Cargo.toml')

const FILES = ['identity.aql', 'players.aql', 'lobby.aql', 'round.aql', 'system.aql']

const inputs = FILES.map(n => ({
  path: join(FIXTURE_DIR, n),
  source: readFileSync(join(FIXTURE_DIR, n), 'utf8'),
}))

const res = compileSources(inputs)
const errs = res.diagnostics.filter(d => d.severity === 'error')
if (errs.length > 0 || !res.ir) {
  console.error('[check-kotelok] SDL compile errors:')
  for (const e of errs) console.error('  -', e.message)
  process.exit(1)
}
for (const w of res.diagnostics.filter(d => d.severity === 'warning')) {
  console.warn('[check-kotelok] SDL warning:', w.message)
}

const gen = generate(res.ir, { namespace: 'kotelok' })
if (gen.files.length !== 1) {
  console.error(`[check-kotelok] expected 1 emitted file, got ${gen.files.length}`)
  process.exit(1)
}
for (const w of gen.diagnostics.filter(d => d.severity === 'warning')) {
  console.warn('[check-kotelok] gen warning:', w.message)
}

await Bun.write(TARGET_RS, gen.files[0].content)
console.log(`[check-kotelok] wrote ${TARGET_RS} (${gen.files[0].content.length} bytes)`)

// Run cargo check. stdout / stderr inherit so the user sees real output.
const proc = Bun.spawn(['cargo', 'check', '--manifest-path', MANIFEST], {
  stdout: 'inherit',
  stderr: 'inherit',
})

const code = await proc.exited
if (code !== 0) {
  console.error(`\n[check-kotelok] cargo check FAILED (exit ${code})`)
  process.exit(code)
}
console.log('\n[check-kotelok] cargo check OK')
