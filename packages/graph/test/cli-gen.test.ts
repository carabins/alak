// cli-gen.test.ts — integration tests for `aqc gen <target> ...`.
//
// Spawns the CLI as a subprocess (same strategy as cli.test.ts) rather than
// importing its logic, so the test exercises the real argv parsing, the real
// dynamic-import fallback into sibling generator packages, and the real FS
// writes. Each test runs in its own tmp dir; generated files are discarded
// after the suite.
//
// Coverage target:
//   • `aqc gen --help` and `aqc gen -h` — exit 0, prints usage
//   • axum target on a valid .aql — exit 0, N files on disk
//   • tauri-rs target on a valid .aql — exit 0, N files on disk
//   • tauri target on a valid .aql — exit 0, N files on disk
//   • unknown target — exit 2 + "unknown target"
//   • missing target / input — exit 2
//   • broken .aql — exit 1 + compile diagnostics on stderr
//   • default output dir when -o omitted — "generated/" next to CWD

import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdtemp, rm, writeFile, readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const CLI = join(import.meta.dir, '..', 'bin', 'aqc.ts')

// A small but non-trivial schema covering records, enums, and actions —
// exercises the full generator surface for every target.
const VALID_AQL = `schema Sample {
  version: 1
  namespace: "sample"
}

enum Mood {
  Happy
  Sad
}

record Note {
  id: ID!
  body: String!
  mood: Mood
}

action CreateNote {
  input: { body: String! }
  output: Note!
}
`

const BROKEN_AQL = `schema Sample {
  version: 1
  namespace "sample"
}

record Point {
  id: ID!
  broken???
}
`

interface RunResult {
  code: number
  stdout: string
  stderr: string
}

async function run(args: string[], opts: { cwd?: string } = {}): Promise<RunResult> {
  const proc = Bun.spawn(['bun', 'run', CLI, ...args], {
    cwd: opts.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: 'ignore',
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  const code = await proc.exited
  return { code, stdout, stderr }
}

// Recursive file list under `dir`. Returns paths relative to `dir`,
// deterministically sorted.
async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(d: string, rel: string): Promise<void> {
    let entries
    try {
      entries = await readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = join(d, e.name)
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) await walk(full, r)
      else out.push(r)
    }
  }
  await walk(dir, '')
  return out.sort()
}

describe('aqc gen CLI', () => {
  let dir: string
  let validPath: string
  let brokenPath: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'aqc-gen-test-'))
    validPath = join(dir, 'sample.aql')
    brokenPath = join(dir, 'broken.aql')
    await writeFile(validPath, VALID_AQL, 'utf8')
    await writeFile(brokenPath, BROKEN_AQL, 'utf8')
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('`gen --help` exits 0 and prints target list', async () => {
    const r = await run(['gen', '--help'])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('aqc gen')
    expect(r.stdout).toContain('axum')
    expect(r.stdout).toContain('tauri-rs')
    expect(r.stdout).toContain('link-state')
  })

  test('`gen -h` also shows gen help', async () => {
    const r = await run(['gen', '-h'])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('aqc gen')
  })

  test('`gen` with no args → exit 2 (missing target)', async () => {
    const r = await run(['gen'])
    expect(r.code).toBe(2)
    expect(r.stderr).toContain('missing target')
  })

  test('`gen <target>` with no .aql → exit 2 (missing input)', async () => {
    const r = await run(['gen', 'axum'])
    expect(r.code).toBe(2)
    expect(r.stderr).toContain('missing input')
  })

  test('unknown target → exit 2 with known-list hint', async () => {
    const r = await run(['gen', 'bogus', validPath])
    expect(r.code).toBe(2)
    expect(r.stderr).toContain('unknown target')
    expect(r.stderr).toContain('axum')
    expect(r.stderr).toContain('tauri-rs')
  })

  test('broken .aql on any target → exit 1, compile diagnostic, no files', async () => {
    const outDir = join(dir, 'out-broken')
    const r = await run(['gen', 'axum', brokenPath, '-o', outDir])
    expect(r.code).toBe(1)
    expect(r.stderr).toMatch(/E\d{3}/)
    expect(r.stdout).not.toContain('Generated')
    // Either outDir was never created, or it contains no generated files.
    const files = await listFiles(outDir)
    expect(files.length).toBe(0)
  })

  test('axum target → exit 0, 5 files under <ns_flat>/', async () => {
    const outDir = join(dir, 'out-axum')
    const r = await run(['gen', 'axum', validPath, '-o', outDir])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Generated')
    expect(r.stdout).toContain('file(s)')
    const files = await listFiles(outDir)
    // graph-axum emits mod, types, handlers, state, routes — 5 files per ns.
    expect(files.length).toBe(5)
    expect(files).toContain('sample/mod.rs')
    expect(files).toContain('sample/types.rs')
    expect(files).toContain('sample/handlers.rs')
    expect(files).toContain('sample/state.rs')
    expect(files).toContain('sample/routes.rs')
  })

  test('tauri-rs target → exit 0, 6 files under generated/<ns_flat>/', async () => {
    const outDir = join(dir, 'out-tauri-rs')
    const r = await run(['gen', 'tauri-rs', validPath, '-o', outDir])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Generated')
    const files = await listFiles(outDir)
    // graph-tauri-rs emits mod/types/handlers/commands/register/events — 6.
    // Paths are prefixed with generated/ by the generator itself.
    expect(files.length).toBe(6)
    for (const name of ['mod.rs', 'types.rs', 'handlers.rs', 'commands.rs', 'register.rs', 'events.rs']) {
      expect(files.some(f => f.endsWith(`/${name}`))).toBe(true)
    }
  })

  test('tauri target → exit 0, 1 .ts file per namespace', async () => {
    const outDir = join(dir, 'out-tauri')
    const r = await run(['gen', 'tauri', validPath, '-o', outDir])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Generated')
    const files = await listFiles(outDir)
    expect(files.length).toBeGreaterThanOrEqual(1)
    expect(files.some(f => f.endsWith('.generated.ts'))).toBe(true)
  })

  test('--no-header suppresses banner', async () => {
    const outDirWith = join(dir, 'out-with-header')
    const outDirNo = join(dir, 'out-no-header')
    await run(['gen', 'axum', validPath, '-o', outDirWith])
    await run(['gen', 'axum', validPath, '-o', outDirNo, '--no-header'])
    const modWith = await Bun.file(join(outDirWith, 'sample', 'mod.rs')).text()
    const modNo = await Bun.file(join(outDirNo, 'sample', 'mod.rs')).text()
    // Banner typically includes "AUTOGENERATED" or similar marker.
    expect(modWith).toContain('AUTOGENERATED')
    expect(modNo).not.toContain('AUTOGENERATED')
  })

  test('--namespace filter narrows output', async () => {
    // Schema defines ns "sample". Filter to a non-existing ns → generator
    // emits a single diagnostic (not found) but we check the wired-through
    // behavior: unknown namespace is a generator error → exit 1.
    const outDir = join(dir, 'out-ns-missing')
    const r = await run(['gen', 'axum', validPath, '-o', outDir, '--namespace', 'no-such-ns'])
    // axum emits this as error severity → CLI exits 1.
    expect(r.code).toBe(1)
    expect(r.stderr.toLowerCase()).toContain('not found')
  })

  test('-o omitted → default ./generated/ dir', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'aqc-gen-default-'))
    try {
      // Copy the schema into cwd so the relative path works.
      const aqlLocal = join(cwd, 'sample.aql')
      await writeFile(aqlLocal, VALID_AQL, 'utf8')
      const r = await run(['gen', 'axum', 'sample.aql'], { cwd })
      expect(r.code).toBe(0)
      const defaultDir = join(cwd, 'generated')
      const st = await stat(defaultDir)
      expect(st.isDirectory()).toBe(true)
      const files = await listFiles(defaultDir)
      expect(files.length).toBeGreaterThan(0)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('--json emits compile errors as JSON on stderr', async () => {
    const outDir = join(dir, 'out-json-err')
    const r = await run(['gen', 'axum', brokenPath, '-o', outDir, '--json'])
    expect(r.code).toBe(1)
    const first = r.stderr.trim().split('\n').find(l => l.trim().startsWith('['))
    expect(first).toBeDefined()
    const diags = JSON.parse(first!)
    expect(Array.isArray(diags)).toBe(true)
    expect(diags.length).toBeGreaterThan(0)
    expect(diags[0].code).toMatch(/^E\d{3}$/)
  })
})
