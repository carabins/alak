/**
 * Register the `'tauri'` nucl kind (state mode).
 *
 *   import '@alaq/plugin-tauri/presets/tauri'
 *   import { Nu } from '@alaq/nucl'
 *
 *   const deviceId = Nu({
 *     kind: 'tauri',
 *     value: null,
 *     realm: 'app', id: 'sys.deviceId',
 *     tauri: {
 *       read:   'get_device_id',
 *       write:  'set_device_id',   // optional
 *       listen: 'device:changed',  // optional
 *     },
 *   })
 *
 * Compose with logi:   kind: 'tauri logi'
 */

import { setupNuclearKinds } from '@alaq/nucl/plugins'
import { tauriPlugin } from '../plugin'

setupNuclearKinds({
  'tauri': [tauriPlugin()],
})

declare module '@alaq/nucl/options' {
  interface NuclearKindRegistry {
    'tauri': any
  }
}
