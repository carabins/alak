import { test, expect } from 'bun:test'
import { Nucl } from '../src'
import { deepWatchPlugin, watchDeep, getDeep, setDeep } from '../src/deep-watch'

test('deep watch plugin - basic functionality', () => {
  // Create Nucl with deep watch plugin
  const nucl = Nucl({ 
    value: { 
      profile: { 
        name: 'John',
        details: {
          age: 30,
          address: {
            city: 'New York',
            zip: '10001'
          }
        }
      }
    },
    plugins: [deepWatchPlugin()]
  })

  // Track changes to nested properties
  let changeCount = 0
  const unsubscribe = watchDeep(nucl, 'profile.name', () => {
    changeCount++
  })

  // Initial value
  expect(getDeep(nucl, 'profile.name')).toBe('John')
  expect(changeCount).toBe(0)

  // Update nested property
  setDeep(nucl, 'profile.name', 'Jane')
  expect(getDeep(nucl, 'profile.name')).toBe('Jane')
  expect(changeCount).toBe(1)

  // Cleanup
  unsubscribe()
  setDeep(nucl, 'profile.name', 'Bob')
  expect(changeCount).toBe(1) // Should not trigger after unsubscribe

  nucl.decay()
})

test('deep watch plugin - nested object changes', () => {
  const nucl = Nucl({ 
    value: { 
      data: { 
        items: [1, 2, 3],
        metadata: {
          counts: [0, 0]
        }
      }
    },
    plugins: [deepWatchPlugin()]
  })

  // Watch for changes to nested array
  let arrayChangeCount = 0
  watchDeep(nucl, 'data.items', () => {
    arrayChangeCount++
  })

  // Watch for changes to nested object property
  let metadataChangeCount = 0
  watchDeep(nucl, 'data.metadata.counts.0', () => {
    metadataChangeCount++
  })

  // Initial values
  expect(getDeep(nucl, 'data.items')).toEqual([1, 2, 3])
  expect(getDeep(nucl, 'data.metadata.counts.0')).toBe(0)
  expect(arrayChangeCount).toBe(0)
  expect(metadataChangeCount).toBe(0)

  // Update nested array
  setDeep(nucl, 'data.items.0', 99)
  expect(getDeep(nucl, 'data.items.0')).toBe(99)
  expect(arrayChangeCount).toBe(1)

  // Update deeply nested property
  setDeep(nucl, 'data.metadata.counts.0', 5)
  expect(getDeep(nucl, 'data.metadata.counts.0')).toBe(5)
  expect(metadataChangeCount).toBe(1)

  nucl.decay()
})

test('deep watch plugin - performance', () => {
  const nucl = Nucl({ 
    value: { 
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                value: 'deep'
              }
            }
          }
        }
      }
    },
    plugins: [deepWatchPlugin({ maxDepth: 10 })]
  })

  // Watch deep property
  let deepChangeCount = 0
  watchDeep(nucl, 'level1.level2.level3.level4.level5.value', () => {
    deepChangeCount++
  })

  // Performance test - many updates
  const startTime = performance.now()
  for (let i = 0; i < 1000; i++) {
    setDeep(nucl, 'level1.level2.level3.level4.level5.value', `updated-${i}`)
  }
  const endTime = performance.now()

  expect(getDeep(nucl, 'level1.level2.level3.level4.level5.value')).toBe('updated-999')
  expect(deepChangeCount).toBe(1000)

  // Should complete quickly (less than 100ms for 1000 updates)
  expect(endTime - startTime).toBeLessThan(100)

  nucl.decay()
})