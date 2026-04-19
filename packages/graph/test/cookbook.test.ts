import { test, expect, describe } from 'bun:test'
import { parseSource } from '../src/index'

// §8 Cookbook: each sample wrapped with a minimal schema header should parse
// without errors. The wrap() helper also declares the referenced user types
// needed by samples (e.g. Player, GameSettings, RoundState) so we can
// validate these patterns in isolation without pulling the whole Kotelok
// file set.

const base = 'schema Test { version: 1, namespace: "t" }\n'

const prelude = `
enum RoundPhase { PREPARE, ACTIVE, REVIEW }
enum RoomStatus { LOBBY, GAME_ACTIVE, FINISHED }
record GameSettings {
  wordsPerPlayer: Int!
  roundTime: Int!
}
record Player {
  id: ID!
  name: String!
}
record RoundState {
  phase: RoundPhase!
}
scalar UUID
scalar DeviceID
`

const wrap = (body: string, withPrelude = true) =>
  base + (withPrelude ? prelude : '') + body

const expectOk = (src: string) => {
  const { diagnostics } = parseSource(src)
  const errors = diagnostics.filter(d => d.severity === 'error')
  if (errors.length) {
    // eslint-disable-next-line no-console
    console.error('Unexpected errors:', errors)
  }
  expect(errors).toEqual([])
}

describe('§8 cookbook', () => {
  test('cookbook.8.1 — fields on a record', () => {
    expectOk(base + `
      record P {
        id: ID!
        name: String!
        avatar: String
        myWords: [String!]!
      }`)
  })

  test('cookbook.8.2 — optional with default', () => {
    expectOk(base + `
      record GameSettings {
        wordsPerPlayer: Int! @default(value: 10)
        roundTime: Int! @default(value: 60)
      }`)
  })

  test('cookbook.8.3 — @auth(read: "owner")', () => {
    expectOk(base + `
      record Player {
        id: ID!
        myWords: [String!]! @auth(read: "owner")
      }`)
  })

  test('cookbook.8.4 — scoped record', () => {
    expectOk(base + `
      record Player { id: ID! name: String! }
      record GameRoom @scope(name: "room") @sync(qos: RELIABLE) {
        id: ID!
        status: String!
        players: [Player!]!
      }`)
  })

  test('cookbook.8.5 — REALTIME on scalar field', () => {
    expectOk(base + `
      enum RoundPhase { PREPARE, ACTIVE, REVIEW }
      record RoundState {
        phase: RoundPhase!
        timeLeft: Int! @sync(qos: REALTIME)
      }`)
  })

  test('cookbook.8.6 — CRDT record', () => {
    expectOk(base + `
      record Message @crdt(type: LWW_MAP, key: "updated_at") {
        id: ID!
        author: ID!
        text: String!
        updated_at: Timestamp!
      }`)
  })

  test('cookbook.8.7 — atomic blob', () => {
    expectOk(base + `
      record KalmanBlock @atomic {
        matrix: [[Float!]!]!
        bias: [Float!]!
      }`)
  })

  test('cookbook.8.8 — RPC-style action', () => {
    expectOk(base + `
      record GameSettings { wordsPerPlayer: Int! roundTime: Int! }
      action CreateRoom {
        input: { settings: GameSettings }
        output: ID!
      }`)
  })

  test('cookbook.8.9 — fire-forget action', () => {
    expectOk(base + `
      record R @scope(name: "room") { id: ID! }
      action StartGame {
        scope: "room"
      }`)
  })

  test('cookbook.8.10 — scope-bound action', () => {
    expectOk(base + `
      record Player { id: ID! name: String! }
      record R @scope(name: "room") { id: ID! }
      action JoinRoom {
        scope: "room"
        input: { name: String! }
        output: Player!
      }`)
  })

  test('cookbook.8.11 — extend record', () => {
    expectOk(base + `
      record GameRoom { id: ID! }
      record RoundState { phase: String! }
      extend record GameRoom {
        currentRound: RoundState
        currentTeamId: ID
      }`)
  })

  test('cookbook.8.12 — opaque stream', () => {
    expectOk(base + `
      opaque stream AudioFrames {
        qos: best_effort_push
        max_size: 8192
      }`)
  })

  test('cookbook.8.13 — liveness', () => {
    expectOk(base + `
      record Player @liveness(source: "ws:player", timeout: 5000, on_lost: MARK_ABSENT) {
        id: ID!
        name: String!
      }`)
  })

  test('cookbook.8.14 — bound numeric input', () => {
    expectOk(base + `
      record GameSettings {
        wordsPerPlayer: Int! @default(value: 10) @range(min: 1, max: 100)
      }`)
  })

  test('cookbook.8.15 — use imports', () => {
    expectOk(base + `
      use "core/identity" { UUID, DeviceID }
      use "./round" { RoundState }
    `)
  })

  test('cookbook.8.16 — deprecated field', () => {
    expectOk(base + `
      record Player {
        avatar: String
        avatarUrl: String @deprecated(since: "2", reason: "use avatar")
      }`)
  })
})
