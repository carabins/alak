import { test, expect } from 'bun:test'
import { Nu } from '../src/index'
import { createDeepPlugin } from '../src/deep-state/plugin'
import { stdPlugin } from '../src/std/plugin' // For non-deep test
import { createKind } from '../src/plugins' // Import createKind for anonymous kinds

test('Deep State Plugin via plugins option', () => {
  // Use createKind and plugins for testing
  const deepOnlyKind = createKind([createDeepPlugin()])
  const n = Nu({ value: { a: { b: 1 } } }, { kind: deepOnlyKind })

  let updateCount = 0
  n.up(() => updateCount++)

  // Deep update
  n.value.a.b = 2

  expect(n.value.a.b).toBe(2)
  expect(updateCount).toBe(1)
})




test('Non-deep Nucl (using stdPlugin) does not react to deep changes', () => {
  // 'std' kind does not include deepStatePlugin (now that it's separated)
  const stdOnlyKind = createKind([stdPlugin])
  const n = Nu({ value: { x: 10, y: { z: 1 } } }, { kind: stdOnlyKind })

  let updateCount = 0
  n.up(() => updateCount++)

  // Initial call happens immediately (Nucl behavior)
  expect(updateCount).toBe(1)

  // Modify deep property - should NOT trigger Nucl update
  n.value.y.z = 100
  expect(n.value.y.z).toBe(100) // Value changes
  expect(updateCount).toBe(1) // Update count remains 1

  // Modify root property - should NOT trigger Nucl update (because it's not deep and not a top-level replace)
  n.value.x = 20
  expect(updateCount).toBe(1)
})