#!/usr/bin/env bun
// Frontdoor CLI for the v6 @alaq/* ecosystem. Today this is a pointer:
// it lists the working entry points (alaq-mcp, alaq-mcp-call) and the
// ecosystem layout. Sub-commands described in README.md (doctor, init,
// mcp install, mcp start) are not implemented yet — README is aspirational.
//
// Version is hardcoded; keep in sync with package.yaml. Same convention as
// @alaq/mcp's serverInfo string.

const VERSION = '6.0.0-alpha.0'

const HELP = `alaq ${VERSION} — frontdoor for the v6 @alaq/* ecosystem

USAGE
  alaq [--version | --help]

STATUS
  This binary is a pointer, not a CLI. The sub-commands documented in
  the README (doctor, init, mcp install, mcp start) are not implemented
  in this alpha. Use the working entry points below directly.

WORKING ENTRY POINTS (installed transitively via alaq)
  alaq-mcp           Long-running MCP stdio server (@alaq/mcp)
  alaq-mcp-call      One-shot MCP tool caller (@alaq/mcp)

ECOSYSTEM
  Reactive core      @alaq/quark, @alaq/nucl, @alaq/atom, @alaq/fx
  Plugins            @alaq/plugin-logi, @alaq/plugin-idb, @alaq/plugin-tauri
  alaqlink stack     @alaq/link, @alaq/link-state, @alaq/graph,
                     @alaq/graph-link-state, @alaq/graph-link-server,
                     @alaq/graph-zenoh, @alaq/graph-tauri, @alaq/graph-axum
  UI adapters        @alaq/link-state-vue, @alaq/xstate
  Utilities          @alaq/bitmask, @alaq/datastruct, @alaq/queue,
                     @alaq/rune, @alaq/deep-state
  AI tooling         @alaq/mcp

DOCS
  https://github.com/carabins/alak
`

const arg = process.argv[2]
if (arg === '--version' || arg === '-v') {
  process.stdout.write(VERSION + '\n')
  process.exit(0)
}
process.stdout.write(HELP)
process.exit(0)
