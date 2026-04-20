/**
 * Register the `'idb-collection'` nucl kind (collection mode).
 *
 *   import '@alaq/plugin-idb/presets/idb-collection'
 *   import { Nu } from '@alaq/nucl'
 *
 *   const todos = Nu({
 *     kind: 'idb-collection',
 *     value: [],
 *     realm: 'app',
 *     id: 'app.todos',
 *     collection: { primaryKey: 'id', indexes: ['done'] },
 *   })
 *   todos.insert({ id: '1', title: 'buy milk', done: false })
 *   todos.update('1', { done: true })
 *   todos.remove('1')
 *   todos.query({ where: 'done', equals: false })
 *
 * Compose with logi:   kind: 'idb-collection logi'
 */

import { setupNuclearKinds } from '@alaq/nucl/plugins'
import { idbPlugin } from '../plugin'

setupNuclearKinds({
  'idb-collection': [idbPlugin()],
})

declare module '@alaq/nucl/options' {
  interface NuclearKindRegistry {
    'idb-collection': any
  }
}
