/**
 * @alaq/quark - High-Performance Reactive Container
 */

import { createQu } from './create'
import type { QuOptions } from './create'

export const Qu = createQu


export const Qv = Object.assign(
  function<T>(value?: T, options?: any) {
    return createQu({ ...options, value })
  }
)

export default Qu

// Export for library authors (like @alaq/nucl)
export { createQu, setValue } from './create'
export { quarkProto } from './prototype'
export { HAS_LISTENERS, HAS_EVENTS, HAS_REALM, WAS_SET, DEDUP, STATELESS, SILENT } from './flags'
export type { QuOptions }

