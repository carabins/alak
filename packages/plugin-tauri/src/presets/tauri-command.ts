/**
 * Register the `'tauri-command'` nucl kind (command mode).
 *
 *   import '@alaq/plugin-tauri/presets/tauri-command'
 *   import { Nu } from '@alaq/nucl'
 *
 *   const calcDistance = Nu({
 *     kind: 'tauri-command',
 *     value: null,
 *     realm: 'geo', id: 'calc.distance',
 *     tauriCommand: { command: 'calc_distance' },
 *   })
 *
 *   await calcDistance.invoke({ lat1, lon1, lat2, lon2 })
 *   // calcDistance._value now holds the result.
 *
 * Compose with logi:   kind: 'tauri-command logi'
 */

import { setupNuclearKinds } from '@alaq/nucl/plugins'
import { tauriPlugin } from '../plugin'

setupNuclearKinds({
  'tauri-command': [tauriPlugin()],
})

declare module '@alaq/nucl/options' {
  interface NuclearKindRegistry {
    'tauri-command': any
  }
}
