// Minimal stdio MCP server. Implements just enough of the protocol to expose
// our three tools: initialize, tools/list, tools/call. JSON-RPC 2.0 framing
// follows MCP spec — newline-delimited JSON over stdin/stdout.
//
// Why not @modelcontextprotocol/sdk: zero deps keeps install lightweight and
// matches @alaq/graph's ethos. The protocol surface we need is ~100 lines.

import { schemaCompile, schemaDiff } from './tools'
import {
  alaqCapabilities,
  alaqTrace,
  alaqAtomActivity,
  alaqHotAtoms,
  alaqIdbStores,
  alaqIdbStoreStats,
  alaqIdbErrors,
} from './tools-runtime'

const PROTOCOL_VERSION = '2024-11-05'

interface JsonRpcReq {
  jsonrpc: '2.0'
  id?: number | string | null
  method: string
  params?: any
}

interface JsonRpcRes {
  jsonrpc: '2.0'
  id: number | string | null
  result?: any
  error?: { code: number; message: string; data?: any }
}

const TOOLS = [
  {
    name: 'schema_compile',
    description:
      'Compile .aql sources into IR. Two modes: (a) inline — pass {inputs:[{path,source}]}; (b) filesystem — pass {paths:[...], rootDir} to read files from disk. rootDir sandboxes reads (no .. traversal). Returns merged IR plus structured diagnostics.',
    inputSchema: {
      type: 'object',
      properties: {
        inputs: {
          type: 'array',
          description: 'Inline mode: source text provided directly.',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Logical filename (used in diagnostics).' },
              source: { type: 'string', description: 'Raw .aql text.' },
            },
            required: ['path', 'source'],
          },
        },
        paths: {
          type: 'array',
          description: 'Filesystem mode: file paths to read. Relative paths require rootDir; absolute paths are also accepted.',
          items: { type: 'string' },
        },
        rootDir: {
          type: 'string',
          description: 'Sandbox root for "paths". Refuses any path that resolves outside this directory.',
        },
      },
    },
  },
  {
    name: 'schema_diff',
    description:
      'Compute breaking-change report between two SDL snapshots. Each side accepts either an inline array of {path,source} OR an object {paths,rootDir} for filesystem mode. Sides can mix modes. Each change is classified as breaking | non_breaking | review (review = needs human judgement, e.g. directive change or required→optional relaxation that breaks readers).',
    inputSchema: {
      type: 'object',
      properties: {
        before: {
          description: 'Inline array of {path,source} OR {paths,rootDir}.',
        },
        after: {
          description: 'Inline array of {path,source} OR {paths,rootDir}.',
        },
      },
      required: ['before', 'after'],
    },
  },
  // ── Runtime observation tools (read from self-hosted Logi HTTP API) ────
  {
    name: 'alaq_capabilities',
    description:
      'Self-describing meta-tool. Reads recent Logi activity to report which alaq runtime plugins are active (logi itself, plugin-idb, potentially plugin-tauri). Use at the start of a session to orient yourself in a running app. Detection: any frames → "logi"; messages starting with "idb:" → "idb"; messages starting with "tauri:" → "tauri".',
    inputSchema: {
      type: 'object',
      properties: {
        hours: { type: 'number', description: 'Lookback window in hours. Default 24.' },
        endpoint: { type: 'string', description: 'Logi base URL. Defaults to env LOGI_ENDPOINT or http://localhost:8080.' },
        project: { type: 'string', description: 'Project slug. Defaults to env LOGI_PROJECT or "demo".' },
      },
    },
  },
  {
    name: 'alaq_trace',
    description:
      'Full causal chain for a single trace_id. Groups frames into a semantic tree by parent_span relationships: action root → mutations inside the action → sub-actions. Each node surfaces fingerprint, phase, duration_ms, prev/next shape. Use to answer "what caused X?" questions.',
    inputSchema: {
      type: 'object',
      properties: {
        trace_id: { type: 'string', description: 'The trace_id to reconstruct. Get one from alaq_atom_activity or logi_search_events.' },
        endpoint: { type: 'string' },
        project: { type: 'string' },
      },
      required: ['trace_id'],
    },
  },
  {
    name: 'alaq_atom_activity',
    description:
      'Activity timeline for a specific atom (fingerprint = "${realm}.${atom}.${prop}"). Returns mutation count, error count, aggregated shape transitions (primitive:number → object:keys=3 etc.), and recent frames. Fingerprint filtering is post-hoc client-side (Logi search `q` is a message ILIKE).',
    inputSchema: {
      type: 'object',
      properties: {
        fingerprint: { type: 'string', description: 'Stable atom key. Example: "app.counter.count".' },
        hours: { type: 'number', description: 'Lookback window. Default 1.' },
        limit: { type: 'number', description: 'Max recent_frames to include. Default 100.' },
        endpoint: { type: 'string' },
        project: { type: 'string' },
      },
      required: ['fingerprint'],
    },
  },
  {
    name: 'alaq_hot_atoms',
    description:
      'Top atoms by write frequency in a window. Identifies performance hot spots and noisy mutations. Writes count excludes span-boundary action frames; errors are counted separately.',
    inputSchema: {
      type: 'object',
      properties: {
        hours: { type: 'number', description: 'Window in hours. Default 1.' },
        limit: { type: 'number', description: 'Max rows. Default 10.' },
        endpoint: { type: 'string' },
        project: { type: 'string' },
      },
    },
  },
  {
    name: 'alaq_idb_stores',
    description:
      'List all IndexedDB-backed atoms seen in the window. Filters frames by message LIKE "idb:%". Mode inference is a heuristic: presence of `numeric.op_count` implies "collection"; single-message fingerprints (only "idb:open") report "unknown".',
    inputSchema: {
      type: 'object',
      properties: {
        hours: { type: 'number', description: 'Window in hours. Default 24.' },
        endpoint: { type: 'string' },
        project: { type: 'string' },
      },
    },
  },
  {
    name: 'alaq_idb_store_stats',
    description:
      'Detailed operation stats for a single IDB-backed atom: open count, get hits/misses, put count, put errors, average put duration (ms). Use when alaq_idb_stores flags a store as suspicious.',
    inputSchema: {
      type: 'object',
      properties: {
        fingerprint: { type: 'string', description: 'The IDB-backed atom to inspect.' },
        hours: { type: 'number', description: 'Window in hours. Default 24.' },
        endpoint: { type: 'string' },
        project: { type: 'string' },
      },
      required: ['fingerprint'],
    },
  },
  {
    name: 'alaq_idb_errors',
    description:
      'Recent IDB errors (quota exceeded, data clone, constraint, unavailable) across all stores. Returned in DESC timestamp order, truncated to `limit`.',
    inputSchema: {
      type: 'object',
      properties: {
        hours: { type: 'number', description: 'Window in hours. Default 24.' },
        limit: { type: 'number', description: 'Max errors to return. Default 20.' },
        endpoint: { type: 'string' },
        project: { type: 'string' },
      },
    },
  },
]

function ok(id: JsonRpcRes['id'], result: any): JsonRpcRes {
  return { jsonrpc: '2.0', id, result }
}
function err(id: JsonRpcRes['id'], code: number, message: string, data?: any): JsonRpcRes {
  return { jsonrpc: '2.0', id, error: { code, message, data } }
}

function toolContent(value: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

interface ServerState {
  initialized: boolean
}

const NOT_INITIALIZED = -32002

async function handle(req: JsonRpcReq, state: ServerState): Promise<JsonRpcRes | null> {
  const id = req.id ?? null
  switch (req.method) {
    case 'initialize':
      state.initialized = true
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: { name: '@alaq/mcp', version: '6.0.0-alpha.0' },
        capabilities: { tools: {} },
      })

    case 'notifications/initialized':
    case 'initialized':
      return null

    case 'tools/list':
      if (!state.initialized) {
        return err(id, NOT_INITIALIZED, 'server not initialized — send "initialize" first')
      }
      return ok(id, { tools: TOOLS })

    case 'tools/call': {
      if (!state.initialized) {
        return err(id, NOT_INITIALIZED, 'server not initialized — send "initialize" first')
      }
      const name = req.params?.name
      const args = req.params?.arguments ?? {}
      try {
        switch (name) {
          case 'schema_compile':
            return ok(id, toolContent(await schemaCompile(args)))
          case 'schema_diff':
            return ok(id, toolContent(await schemaDiff(args)))
          case 'alaq_capabilities':
            return ok(id, toolContent(await alaqCapabilities(args)))
          case 'alaq_trace':
            return ok(id, toolContent(await alaqTrace(args)))
          case 'alaq_atom_activity':
            return ok(id, toolContent(await alaqAtomActivity(args)))
          case 'alaq_hot_atoms':
            return ok(id, toolContent(await alaqHotAtoms(args)))
          case 'alaq_idb_stores':
            return ok(id, toolContent(await alaqIdbStores(args)))
          case 'alaq_idb_store_stats':
            return ok(id, toolContent(await alaqIdbStoreStats(args)))
          case 'alaq_idb_errors':
            return ok(id, toolContent(await alaqIdbErrors(args)))
          default:
            return err(id, -32601, `unknown tool: ${name}`)
        }
      } catch (e: any) {
        return err(id, -32000, e?.message ?? String(e))
      }
    }

    case 'ping':
      return ok(id, {})

    default:
      if (id === null) return null
      return err(id, -32601, `method not found: ${req.method}`)
  }
}

export interface ServerIO {
  readLine: () => Promise<string | null>
  write: (line: string) => void
}

export async function runServer(io: ServerIO): Promise<void> {
  const state: ServerState = { initialized: false }
  while (true) {
    const line = await io.readLine()
    if (line === null) return
    const trimmed = line.trim()
    if (!trimmed) continue
    let req: JsonRpcReq
    try {
      req = JSON.parse(trimmed)
    } catch (e: any) {
      io.write(JSON.stringify(err(null, -32700, `parse error: ${e?.message ?? e}`)))
      continue
    }
    const res = await handle(req, state)
    if (res) io.write(JSON.stringify(res))
  }
}
