/**
 * ComputedPlugin для nucleus - расширение для вычисляемых значений
 * @packageDocumentation
 */

import { from } from './computed'

/**
 * ComputedPlugin - добавляет метод from() для создания вычисляемых nucleus
 * @remarks
 * Позволяет создавать nucleus, значение которых вычисляется на основе других nucleus
 *
 * @example
 * ```typescript
 * import { N, installPlugin } from '@alaq/nucleus'
 * import { ComputedPlugin } from '@alaq/next'
 *
 * installPlugin(ComputedPlugin)
 *
 * const a = N(1)
 * const b = N(2)
 * const sum = N().from(a, b).weak((x, y) => x + y)
 * console.log(sum()) // 3
 * ```
 */
export const ComputedPlugin: NucleusPlugin = {
  name: 'computed',
  methods: {
    from,
  },
}
