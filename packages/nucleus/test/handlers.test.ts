import { test, expect } from 'bun:test'
import N from '@alaq/nucleus/index'

// ============================================================================
// Property Tests
// ============================================================================

test('props - isFilled', () => {
  const n = N()
  expect(n.isEmpty).toBe(true)

  // n(10)
  // expect(n.isFilled).toBe(true)
})

