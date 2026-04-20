export { schemaCompile, schemaDiff } from './tools'
export type {
  SchemaCompileInput,
  SchemaCompileOutput,
  SchemaDiffInput,
  SchemaDiffOutput,
} from './tools'
export { diffIR } from './diff'
export type { DiffReport, SchemaChange, ChangeKind } from './diff'
export { runServer } from './server'
export type { ServerIO } from './server'

// Runtime observation tools
export {
  alaqCapabilities,
  alaqTrace,
  alaqAtomActivity,
  alaqHotAtoms,
  alaqIdbStores,
  alaqIdbStoreStats,
  alaqIdbErrors,
} from './tools-runtime'
export type {
  AlaqCapabilitiesInput,
  AlaqTraceInput,
  AlaqAtomActivityInput,
  AlaqHotAtomsInput,
  AlaqIdbStoresInput,
  AlaqIdbStoreStatsInput,
  AlaqIdbErrorsInput,
  LogiEvent,
} from './tools-runtime'
