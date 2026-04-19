import { test, expect, describe } from 'bun:test'
import { runServer, type ServerIO } from '../src/server'

function makeMockIO(inputs: string[]): { io: ServerIO; output: string[] } {
  const queue = [...inputs]
  const output: string[] = []
  const io: ServerIO = {
    readLine: async () => (queue.length > 0 ? queue.shift()! : null),
    write: line => {
      output.push(line)
    },
  }
  return { io, output }
}

describe('mcp server protocol', () => {
  test('initialize → returns serverInfo and capabilities', async () => {
    const { io, output } = makeMockIO([
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    ])
    await runServer(io)
    const res = JSON.parse(output[0])
    expect(res.id).toBe(1)
    expect(res.result.serverInfo.name).toBe('@alaq/mcp')
    expect(res.result.capabilities.tools).toBeDefined()
  })

  const initReq = JSON.stringify({
    jsonrpc: '2.0',
    id: 0,
    method: 'initialize',
    params: {},
  })

  test('tools/list → returns 2 tools after initialize', async () => {
    const { io, output } = makeMockIO([
      initReq,
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    ])
    await runServer(io)
    const res = JSON.parse(output[1])
    const names = res.result.tools.map((t: any) => t.name).sort()
    expect(names).toEqual(['schema_compile', 'schema_diff'])
  })

  test('tools/list before initialize → JSON-RPC -32002', async () => {
    const { io, output } = makeMockIO([
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    ])
    await runServer(io)
    const res = JSON.parse(output[0])
    expect(res.error.code).toBe(-32002)
    expect(res.error.message).toMatch(/not initialized/)
  })

  test('tools/call before initialize → JSON-RPC -32002', async () => {
    const { io, output } = makeMockIO([
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'schema_compile', arguments: { inputs: [] } },
      }),
    ])
    await runServer(io)
    const res = JSON.parse(output[0])
    expect(res.error.code).toBe(-32002)
  })

  test('tools/call schema_compile → returns content array with parseable JSON', async () => {
    const call = {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'schema_compile',
        arguments: {
          inputs: [
            {
              path: 't.aql',
              source: 'schema S { version: 1, namespace: "s" }\nrecord A { id: ID! }',
            },
          ],
        },
      },
    }
    const { io, output } = makeMockIO([initReq, JSON.stringify(call)])
    await runServer(io)
    const res = JSON.parse(output[1])
    expect(res.id).toBe(7)
    expect(res.result.content[0].type).toBe('text')
    const payload = JSON.parse(res.result.content[0].text)
    expect(payload.ok).toBe(true)
    expect(payload.ir).not.toBeNull()
  })

  test('tools/call schema_diff → returns breaking/non_breaking summary', async () => {
    const before = 'schema S { version: 1, namespace: "s" }\nrecord A { id: ID!, name: String! }'
    const after = 'schema S { version: 1, namespace: "s" }\nrecord A { id: ID! }'
    const { io, output } = makeMockIO([
      initReq,
      JSON.stringify({
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'schema_diff',
          arguments: {
            before: [{ path: 't.aql', source: before }],
            after: [{ path: 't.aql', source: after }],
          },
        },
      }),
    ])
    await runServer(io)
    const payload = JSON.parse(JSON.parse(output[1]).result.content[0].text)
    expect(payload.ok).toBe(true)
    expect(payload.report.summary.breaking).toBe(1)
  })

  test('unknown tool → JSON-RPC error', async () => {
    const { io, output } = makeMockIO([
      initReq,
      JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'nope', arguments: {} },
      }),
    ])
    await runServer(io)
    const res = JSON.parse(output[1])
    expect(res.error.code).toBe(-32601)
    expect(res.error.message).toMatch(/unknown tool/)
  })

  test('parse error in input → JSON-RPC parse error response', async () => {
    const { io, output } = makeMockIO(['{not json'])
    await runServer(io)
    const res = JSON.parse(output[0])
    expect(res.error.code).toBe(-32700)
  })

  test('notifications/initialized produces no response', async () => {
    const { io, output } = makeMockIO([
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    ])
    await runServer(io)
    expect(output).toHaveLength(0)
  })
})
