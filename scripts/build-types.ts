#!/usr/bin/env bun
/**
 * Build .d.ts bundles for all @alaq/* packages.
 *
 * Runs `tsc -p <package>/tsconfig.build.json` in dependency order, then
 * copies hand-written `.d.ts` sources that tsc skips (source files that are
 * already .d.ts don't get re-emitted).
 *
 * Usage:  bun scripts/build-types.ts [--clean]
 *
 * Addresses FINDINGS §1.3 — consumers no longer drag upstream source
 * through the type-checker.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, cpSync, rmSync, mkdirSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const PACKAGES = resolve(ROOT, 'packages')

// Order matters — downstream packages read upstream dist/*.d.ts.
const PIPELINE: string[] = [
  'quark',
  'deep-state',
  'link',
  'link-state',
  'link-state-vue',
  'nucl',
  'atom',
  'fx',
  'graph',
  'graph-link-state',
  'graph-zenoh',
]

function run(cmd: string, args: string[], cwd: string) {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true })
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed in ${cwd}`)
  }
}

function copyHandWrittenDts(pkgSrc: string, pkgDist: string) {
  if (!existsSync(pkgSrc)) return
  for (const entry of readdirSync(pkgSrc)) {
    const full = join(pkgSrc, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      copyHandWrittenDts(full, join(pkgDist, entry))
      continue
    }
    if (!entry.endsWith('.d.ts')) continue
    const dest = join(pkgDist, entry)
    if (!existsSync(dirname(dest))) mkdirSync(dirname(dest), { recursive: true })
    cpSync(full, dest)
  }
}

const clean = process.argv.includes('--clean')

for (const name of PIPELINE) {
  const pkgDir = join(PACKAGES, name)
  const tsconfig = join(pkgDir, 'tsconfig.build.json')
  if (!existsSync(tsconfig)) {
    console.warn(`[skip] ${name} — no tsconfig.build.json`)
    continue
  }
  if (clean) {
    const dist = join(pkgDir, 'dist')
    if (existsSync(dist)) rmSync(dist, { recursive: true, force: true })
  }
  console.log(`[build] @alaq/${name}`)
  run('bun', ['x', 'tsc', '-p', 'tsconfig.build.json'], pkgDir)
  copyHandWrittenDts(join(pkgDir, 'src'), join(pkgDir, 'dist'))
}

console.log('\n[done] .d.ts bundles ready under packages/*/dist/')
