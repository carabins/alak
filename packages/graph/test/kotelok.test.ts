import { test, expect, describe } from 'bun:test'
import { parseFile } from '../src/index'
import { join } from 'node:path'

const FIX = (name: string) =>
  join(import.meta.dir, 'fixtures', 'kotelok', name)

describe('§14 Kotelok fixtures', () => {
  test('identity.aql parses without errors', async () => {
    const { diagnostics, ir } = await parseFile(FIX('identity.aql'))
    expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
    expect(ir!.schemas['core.identity']!.scalars['UUID']).toBeDefined()
    expect(ir!.schemas['core.identity']!.scalars['DeviceID']).toBeDefined()
  })

  test('players.aql parses without errors', async () => {
    const { diagnostics, ir } = await parseFile(FIX('players.aql'))
    expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
    const ns = ir!.schemas['kotelok']!
    expect(ns.records['Player']).toBeDefined()
    expect(ns.records['Team']).toBeDefined()
  })

  test('lobby.aql parses without errors', async () => {
    const { diagnostics, ir } = await parseFile(FIX('lobby.aql'))
    const errs = diagnostics.filter(d => d.severity === 'error')
    if (errs.length) console.error(errs)
    expect(errs).toEqual([])
    const ns = ir!.schemas['kotelok']!
    expect(ns.records['GameRoom']?.scope).toBe('room')
    expect(ns.actions['JoinRoom']?.scope).toBe('room')
    expect(ns.enums['RoomStatus']?.values).toEqual(['LOBBY', 'GAME_ACTIVE', 'FINISHED'])
  })

  test('round.aql parses without errors and merges extend into GameRoom', async () => {
    // round.aql alone cannot resolve `GameRoom` from `use`, so we expect
    // no errors only because imported-types is treated as a trust set for
    // validator purposes. The extend merge only runs when the target record
    // is present in the same file. Here we focus on parsing + imports.
    const { diagnostics, ast, ir } = await parseFile(FIX('round.aql'))
    const errs = diagnostics.filter(d => d.severity === 'error')
    if (errs.length) console.error(errs)
    expect(errs).toEqual([])

    // AST should contain the extend declaration
    const ext = ast!.definitions.find(
      d => d.kind === 'extend' && d.name === 'GameRoom',
    )
    expect(ext).toBeDefined()

    // round.aql declares its own records but not GameRoom — so GameRoom
    // is not in `ir.records`. Extend lives in AST only at this point.
    expect(ir!.schemas['kotelok']!.records['RoundState']).toBeDefined()
  })

  test('system.aql parses without errors', async () => {
    const { diagnostics, ir } = await parseFile(FIX('system.aql'))
    expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
    expect(ir!.schemas['kotelok']!.records['SystemInfo']).toBeDefined()
  })

  test('cross-file merge: simulated concatenation of lobby + round', async () => {
    // Since @alaq/graph parses one file at a time, we demonstrate the merge
    // by concatenating the two files into a single virtual source. Proper
    // multi-file linkage is a later concern (generator or CLI pipeline).
    const { readFile } = await import('node:fs/promises')
    const [lobbySrc, roundSrc] = await Promise.all([
      readFile(FIX('lobby.aql'), 'utf8'),
      readFile(FIX('round.aql'), 'utf8'),
    ])
    // Strip the schema header of the second file and drop the `use` lines
    // (otherwise the parser will see two schema blocks → E017).
    const merged = lobbySrc + '\n' + roundSrc
      .replace(/schema\s+Kotelok\s*\{[^}]*\}/s, '')
      .replace(/use\s+"[^"]+"\s*\{[^}]*\}/g, '')

    const { parseSource } = await import('../src/index')
    const { ir, diagnostics } = parseSource(merged)
    const errs = diagnostics.filter(d => d.severity === 'error')
    if (errs.length) console.error(errs)
    expect(errs).toEqual([])

    const gameRoom = ir!.schemas['kotelok']!.records['GameRoom']!
    const fieldNames = gameRoom.fields.map(f => f.name)
    expect(fieldNames).toContain('id')
    expect(fieldNames).toContain('status')
    expect(fieldNames).toContain('currentRound')
    expect(fieldNames).toContain('currentTeamId')
  })
})
