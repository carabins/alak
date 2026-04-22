#!/usr/bin/env bun
// One-shot tool caller: handles the initialize handshake and a single
// tools/call, then exits. Strips the MCP envelope so the output is just
// the tool's payload (parsed JSON). Useful for shell scripts and agents
// that don't want to drive a long-running stdio session.
//
// Usage:
//   alaq-mcp-call <tool_name> <json-args>
//   alaq-mcp-call <tool_name> --args-file path/to/args.json
//   alaq-mcp-call --list
//
// Examples:
//   alaq-mcp-call schema_compile '{"paths":["a.aql"],"rootDir":"./schema"}'
//   alaq-mcp-call --list

import { runServer, type ServerIO } from './server'
import { readFile } from 'node:fs/promises'

interface Capture {
  io: ServerIO
  responses: string[]
  enqueue: (line: string) => void
  close: () => void
}

function makeCapture(initial: string[]): Capture {
  const queue = [...initial]
  const responses: string[] = []
  let resolveCurrent: ((line: string | null) => void) | null = null
  let closed = false
  const enqueue = (line: string) => {
    if (resolveCurrent) {
      const r = resolveCurrent
      resolveCurrent = null
      r(line)
    } else {
      queue.push(line)
    }
  }
  const close = () => {
    closed = true
    if (resolveCurrent) {
      const r = resolveCurrent
      resolveCurrent = null
      r(null)
    }
  }
  const io: ServerIO = {
    readLine: () =>
      new Promise(resolve => {
        if (queue.length > 0) {
          resolve(queue.shift()!)
          return
        }
        if (closed) {
          resolve(null)
          return
        }
        resolveCurrent = resolve
      }),
    write: line => {
      responses.push(line)
      // Drive next step: feed pending requests as responses arrive.
      if (pending.length > 0) {
        const next = pending.shift()!
        enqueue(next)
      } else {
        close()
      }
    },
  }
  return { io, responses, enqueue, close }
}

const pending: string[] = []

function fail(msg: string): never {
  process.stderr.write(`alaq-mcp-call: ${msg}\n`)
  process.exit(2)
}

// Wrapped in IIFE: top-level await breaks rolldown's CJS output bundling.
void (async () => {
  const argv = process.argv.slice(2)
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    process.stderr.write(
      'usage:\n' +
        '  alaq-mcp-call <tool_name> <json-args>\n' +
        '  alaq-mcp-call <tool_name> --args-file <path>\n' +
        '  alaq-mcp-call --list\n',
    )
    process.exit(argv.length === 0 ? 2 : 0)
  }

  const initReq = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })

  let request: string
  if (argv[0] === '--list') {
    request = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
  } else {
    const tool = argv[0]
    let argsJson: string
    if (argv[1] === '--args-file') {
      if (!argv[2]) fail('--args-file requires a path')
      argsJson = await readFile(argv[2], 'utf8')
    } else if (argv[1]) {
      argsJson = argv[1]
    } else {
      fail(`tool "${tool}" requires JSON arguments (or --args-file)`)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(argsJson)
    } catch (e: any) {
      fail(`invalid JSON arguments: ${e?.message ?? e}`)
    }
    request = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: tool, arguments: parsed },
    })
  }

  pending.push(request)
  const cap = makeCapture([initReq])
  await runServer(cap.io)

  let payload: any = null
  let rpcError: any = null
  for (const line of cap.responses) {
    try {
      const r = JSON.parse(line)
      if (r.id === 2) {
        if (r.error) {
          rpcError = r.error
        } else if (argv[0] === '--list') {
          payload = r.result
        } else {
          const text = r.result?.content?.[0]?.text
          payload = text != null ? JSON.parse(text) : r.result
        }
      }
    } catch {}
  }

  if (rpcError) {
    process.stderr.write(`JSON-RPC error ${rpcError.code}: ${rpcError.message}\n`)
    process.exit(1)
  }
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n')
})()
