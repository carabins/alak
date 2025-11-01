/**
 * @alaq/nucl/deep-watch - Test the deep watch plugin functionality
 * 
 * This test verifies that the deep watch plugin works correctly with Nucl
 */

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
    console.log('🔔 Name changed to:', getDeep(nucl, 'profile.name'))
  })

  let cityChangeCount = 0
  const unsubscribeCity = watchDeep(nucl, 'profile.details.address.city', () => {
    cityChangeCount++
    console.log('🔔 City changed to:', getDeep(nucl, 'profile.details.address.city'))
  })

  // Test initial values
  expect(getDeep(nucl, 'profile.name')).toBe('John')
  expect(getDeep(nucl, 'profile.details.address.city')).toBe('New York')
  expect(changeCount).toBe(0)
  expect(cityChangeCount).toBe(0)

  // Test nested updates
  setDeep(nucl, 'profile.name', 'Jane')
  expect(getDeep(nucl, 'profile.name')).toBe('Jane')
  expect(changeCount).toBe(1)
  expect(cityChangeCount).toBe(0)

  setDeep(nucl, 'profile.details.address.city', 'Los Angeles')
  expect(getDeep(nucl, 'profile.details.address.city')).toBe('Los Angeles')
  expect(changeCount).toBe(1)
  expect(cityChangeCount).toBe(1)

  // Test multiple updates
  setDeep(nucl, 'profile.name', 'Bob')
  setDeep(nucl, 'profile.name', 'Alice')
  expect(getDeep(nucl, 'profile.name')).toBe('Alice')
  expect(changeCount).toBe(3)
  expect(cityChangeCount).toBe(1)

  // Cleanup
  unsubscribe()
  unsubscribeCity()

  // Test that unsubscribed watchers don't trigger
  setDeep(nucl, 'profile.name', 'Charlie')
  expect(changeCount).toBe(3) // Should not increase

  nucl.decay()
})

test('deep watch plugin - performance test', () => {
  const nucl = Nucl({ 
    value: { 
      data: { 
        items: new Array(1000).fill(0).map((_, i) => ({ id: i, value: i }))
      }
    },
    plugins: [deepWatchPlugin()]
  })

  let itemCount = 0
  const unsubscribe = watchDeep(nucl, 'data.items', () => {
    itemCount++
  })

  // Performance test with many updates
  const startTime = performance.now()
  for (let i = 0; i < 1000; i++) {
    setDeep(nucl, 'data.items.0.value', i)
  }
  const endTime = performance.now()

  expect(itemCount).toBe(1000)
  expect(getDeep(nucl, 'data.items.0.value')).toBe(999)
  expect(endTime - startTime).toBeLessThan(100) // Should be fast

  unsubscribe()
  nucl.decay()
})

test('deep watch plugin - array operations', () => {
  const nucl = Nucl({ 
    value: { 
      items: [1, 2, 3]
    },
    plugins: [deepWatchPlugin()]
  })

  let arrayChangeCount = 0
  const unsubscribe = watchDeep(nucl, 'items', () => {
    arrayChangeCount++
  })

  let firstItemChangeCount = 0
  const unsubscribeFirst = watchDeep(nucl, 'items.0', () => {
    firstItemChangeCount++
  })

  // Test initial values
  expect(getDeep(nucl, 'items')).toEqual([1, 2, 3])
  expect(getDeep(nucl, 'items.0')).toBe(1)
  expect(arrayChangeCount).toBe(0)
  expect(firstItemChangeCount).toBe(0)

  // Test array updates
  setDeep(nucl, 'items.0', 99)
  expect(getDeep(nucl, 'items.0')).toBe(99)
  expect(getDeep(nucl, 'items')).toEqual([99, 2, 3])
  expect(arrayChangeCount).toBe(1)
  expect(firstItemChangeCount).toBe(1)

  // Test adding elements (this requires creating a new array)
  const currentItems = [...getDeep(nucl, 'items')]
  currentItems.push(4)
  setDeep(nucl, 'items', currentItems)
  expect(getDeep(nucl, 'items')).toEqual([99, 2, 3, 4])
  expect(arrayChangeCount).toBe(2)
  expect(firstItemChangeCount).toBe(1) // First item didn't change

  unsubscribe()
  unsubscribeFirst()
  nucl.decay()
})