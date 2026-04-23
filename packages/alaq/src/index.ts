// Public API of `alaq`. Intended for tooling authors, not application code.
//
// Per AI_FIRST.md, `alaq` is an AI-native frontdoor — the package's primary
// consumer is an LLM agent through the CLI and MCP. These exports exist so
// that another tool (editor extension, test harness) can reuse the same
// manifest and stanza-rendering logic without shelling out.

export type {
  CapabilityManifest,
} from './manifest'
export {
  readManifest,
  readManifestFull,
  renderManifestCompact,
  renderManifestPretty,
} from './manifest'

export type {
  StanzaFormat,
  StanzaCommand,
  StanzaOptions,
  StanzaResult,
  StanzaError,
} from './stanza'
export { renderMcpStanza } from './stanza'

export type {
  AlaqError,
  Code,
  CodeKey,
} from './errors'
export { CODES, DESCRIPTIONS, alaqError, formatError } from './errors'

export type {
  MCPMode,
  SpawnMcpResult,
  SpawnMcpError,
} from './launcher'
export { spawnMcp } from './launcher'
