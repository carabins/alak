import { test, expect, describe } from 'bun:test'
import { schemaCompile, schemaDiff } from '../src/tools'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('schemaCompile (inline)', () => {
  test('valid schema → ok=true, ir non-null', async () => {
    const r = await schemaCompile({
      inputs: [
        {
          path: 't.aql',
          source: 'schema S { version: 1, namespace: "s" }\nrecord A { id: ID! }',
        },
      ],
    })
    expect(r.ok).toBe(true)
    expect(r.ir).not.toBeNull()
    expect(r.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0)
  })

  test('syntax error → ok=false, diagnostics non-empty', async () => {
    const r = await schemaCompile({
      inputs: [{ path: 't.aql', source: 'schema S { version: 1 namespace: "s"\nrecord {}' }],
    })
    expect(r.ok).toBe(false)
    expect(r.diagnostics.length).toBeGreaterThan(0)
  })

  test('missing inputs → throws helpful error', async () => {
    await expect(schemaCompile({} as any)).rejects.toThrow(/non-empty array/)
    await expect(schemaCompile({ inputs: [] })).rejects.toThrow(/non-empty array/)
  })
})

describe('schemaCompile (filesystem)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'alaq-mcp-test-'))
  writeFileSync(join(dir, 'a.aql'), 'schema S { version: 1, namespace: "s" }\nrecord A { id: ID! }')
  writeFileSync(join(dir, 'b.aql'), 'schema S { version: 1, namespace: "s" }\nrecord B { id: ID! }')

  test('paths + rootDir reads files relative to root', async () => {
    const r = await schemaCompile({ paths: ['a.aql', 'b.aql'], rootDir: dir })
    expect(r.ok).toBe(true)
    expect(r.files).toHaveLength(2)
  })

  test('absolute path with no rootDir works', async () => {
    const r = await schemaCompile({ paths: [join(dir, 'a.aql')] })
    expect(r.ok).toBe(true)
  })

  test('relative path without rootDir is rejected', async () => {
    await expect(schemaCompile({ paths: ['a.aql'] })).rejects.toThrow(/not absolute/)
  })

  test('path traversal (..) is rejected with rootDir', async () => {
    await expect(
      schemaCompile({ paths: ['../etc/passwd'], rootDir: dir }),
    ).rejects.toThrow(/escapes rootDir/)
  })

  test('cleanup', () => {
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('schemaDiff', () => {
  const base = 'schema S { version: 1, namespace: "s" }\nrecord A { id: ID!, name: String! }'

  test('identical → empty changes', async () => {
    const r = await schemaDiff({
      before: [{ path: 't.aql', source: base }],
      after: [{ path: 't.aql', source: base }],
    })
    expect(r.ok).toBe(true)
    expect(r.report?.changes).toHaveLength(0)
  })

  test('add optional field → 1 non-breaking', async () => {
    const after = base.replace('name: String!', 'name: String!, nick: String')
    const r = await schemaDiff({
      before: [{ path: 't.aql', source: base }],
      after: [{ path: 't.aql', source: after }],
    })
    expect(r.ok).toBe(true)
    expect(r.report?.summary.non_breaking).toBe(1)
    expect(r.report?.summary.breaking).toBe(0)
  })

  test('broken before → ok=false with message', async () => {
    const r = await schemaDiff({
      before: [{ path: 't.aql', source: 'schema { broken' }],
      after: [{ path: 't.aql', source: base }],
    })
    expect(r.ok).toBe(false)
    expect(r.message).toBeTruthy()
  })

  test('mixed inline + filesystem sides', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'alaq-mcp-mix-'))
    try {
      writeFileSync(join(dir, 's.aql'), base)
      const r = await schemaDiff({
        before: { paths: ['s.aql'], rootDir: dir },
        after: [{ path: 't.aql', source: base.replace('name: String!', 'name: String') }],
      })
      expect(r.ok).toBe(true)
      expect(r.report?.summary.review).toBe(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
