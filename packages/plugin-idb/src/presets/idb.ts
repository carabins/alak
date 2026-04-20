/**
 * Register the `'idb'` nucl kind (single-value mode).
 *
 *   import '@alaq/plugin-idb/presets/idb'
 *   import { Nu } from '@alaq/nucl'
 *
 *   const settings = Nu({ kind: 'idb', value: { theme: 'dark' }, realm: 'app', id: 'user.settings' })
 *   settings.$ready.up(ready => ready && console.log('loaded'))
 *
 * Compose with logi:   kind: 'idb logi'
 */

import { setupNuclearKinds } from '@alaq/nucl/plugins'
import { idbPlugin } from '../plugin'

setupNuclearKinds({
  'idb': [idbPlugin()],
})

declare module '@alaq/nucl/options' {
  interface NuclearKindRegistry {
    'idb': any
  }
}
