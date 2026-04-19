import { test, expect, describe } from 'bun:test'
import { compileFiles, compileSources } from '../src/index'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const FIX = (name: string) => join(import.meta.dir, 'fixtures', 'kotelok', name)

const kotelokPaths = [
  FIX('identity.aql'),
  FIX('players.aql'),
  FIX('lobby.aql'),
  FIX('round.aql'),
  FIX('system.aql'),
]

describe('compileFiles: kotelok fixtures on disk', () => {
  test('all 5 files link with zero errors', async () => {
    const res = await compileFiles(kotelokPaths)
    const errors = res.diagnostics.filter(d => d.severity === 'error')
    if (errors.length) console.error('errors:', errors)
    expect(errors).toEqual([])
    expect(res.ir!.schemas['kotelok']).toBeDefined()
    expect(res.ir!.schemas['core.identity']).toBeDefined()
  })

  test('merged GameRoom contains currentRound + currentTeamId', async () => {
    const res = await compileFiles(kotelokPaths)
    const gr = res.ir!.schemas['kotelok']!.records['GameRoom']!
    const names = gr.fields.map(f => f.name)
    expect(names).toContain('currentRound')
    expect(names).toContain('currentTeamId')
  })

  test('actions from multiple files are present in merged IR', async () => {
    const res = await compileFiles(kotelokPaths)
    const actions = res.ir!.schemas['kotelok']!.actions
    // from lobby.aql
    expect(actions['CreateRoom']).toBeDefined()
    expect(actions['JoinRoom']).toBeDefined()
    expect(actions['StartGame']).toBeDefined()
    // from round.aql
    expect(actions['GuessWord']).toBeDefined()
    expect(actions['FixScore']).toBeDefined()
  })

  test('compileFiles equals compileSources for the same inputs', async () => {
    const sources = await Promise.all(
      kotelokPaths.map(async p => ({ path: p, source: await readFile(p, 'utf8') })),
    )
    const fsRes = await compileFiles(kotelokPaths)
    const memRes = compileSources(sources)
    expect(JSON.stringify(fsRes.ir)).toBe(JSON.stringify(memRes.ir))
    // Diagnostic counts should match.
    expect(fsRes.diagnostics.length).toBe(memRes.diagnostics.length)
  })

  test('per-file IR map is populated with each path', async () => {
    const res = await compileFiles(kotelokPaths)
    for (const p of kotelokPaths) {
      expect(res.files[p]).toBeDefined()
      expect(res.files[p]).not.toBeNull()
    }
  })
})
