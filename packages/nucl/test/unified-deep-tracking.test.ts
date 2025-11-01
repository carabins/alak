import { test, expect } from 'bun:test'
import { Nucl } from '../src'
import { deepWatchPlugin } from '../src/deep-watch'

test('unified deep tracking - built-in functionality works with deepTracking option', () => {
  // Create Nucl with deep tracking enabled via option
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
    deepTracking: true
  })

  // Should be able to use getDeep, setDeep, and watchDeep
  expect(nucl.getDeep('profile.name')).toBe('John')
  expect(nucl.getDeep('profile.details.address.city')).toBe('New York')

  // Track changes to nested properties
  let changeCount = 0
  const unsubscribe = nucl.watchDeep('profile.name', () => {
    changeCount++
  })

  // Update nested property using setDeep
  nucl.setDeep('profile.name', 'Jane')
  expect(nucl.getDeep('profile.name')).toBe('Jane')
  expect(changeCount).toBe(1)

  // Test multiple updates
  nucl.setDeep('profile.name', 'Bob')
  expect(nucl.getDeep('profile.name')).toBe('Bob')
  expect(changeCount).toBe(2)

  // Cleanup
  unsubscribe()
  nucl.setDeep('profile.name', 'Charlie')
  expect(changeCount).toBe(2) // Should not increase after unsubscribe

  nucl.decay()
})

test('unified deep tracking - works alongside deep watch plugin', () => {
  // Create Nucl with both deep tracking option and plugin
  const nucl = Nucl({ 
    value: { 
      data: { 
        items: [1, 2, 3]
      }
    },
    deepTracking: true,
    plugins: [deepWatchPlugin()]
  })

  let arrayChangeCount = 0
  const unsubscribe = nucl.watchDeep('data.items', () => {
    arrayChangeCount++
  })

  // Test that both built-in and plugin methods work
  expect(nucl.getDeep('data.items')).toEqual([1, 2, 3])
  expect(nucl.getDeep('data.items.0')).toBe(1)

  // Update via setDeep
  nucl.setDeep('data.items.0', 99)
  expect(nucl.getDeep('data.items.0')).toBe(99)
  expect(arrayChangeCount).toBe(1)

  unsubscribe()
  nucl.decay()
})

test('unified deep tracking - backward compatibility without deepTracking option', () => {
  // Create Nucl without deep tracking
  const nucl = Nucl({ 
    value: { 
      profile: { 
        name: 'John'
      }
    }
  })

  // getDeep should work as a simple property access fallback
  expect(nucl.getDeep('profile.name')).toBe('John')
  
  // setDeep and watchDeep should throw errors without deepTracking
  expect(() => nucl.setDeep('profile.name', 'Jane')).toThrow()
  expect(() => nucl.watchDeep('profile.name', () => {})).toThrow()

  nucl.decay()
})