/**
 * @alaq/quark - High-Performance Reactive Container
 */

import { createQu } from './create'

export const Qu = createQu


export const Qv = Object.assign(
  function<T>(value?: T, options?: any) {
    return createQu({ ...options, value })
  }
)

export default Qu

