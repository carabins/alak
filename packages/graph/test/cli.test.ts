import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdtemp, rm, writeFile, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Path to the CLI entry. Tests spawn `bun run <path> ...` rather than the
// `aqc` bin alias so they work in a fresh checkout without `bun install`.
const CLI = join(import.meta.dir, '..', 'bin', 'aqc.ts')

const VALID_AQL = `schema Sample {
  version: 1
  namespace: "sample"
}

record Point {
  id: ID!
  name: String!
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

describe('aqc CLI', () => {
  let dir: string
  let validPath: string
  let brokenPath: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'aqc-test-'))
    validPath = join(dir, 'valid.aql')
    brokenPath = join(dir, 'broken.aql')
    await writeFile(validPath, VALID_AQL, 'utf8')
    await writeFile(brokenPath, BROKEN_AQL, 'utf8')
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('--help exits 0 and prints usage', async () => {
    const r = await run(['--help'])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Usage:')
    expect(r.stdout).toContain('aqc')
  })

  test('-h also shows help', async () => {
    const r = await run(['-h'])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Usage:')
  })

  test('valid .aql → exit 0, IR JSON on stdout', async () => {
    const r = await run([validPath])
    expect(r.code).toBe(0)
    expect(r.stdout.length).toBeGreaterThan(0)
    const ir = JSON.parse(r.stdout)
    expect(ir).toBeDefined()
    expect(ir.schemas).toBeDefined()
    expect(ir.schemas.sample).toBeDefined()
    expect(ir.schemas.sample.records).toBeDefined()
    expect(ir.schemas.sample.records.Point).toBeDefined()
  })

  test('--pretty produces indented JSON', async () => {
    const r = await run([validPath, '--pretty'])
    expect(r.code).toBe(0)
    // Pretty JSON contains newlines + 2-space indent.
    expect(r.stdout).toContain('\n  ')
    const ir = JSON.parse(r.stdout)
    expect(ir.schemas.sample).toBeDefined()
  })

  test('-o writes IR to file, stdout empty', async () => {
    const outPath = join(dir, 'out.ir.json')
    const r = await run([validPath, '-o', outPath, '--pretty'])
    expect(r.code).toBe(0)
    expect(r.stdout).toBe('')
    const st = await stat(outPath)
    expect(st.isFile()).toBe(true)
    const content = await readFile(outPath, 'utf8')
    const ir = JSON.parse(content)
    expect(ir.schemas.sample.records.Point).toBeDefined()
  })

  test('--output=<path> long form also works', async () => {
    const outPath = join(dir, 'out2.ir.json')
    const r = await run([validPath, `--output=${outPath}`])
    expect(r.code).toBe(0)
    const content = await readFile(outPath, 'utf8')
    const ir = JSON.parse(content)
    expect(ir.schemas.sample).toBeDefined()
  })

  test('broken .aql → exit 1, diagnostic on stderr', async () => {
    const r = await run([brokenPath])
    expect(r.code).toBe(1)
    expect(r.stderr.length).toBeGreaterThan(0)
    // Human-readable format includes ERROR + an E-code.
    expect(r.stderr).toContain('ERROR')
    expect(r.stderr).toMatch(/E\d{3}/)
    // No IR on stdout.
    expect(r.stdout).toBe('')
  })

  test('broken .aql with --json → diagnostics as JSON array on stderr', async () => {
    const r = await run([brokenPath, '--json'])
    expect(r.code).toBe(1)
    // First non-empty line of stderr must be a JSON array of diagnostics.
    const firstLine = r.stderr.trim().split('\n')[0]
    const diags = JSON.parse(firstLine)
    expect(Array.isArray(diags)).toBe(true)
    expect(diags.length).toBeGreaterThan(0)
    expect(diags[0].code).toMatch(/^E\d{3}$/)
    expect(diags[0].severity).toBe('error')
  })

  test('missing input argument → exit 2 with usage hint', async () => {
    const r = await run([])
    expect(r.code).toBe(2)
    expect(r.stderr).toContain('missing input')
  })

  test('unknown option → exit 2', async () => {
    const r = await run([validPath, '--no-such-flag'])
    expect(r.code).toBe(2)
    expect(r.stderr).toContain('unknown option')
  })

  test('nonexistent input file → exit 2', async () => {
    const r = await run([join(dir, 'does-not-exist.aql')])
    expect(r.code).toBe(2)
    expect(r.stderr).toContain('cannot read')
  })
})
