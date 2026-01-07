import { test, expect } from 'bun:test'
import { Nu } from '@alaq/nucl'
import { createDeepPlugin } from '@alaq/nucl/deep-state/plugin'
import { stdPlugin } from '@alaq/nucl/std/plugin' // For non-deep test

test('Deep State Plugin via plugins option', () => {
  const n = Nu({ value: { a: { b: 1 } } }, { plugins: [createDeepPlugin()] })

  let updateCount = 0
  n.up(() => updateCount++)

  // Deep update
  n.value.a.b = 2

  expect(n.value.a.b).toBe(2)
  expect(updateCount).toBe(1)
})

test('Non-deep Nucl (using stdPlugin) does not react to deep changes', () => {
  const n = Nu({ value: { x: 10, y: { z: 1 } } }, { plugins: [stdPlugin] })

  let updateCount = 0
  n.up(() => updateCount++)

  // Initial call happens immediately (Nucl behavior)
  expect(updateCount).toBe(1)

  // Modify deep property - should NOT trigger Nucl update
  n.value.y.z = 100
  expect(n.value.y.z).toBe(100) // Value changes
  expect(updateCount).toBe(1) // Update count remains 1

  // Modify root property - should NOT trigger Nucl update (no top-level setter called)
  n.value.x = 20
  expect(updateCount).toBe(1)
})
