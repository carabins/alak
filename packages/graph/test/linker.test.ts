import { test, expect, describe } from 'bun:test'
import { compileSources, parseSource, type MultiFileInput } from '../src/index'

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

const errs = (ds: Array<{ severity: string }>) => ds.filter(d => d.severity === 'error')
const codes = (ds: Array<{ code: string }>) => ds.map(d => d.code)

function src(files: Record<string, string>): MultiFileInput[] {
  return Object.entries(files).map(([path, source]) => ({ path, source }))
}

describe('linker: basic cases', () => {
  test('1. single file → one-file link has same records as parseSource', () => {
    const source = `
      schema S { version: 1, namespace: "s" }
      record R { id: ID! name: String! }
    `
    const parsed = parseSource(source, 'only.aql')
    const res = compileSources([{ path: 'only.aql', source }])
    expect(errs(res.diagnostics)).toEqual([])
    // Same records under the same namespace.
    expect(Object.keys(res.ir!.schemas['s']!.records))
      .toEqual(Object.keys(parsed.ir!.schemas['s']!.records))
    expect(res.ir!.schemas['s']!.records['R']!.fields.map(f => f.name))
      .toEqual(parsed.ir!.schemas['s']!.records['R']!.fields.map(f => f.name))
  })

  test('2. two files, same namespace, no conflicts → merged IR contains both records', () => {
    const res = compileSources(src({
      'a.aql': `schema S { version: 1, namespace: "s" }
                record A { id: ID! }`,
      'b.aql': `schema S { version: 1, namespace: "s" }
                record B { id: ID! }`,
    }))
    expect(errs(res.diagnostics)).toEqual([])
    const ns = res.ir!.schemas['s']!
    expect(ns.records['A']).toBeDefined()
    expect(ns.records['B']).toBeDefined()
    expect(ns.sourceFiles).toEqual(['a.aql', 'b.aql'])
  })
})

describe('linker: E007 namespace/schema-name collision', () => {
  test('3. two schemas same NAME but different namespaces → E007', () => {
    const res = compileSources(src({
      'a.aql': `schema X { version: 1, namespace: "one" }
                record R { id: ID! }`,
      'b.aql': `schema X { version: 1, namespace: "two" }
                record Q { id: ID! }`,
    }))
    expect(codes(res.diagnostics)).toContain('E007')
  })

  test('3b. two schemas same name + same namespace in different files → NOT E007', () => {
    const res = compileSources(src({
      'a.aql': `schema Kotelok { version: 1, namespace: "kotelok" }
                record A { id: ID! }`,
      'b.aql': `schema Kotelok { version: 1, namespace: "kotelok" }
                record B { id: ID! }`,
    }))
    expect(codes(res.diagnostics)).not.toContain('E007')
    expect(errs(res.diagnostics)).toEqual([])
  })
})

describe('linker: E008 `use` path resolution', () => {
  test('4. use "./missing" → E008 file not found', () => {
    const res = compileSources(src({
      'main.aql': `schema S { version: 1, namespace: "s" }
                   use "./missing" { Foo }
                   record R { id: ID! }`,
    }))
    expect(codes(res.diagnostics)).toContain('E008')
  })

  test('5. use "./players" resolves to "./players.aql" automatically', () => {
    const res = compileSources(src({
      'players.aql': `schema S { version: 1, namespace: "s" }
                      record Player { id: ID! }`,
      'lobby.aql': `schema S { version: 1, namespace: "s" }
                    use "./players" { Player }
                    record Room { p: Player! }`,
    }))
    expect(codes(res.diagnostics)).not.toContain('E008')
    expect(errs(res.diagnostics)).toEqual([])
  })

  test('6. relative path up: use "../core/identity"', () => {
    const res = compileSources(src({
      'core/identity.aql': `schema Id { version: 1, namespace: "core.identity" }
                            scalar UUID`,
      'app/main.aql': `schema S { version: 1, namespace: "s" }
                       use "../core/identity" { UUID }
                       record R { id: UUID! }`,
    }))
    expect(codes(res.diagnostics)).not.toContain('E008')
    expect(errs(res.diagnostics)).toEqual([])
  })
})

describe('linker: E021 use-of-undeclared-name', () => {
  test('7. use "./x" { NonExistent } → E021', () => {
    const res = compileSources(src({
      'x.aql': `schema S { version: 1, namespace: "s" }
                record Real { id: ID! }`,
      'main.aql': `schema S { version: 1, namespace: "s" }
                   use "./x" { NonExistent }
                   record R { id: ID! }`,
    }))
    expect(codes(res.diagnostics)).toContain('E021')
    const e21 = res.diagnostics.find(d => d.code === 'E021')!
    expect(e21.message).toContain('NonExistent')
    expect(e21.message).toContain('./x')
  })
})

describe('linker: cross-file extend', () => {
  test('8. round.aql extends GameRoom from lobby.aql — merged IR has combined fields', () => {
    const res = compileSources(src({
      'lobby.aql': `schema S { version: 1, namespace: "s" }
                    record GameRoom { id: ID!, status: String! }`,
      'round.aql': `schema S { version: 1, namespace: "s" }
                    use "./lobby" { GameRoom }
                    extend record GameRoom {
                      currentRound: Int
                      currentTeamId: ID
                    }`,
    }))
    expect(errs(res.diagnostics)).toEqual([])
    const gr = res.ir!.schemas['s']!.records['GameRoom']!
    const names = gr.fields.map(f => f.name)
    expect(names).toEqual(['id', 'status', 'currentRound', 'currentTeamId'])
  })

  test('9. E010: cross-file extend duplicates a field', () => {
    const res = compileSources(src({
      'a.aql': `schema S { version: 1, namespace: "s" }
                record R { id: ID! }`,
      'b.aql': `schema S { version: 1, namespace: "s" }
                extend record R { id: String! }`,
    }))
    expect(codes(res.diagnostics)).toContain('E010')
  })

  test('10. E011: extend targets a type that does not exist anywhere', () => {
    const res = compileSources(src({
      'a.aql': `schema S { version: 1, namespace: "s" }
                record X { id: ID! }`,
      'b.aql': `schema S { version: 1, namespace: "s" }
                extend record NotReal { foo: Int! }`,
    }))
    expect(codes(res.diagnostics)).toContain('E011')
  })
})

describe('linker: E014 cycle detection', () => {
  test('11. E014: record A { b: B! } + record B { a: A! } without LAZY', () => {
    const res = compileSources(src({
      'a.aql': `schema S { version: 1, namespace: "s" }
                record A { b: B! }
                record B { a: A! }`,
    }))
    expect(codes(res.diagnostics)).toContain('E014')
  })

  test('12. no E014: same cycle with @sync(mode: LAZY) on one edge', () => {
    const res = compileSources(src({
      'a.aql': `schema S { version: 1, namespace: "s" }
                record A { b: B! @sync(mode: LAZY) }
                record B { a: A! }`,
    }))
    expect(codes(res.diagnostics)).not.toContain('E014')
  })

  test('12b. no false E014 for a DAG', () => {
    const res = compileSources(src({
      'a.aql': `schema S { version: 1, namespace: "s" }
                record A { b: B! }
                record B { c: C! }
                record C { id: ID! }`,
    }))
    expect(codes(res.diagnostics)).not.toContain('E014')
  })

  test('12c. self-loop without LAZY → E014', () => {
    const res = compileSources(src({
      'a.aql': `schema S { version: 1, namespace: "s" }
                record Node { next: Node }`,
    }))
    expect(codes(res.diagnostics)).toContain('E014')
  })

  test('12d. self-loop with LAZY → no E014', () => {
    const res = compileSources(src({
      'a.aql': `schema S { version: 1, namespace: "s" }
                record Node { next: Node @sync(mode: LAZY) }`,
    }))
    expect(codes(res.diagnostics)).not.toContain('E014')
  })

  test('12e. three-record cycle across files with LAZY break', () => {
    const res = compileSources(src({
      'a.aql': `schema S { version: 1, namespace: "s" }
                record A { b: B! }`,
      'b.aql': `schema S { version: 1, namespace: "s" }
                record B { c: C! }`,
      'c.aql': `schema S { version: 1, namespace: "s" }
                record C { a: A! @sync(mode: LAZY) }`,
    }))
    expect(codes(res.diagnostics)).not.toContain('E014')
  })
})

describe('linker: kotelok fixtures', () => {
  // Inline copies of the kotelok fixtures — used so compileSources is tested
  // in a pure-function way. The filesystem variant lives in compile-files.test.ts.
  const KOT = {
    'kotelok/identity.aql': `
      schema Identity {
        version: 1
        namespace: "core.identity"
      }
      scalar UUID
      scalar DeviceID
    `,
    'kotelok/players.aql': `
      schema Kotelok { version: 1, namespace: "kotelok" }
      record Player {
        id: ID!
        name: String!
        avatar: String
        myWords: [String!]! @auth(read: "owner")
      }
      record Team {
        id: ID!
        name: String!
        score: Int! @default(value: 0)
        memberIds: [ID!]!
      }
    `,
    'kotelok/lobby.aql': `
      schema Kotelok { version: 1, namespace: "kotelok" }
      use "./players" { Player, Team }
      enum RoomStatus { LOBBY, GAME_ACTIVE, FINISHED }
      record GameSettings {
        wordsPerPlayer: Int! @default(value: 10) @range(min: 1, max: 100)
        roundTime: Int! @default(value: 60) @range(min: 10, max: 600)
      }
      record WordSubmission {
        playerId: ID!
        count: Int!
        isDone: Boolean!
      }
      record GameRoom @scope(name: "room") @sync(qos: RELIABLE) {
        id: ID!
        status: RoomStatus! @default(value: LOBBY)
        settings: GameSettings!
        players: [Player!]!
        teams: [Team!]!
        wordSubmissions: [WordSubmission!]!
        totalWordsCount: Int!
      }
      action CreateRoom { input: { settings: GameSettings } output: ID! }
      action JoinRoom { scope: "room" input: { name: String! } output: Player! }
    `,
    'kotelok/round.aql': `
      schema Kotelok { version: 1, namespace: "kotelok" }
      use "./lobby" { GameRoom }
      enum RoundPhase { PREPARE, ACTIVE, REVIEW }
      record RoundStats {
        guessed: [String!]!
        skipped: [String!]!
      }
      record RoundState {
        phase: RoundPhase!
        activePlayerId: ID!
        timeLeft: Int! @sync(qos: REALTIME) @atomic
        stats: RoundStats!
      }
      extend record GameRoom {
        currentRound: RoundState
        currentTeamId: ID
      }
    `,
    'kotelok/system.aql': `
      schema Kotelok { version: 1, namespace: "kotelok" }
      record SystemInfo @sync(qos: REALTIME) @atomic {
        online: Int!
        ping: Int!
      }
    `,
  }

  test('13. all 5 kotelok files link cleanly', () => {
    const res = compileSources(src(KOT))
    const errors = errs(res.diagnostics)
    if (errors.length) console.error('kotelok errors:', errors)
    expect(errors).toEqual([])
    expect(res.ir!.schemas['kotelok']).toBeDefined()
    expect(res.ir!.schemas['core.identity']).toBeDefined()
  })

  test('14. kotelok GameRoom has fields from lobby AND round', () => {
    const res = compileSources(src(KOT))
    const gr = res.ir!.schemas['kotelok']!.records['GameRoom']!
    const names = gr.fields.map(f => f.name)
    // lobby side
    expect(names).toContain('id')
    expect(names).toContain('status')
    expect(names).toContain('settings')
    // round side
    expect(names).toContain('currentRound')
    expect(names).toContain('currentTeamId')
  })

  test('14b. kotelok namespace aggregates records from 4 files', () => {
    const res = compileSources(src(KOT))
    const ns = res.ir!.schemas['kotelok']!
    expect(ns.records['Player']).toBeDefined()
    expect(ns.records['Team']).toBeDefined()
    expect(ns.records['GameRoom']).toBeDefined()
    expect(ns.records['RoundState']).toBeDefined()
    expect(ns.records['SystemInfo']).toBeDefined()
    expect(ns.enums['RoomStatus']).toBeDefined()
    expect(ns.enums['RoundPhase']).toBeDefined()
  })
})

describe('linker: orthogonal', () => {
  test('15. compileSources vs compileFiles have equal results (simulated)', async () => {
    // compileFiles is just compileSources after FS read. We validate that
    // two compileSources calls with identical inputs are identical.
    const inputs = src({
      'a.aql': `schema S { version: 1, namespace: "s" } record A { id: ID! }`,
      'b.aql': `schema S { version: 1, namespace: "s" } record B { id: ID! }`,
    })
    const r1 = compileSources(inputs)
    const r2 = compileSources(inputs)
    expect(JSON.stringify(r1.ir)).toBe(JSON.stringify(r2.ir))
    expect(r1.diagnostics.length).toBe(r2.diagnostics.length)
  })

  test('16. use with no imports list still resolves path (empty braces)', () => {
    // Edge case: `use "./x" { }` — still must resolve path to avoid E008
    const res = compileSources(src({
      'x.aql': `schema S { version: 1, namespace: "s" } record X { id: ID! }`,
      'main.aql': `schema S { version: 1, namespace: "s" } use "./x" { } record R { id: ID! }`,
    }))
    expect(codes(res.diagnostics)).not.toContain('E008')
    expect(codes(res.diagnostics)).not.toContain('E021')
  })

  test('17. two schema blocks in one file → existing E017 still fires, link does not crash', () => {
    const res = compileSources(src({
      'bad.aql': `schema S { version: 1, namespace: "s" }
                  schema T { version: 1, namespace: "t" }
                  record R { id: ID! }`,
    }))
    expect(codes(res.diagnostics)).toContain('E017')
    // linker should still complete and produce an IR (best effort)
    expect(res.ir).toBeDefined()
  })

  test('18. empty file list → null IR, no diagnostics', () => {
    const res = compileSources([])
    expect(res.ir).toBeNull()
    expect(res.diagnostics).toEqual([])
    expect(res.files).toEqual({})
  })

  test('19. use resolves type from imported file; consumer record is valid', () => {
    const res = compileSources(src({
      'a.aql': `schema S { version: 1, namespace: "s" } scalar UUID`,
      'b.aql': `schema S { version: 1, namespace: "s" }
                use "./a" { UUID }
                record User { id: UUID! }`,
    }))
    expect(errs(res.diagnostics)).toEqual([])
    expect(res.ir!.schemas['s']!.records['User']!.fields[0]!.type).toBe('UUID')
  })

  test('20. per-file IR map preserves filenames', () => {
    const res = compileSources(src({
      'x.aql': `schema S { version: 1, namespace: "s" } record X { id: ID! }`,
      'y.aql': `schema S { version: 1, namespace: "s" } record Y { id: ID! }`,
    }))
    expect(Object.keys(res.files).sort()).toEqual(['x.aql', 'y.aql'])
    expect(res.files['x.aql']).not.toBeNull()
    expect(res.files['y.aql']).not.toBeNull()
  })
})
