// @alaq/graph-link-server — dispatcher behaviour tests.
//
// Strategy: generate the dispatcher source from a hand-shaped IR, write it
// to a temp file, `import()` it dynamically and drive it with fake
// handlers. This exercises the *runtime* behaviour of the generated code
// (routing, scope extraction, error handling) instead of just substring-
// matching the emitted text.

import { test, expect, describe, beforeAll } from 'bun:test'
import { generate } from '../src/index'
import type { IR } from '../../graph/src/types'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const TMP_DIR = join(import.meta.dir, '..', '.tmp-dispatcher')

function buildIR(): IR {
  return {
    schemas: {
      test: {
        name: 'Test',
        namespace: 'test',
        version: 1,
        records: {
          Player: {
            name: 'Player',
            fields: [
              { name: 'id', type: 'ID', required: true, list: false },
              { name: 'name', type: 'String', required: true, list: false },
            ],
          },
        },
        actions: {
          CreateRoom: {
            name: 'CreateRoom',
            input: [{ name: 'name', type: 'String', required: true, list: false }],
            output: 'ID',
            outputRequired: true,
          },
          JoinRoom: {
            name: 'JoinRoom',
            scope: 'room',
            input: [{ name: 'name', type: 'String', required: true, list: false }],
            output: 'Player',
            outputRequired: true,
          },
          LeaveRoom: {
            name: 'LeaveRoom',
            scope: 'room',
          },
          Ping: {
            name: 'Ping',
          },
        },
        enums: {},
        scalars: {},
        opaques: {},
      },
    },
  }
}

type Dispatcher = (
  action: string,
  path: string,
  args: unknown,
  peerId: string,
) => Promise<unknown>

let createActionDispatcher: (opts: any) => Dispatcher

beforeAll(async () => {
  const res = generate(buildIR())
  const file = res.files[0]
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })
  const outPath = join(TMP_DIR, file.path)
  writeFileSync(outPath, file.content)

  // Dynamic import — Bun supports .ts directly.
  const mod = await import(outPath)
  createActionDispatcher = mod.createActionDispatcher
})

function baseCtx() {
  const broadcasts: any[] = []
  const sends: any[] = []
  return {
    ctx: {
      broadcastToRoom(roomId: string, type: number, payload: unknown, excludeSelf?: boolean) {
        broadcasts.push({ roomId, type, payload, excludeSelf: !!excludeSelf })
      },
      sendTo(peerId: string, type: number, payload: unknown) {
        sends.push({ peerId, type, payload })
      },
      peers() { return [] },
    },
    broadcasts,
    sends,
  }
}

describe('dispatcher — routing', () => {
  test('routes unscoped action with input', async () => {
    const received: any[] = []
    const handlers = {
      createRoom: (ctx: any, input: any) => {
        received.push({ ctx, input })
        return 'room-42'
      },
      joinRoom: () => { throw new Error('wrong') },
      leaveRoom: () => { throw new Error('wrong') },
      ping: () => { throw new Error('wrong') },
    }
    const dispatch = createActionDispatcher({ handlers, ctx: baseCtx().ctx })
    const result = await dispatch('CreateRoom', '', { name: 'Hello' }, 'peer-1')
    expect(result).toBe('room-42')
    expect(received).toHaveLength(1)
    expect(received[0].input).toEqual({ name: 'Hello' })
    expect(received[0].ctx.peerId).toBe('peer-1')
  })

  test('routes scoped action, extracts room id from path', async () => {
    const received: any[] = []
    const handlers = {
      createRoom: () => { throw new Error('wrong') },
      joinRoom: (ctx: any, roomId: string, input: any) => {
        received.push({ ctx, roomId, input })
        return { id: 'p1', name: input.name }
      },
      leaveRoom: () => { throw new Error('wrong') },
      ping: () => { throw new Error('wrong') },
    }
    const dispatch = createActionDispatcher({ handlers, ctx: baseCtx().ctx })
    const result = await dispatch('JoinRoom', 'room.abc-123', { name: 'Bob' }, 'peer-2')
    expect(result).toEqual({ id: 'p1', name: 'Bob' })
    expect(received[0].roomId).toBe('abc-123')
    expect(received[0].ctx.peerId).toBe('peer-2')
  })

  test('routes scoped action with no input', async () => {
    const received: any[] = []
    const handlers = {
      createRoom: () => { throw new Error('wrong') },
      joinRoom: () => { throw new Error('wrong') },
      leaveRoom: (ctx: any, roomId: string) => {
        received.push({ ctx, roomId })
      },
      ping: () => { throw new Error('wrong') },
    }
    const dispatch = createActionDispatcher({ handlers, ctx: baseCtx().ctx })
    const result = await dispatch('LeaveRoom', 'room.xyz', undefined, 'peer-3')
    expect(result).toBeUndefined()
    expect(received[0].roomId).toBe('xyz')
  })

  test('routes unscoped action with no input', async () => {
    let called = false
    const handlers = {
      createRoom: () => { throw new Error('wrong') },
      joinRoom: () => { throw new Error('wrong') },
      leaveRoom: () => { throw new Error('wrong') },
      ping: () => { called = true },
    }
    const dispatch = createActionDispatcher({ handlers, ctx: baseCtx().ctx })
    await dispatch('Ping', '', undefined, 'peer-4')
    expect(called).toBe(true)
  })

  test('awaits async handler (fixes Promise-leak symptom of FINDING 6.2)', async () => {
    const handlers = {
      createRoom: async (_ctx: any, input: any) => {
        await new Promise(r => setTimeout(r, 5))
        return `async-${input.name}`
      },
      joinRoom: () => { throw new Error('wrong') },
      leaveRoom: () => { throw new Error('wrong') },
      ping: () => { throw new Error('wrong') },
    }
    const dispatch = createActionDispatcher({ handlers, ctx: baseCtx().ctx })
    const result = await dispatch('CreateRoom', '', { name: 'X' }, 'peer-5')
    expect(result).toBe('async-X')
  })
})

describe('dispatcher — path extraction', () => {
  test('scope id survives hyphens and dots in the id', async () => {
    const received: any[] = []
    const handlers = {
      createRoom: () => undefined,
      joinRoom: (_: any, roomId: string) => {
        received.push(roomId)
        return { id: '', name: '' }
      },
      leaveRoom: () => undefined,
      ping: () => undefined,
    }
    const dispatch = createActionDispatcher({ handlers, ctx: baseCtx().ctx })
    await dispatch('JoinRoom', 'room.room-with-dots.v2', { name: 'A' }, 'p')
    expect(received[0]).toBe('room-with-dots.v2')
  })

  test('path without expected prefix falls through unchanged', async () => {
    const received: any[] = []
    const handlers = {
      createRoom: () => undefined,
      joinRoom: () => { throw new Error('wrong') },
      leaveRoom: (_: any, roomId: string) => {
        received.push(roomId)
      },
      ping: () => undefined,
    }
    const dispatch = createActionDispatcher({ handlers, ctx: baseCtx().ctx })
    await dispatch('LeaveRoom', 'not-a-room-path', undefined, 'p')
    expect(received[0]).toBe('not-a-room-path')
  })
})

describe('dispatcher — error surface', () => {
  test('unknown action throws by default', async () => {
    const handlers = {
      createRoom: () => undefined,
      joinRoom: () => undefined,
      leaveRoom: () => undefined,
      ping: () => undefined,
    }
    const dispatch = createActionDispatcher({ handlers, ctx: baseCtx().ctx })
    await expect(dispatch('Unknown', '', {}, 'p')).rejects.toThrow(/unknown action/i)
  })

  test('onUnknownAction hook intercepts dispatch', async () => {
    let seen: { action: string; path: string } | null = null
    const handlers = {
      createRoom: () => undefined,
      joinRoom: () => undefined,
      leaveRoom: () => undefined,
      ping: () => undefined,
    }
    const dispatch = createActionDispatcher({
      handlers,
      ctx: baseCtx().ctx,
      onUnknownAction: (a: string, p: string) => { seen = { action: a, path: p }; return 'caught' },
    })
    const result = await dispatch('Mystery', 'some/path', {}, 'p')
    expect(result).toBe('caught')
    expect(seen).toEqual({ action: 'Mystery', path: 'some/path' })
  })

  test('handler errors rethrow by default', async () => {
    const handlers = {
      createRoom: () => { throw new Error('boom') },
      joinRoom: () => undefined,
      leaveRoom: () => undefined,
      ping: () => undefined,
    }
    const dispatch = createActionDispatcher({ handlers, ctx: baseCtx().ctx })
    await expect(dispatch('CreateRoom', '', { name: '' }, 'p')).rejects.toThrow('boom')
  })

  test('onError hook intercepts handler errors', async () => {
    let captured: { action: string; err: unknown } | null = null
    const handlers = {
      createRoom: () => { throw new Error('boom') },
      joinRoom: () => undefined,
      leaveRoom: () => undefined,
      ping: () => undefined,
    }
    const dispatch = createActionDispatcher({
      handlers,
      ctx: baseCtx().ctx,
      onError: (action: string, err: unknown) => {
        captured = { action, err }
        return { ok: false }
      },
    })
    const result = await dispatch('CreateRoom', '', { name: '' }, 'p')
    expect(result).toEqual({ ok: false })
    expect(captured).toBeTruthy()
    expect(captured!.action).toBe('CreateRoom')
    expect((captured!.err as Error).message).toBe('boom')
  })
})
