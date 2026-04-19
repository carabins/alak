import type { Codec, WireMessage } from './types'
import { Op, MsgFlag, ServerMsg } from './types'

// ── JSON Codec (fallback, debug, handshake) ────────────────────────

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const jsonCodec: Codec = {
  id: 0,
  name: 'json',
  encode(value: any): Uint8Array {
    return encoder.encode(JSON.stringify(value))
  },
  decode(data: Uint8Array): any {
    return JSON.parse(decoder.decode(data))
  },
}

// ── MessagePack Codec (default, hot path) ──────────────────────────
//
// msgpackr is an optional runtime dependency. It MUST NOT be imported
// statically — Vite/rollup would treat it as a bundle-time requirement
// for every consumer, breaking JSON-only / browser-only setups.
//
// Strategy: keep the module name behind an indirection so the bundler
// does not resolve it, and resolve at first use. If msgpackr is absent,
// consumers fall back to jsonCodec via getDefaultCodec().

let _msgpack: { pack: (v: any) => Uint8Array; unpack: (d: Uint8Array) => any } | null = null
let _msgpackAttempted = false

function loadMsgpackSync() {
  if (_msgpackAttempted) return _msgpack
  _msgpackAttempted = true
  try {
    // Indirection via variable + globalThis.require keeps the import invisible
    // to static analyzers (Vite, rollup). In Node/Bun runtimes require exists
    // on module globals; in browsers this branch is simply skipped.
    const req: any = (globalThis as any).require
    if (typeof req === 'function') {
      const name = 'msgpackr'
      const mod = req(name)
      if (mod && typeof mod.pack === 'function' && typeof mod.unpack === 'function') {
        _msgpack = { pack: mod.pack, unpack: mod.unpack }
      }
    }
  } catch {
    // msgpackr not installed — fine, jsonCodec will be used
  }
  return _msgpack
}

function getMsgpack() {
  const m = loadMsgpackSync()
  if (!m) {
    throw new Error('@alaq/link: msgpackr is required for binary codec. Run: bun add msgpackr')
  }
  return m
}

export const msgpackCodec: Codec = {
  id: 1,
  name: 'msgpack',
  encode(value: any): Uint8Array {
    return getMsgpack().pack(value)
  },
  decode(data: Uint8Array): any {
    return getMsgpack().unpack(data)
  },
}

// ── Wire Message Encoding ──────────────────────────────────────────

/**
 * Encode a high-level message type + payload into a single Uint8Array.
 * Format: [msgType: u8] [payload: msgpack bytes]
 *
 * Simple and fast. msgType is ServerMsg enum.
 */
export function encodeMessage(msgType: ServerMsg, payload: any, codec: Codec = msgpackCodec): Uint8Array {
  const body = codec.encode(payload)
  const result = new Uint8Array(1 + body.length)
  result[0] = msgType
  result.set(body, 1)
  return result
}

export function decodeMessage(data: Uint8Array, codec: Codec = msgpackCodec): { type: ServerMsg; payload: any } {
  const type = data[0] as ServerMsg
  const payload = codec.decode(data.subarray(1))
  return { type, payload }
}

// ── Default codec selection ────────────────────────────────────────

export function getDefaultCodec(): Codec {
  try {
    getMsgpack()
    return msgpackCodec
  } catch {
    return jsonCodec
  }
}
