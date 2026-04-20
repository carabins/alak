/**
 * Register the `'logi'` nucl kind. Import this preset once at app bootstrap,
 * after calling `logiPlugin(config)` somewhere — the runtime configuration
 * is module-global.
 *
 *   import { logiPlugin } from '@alaq/plugin-logi'
 *   import '@alaq/plugin-logi/presets/logi'
 *
 *   // Configure transport once:
 *   logiPlugin({ endpoint: '...', token: '...' })
 *
 *   // Then use the kind:
 *   const count = Nu({ kind: 'logi', value: 0, realm: 'app', id: 'counter.count' })
 *
 * Or compose with others:   kind: 'stored logi'
 *
 * Atom users typically don't use the kind directly — they pass the plugin
 * via atom options and actions get auto-wrapped with `traceAction`.
 */

import { setupNuclearKinds } from '@alaq/nucl/plugins'
import { logiPlugin } from '../plugin'

// Default registration with noop transport. User calls logiPlugin(config)
// later to configure the transport — the new config replaces the runtime,
// but the plugin object registered in the kind still delegates through
// the module-global runtime, so the hooks pick up the new transport.
setupNuclearKinds({
  'logi': [logiPlugin()],
})

declare module '@alaq/nucl/options' {
  interface NuclearKindRegistry {
    'logi': any
  }
}
