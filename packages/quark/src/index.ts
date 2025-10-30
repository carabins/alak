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
export { createQu }
export type { QuOptions }

