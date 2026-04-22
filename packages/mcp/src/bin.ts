#!/usr/bin/env bun
// Entry point for `alaq-mcp`. Reads JSON-RPC frames from stdin, writes to stdout.
// One JSON object per line (newline-delimited). Stderr is for human logs only.

import { runServer, type ServerIO } from './server'

function makeStdinIO(): ServerIO {
  let buffer = ''
  let resolveCurrent: ((line: string | null) => void) | null = null
  const queue: string[] = []
  let ended = false

  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk
    let nl: number
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      if (resolveCurrent) {
        const r = resolveCurrent
        resolveCurrent = null
        r(line)
      } else {
        queue.push(line)
      }
    }
  })
  process.stdin.on('end', () => {
    ended = true
    if (resolveCurrent) {
      const r = resolveCurrent
      resolveCurrent = null
      r(null)
    }
  })

  return {
    readLine: () =>
      new Promise<string | null>(resolve => {
        if (queue.length > 0) {
          resolve(queue.shift()!)
          return
        }
        if (ended) {
          resolve(null)
          return
        }
        resolveCurrent = resolve
      }),
    write: (line: string) => {
      process.stdout.write(line + '\n')
    },
  }
}

// Wrapped in IIFE: top-level await breaks rolldown's CJS output bundling.
void (async () => {
  await runServer(makeStdinIO())
})()
