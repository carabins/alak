/**
 * @alaq/vue - Vue integration test with deep watch plugin
 * 
 * This test verifies that Vue effects properly react to atom state changes
 * when using the deep watch plugin for nested property tracking.
 */

import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'
import { AtomicStatePlugin } from '../src/atomic-state'
import { deepWatchPlugin, watchDeep, getDeep, setDeep } from '@alaq/nucl/deep-watch'
import { effect } from '@vue/reactivity'

test('Vue reactivity with deep watch plugin - basic functionality', () => {
  // Create atom with deep watch plugin
  const atom = Atom(
    { 
      count: 0,
      message: 'Hello World!',
      user: {
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
      }
    },
    { 
      plugins: [AtomicStatePlugin, deepWatchPlugin()] 
    }
  )

  // Track Vue effect renders
  let templateRenderCount = 0
  let renderedCount = 0
  let renderedMessage = ''
  let renderedUserName = ''

  const stopEffect = effect(() => {
    templateRenderCount++
    renderedCount = atom.state.count
    renderedMessage = atom.state.message
    renderedUserName = getDeep(atom, 'user.profile.name') // Use getDeep for nested access
  })

  // Initial render
  expect(templateRenderCount).toBe(1)
  expect(renderedCount).toBe(0)
  expect(renderedMessage).toBe('Hello World!')
  expect(renderedUserName).toBe('John')

  // Update direct properties - should trigger Vue reactivity
  atom.state.count = 5
  expect(templateRenderCount).toBe(2)
  expect(renderedCount).toBe(5)

  atom.state.message = 'Updated Message'
  expect(templateRenderCount).toBe(3)
  expect(renderedMessage).toBe('Updated Message')

  // Update nested properties using setDeep - should trigger Vue reactivity through deep watch plugin
  setDeep(atom, 'user.profile.name', 'Jane Smith')
  expect(templateRenderCount).toBe(4)
  expect(renderedUserName).toBe('Jane Smith')

  // Test array operations
  atom.state.items = [1, 2, 3]
  expect(templateRenderCount).toBe(5)
  
  atom.state.items.push(4)
  expect(templateRenderCount).toBe(6)
  expect(atom.state.items).toEqual([1, 2, 3, 4])

  // Cleanup
  stopEffect()
  atom.decay()
})

test('Vue reactivity with deep watch plugin - complex nested updates', () => {
  const atom = Atom(
    {
      profile: {
        personal: {
          name: 'Vue Dev',
          contact: {
            email: 'dev@example.com',
            address: {
              street: '123 Main St',
              city: 'Boston',
              state: 'MA',
              zip: '02101'
            }
          }
        },
        preferences: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false
          }
        }
      }
    },
    { 
      plugins: [AtomicStatePlugin, deepWatchPlugin()] 
    }
  )

  // Track complex nested updates
  let templateRenders = 0
  let templateData = {
    name: '',
    email: '',
    city: '',
    theme: '',
    emailNotifications: false
  }

  const stopEffect = effect(() => {
    templateRenders++
    templateData = {
      name: getDeep(atom, 'profile.personal.name'),
      email: getDeep(atom, 'profile.personal.contact.email'),
      city: getDeep(atom, 'profile.personal.contact.address.city'),
      theme: getDeep(atom, 'profile.preferences.theme'),
      emailNotifications: getDeep(atom, 'profile.preferences.notifications.email')
    }
  })

  // Initial render
  expect(templateRenders).toBe(1)
  expect(templateData).toEqual({
    name: 'Vue Dev',
    email: 'dev@example.com',
    city: 'Boston',
    theme: 'dark',
    emailNotifications: true
  })

  // Update deeply nested properties
  setDeep(atom, 'profile.personal.name', 'Updated Vue Dev')
  expect(templateRenders).toBe(2)
  expect(templateData.name).toBe('Updated Vue Dev')

  setDeep(atom, 'profile.personal.contact.address.city', 'Los Angeles')
  expect(templateRenders).toBe(3)
  expect(templateData.city).toBe('Los Angeles')

  setDeep(atom, 'profile.preferences.notifications.email', false)
  expect(templateRenders).toBe(4)
  expect(templateData.emailNotifications).toBe(false)

  // Update multiple nested properties
  setDeep(atom, 'profile.personal.contact.email', 'updated@example.com')
  setDeep(atom, 'profile.preferences.theme', 'light')
  expect(templateRenders).toBe(6) // Two separate updates
  expect(templateData.email).toBe('updated@example.com')
  expect(templateData.theme).toBe('light')

  // Cleanup
  stopEffect()
  atom.decay()
})

test('Vue reactivity with deep watch plugin - performance', () => {
  const atom = Atom(
    {
      data: {
        items: new Array(100).fill(0).map((_, i) => ({ id: i, value: i }))
      }
    },
    { 
      plugins: [AtomicStatePlugin, deepWatchPlugin({ debounceMs: 5 })] 
    }
  )

  // Track performance with many updates
  let renderCount = 0
  let firstItemValue = 0

  const stopEffect = effect(() => {
    renderCount++
    firstItemValue = getDeep(atom, 'data.items.0.value')
  })

  // Initial render
  expect(renderCount).toBe(1)
  expect(firstItemValue).toBe(0)

  // Performance test with many nested updates
  const startTime = performance.now()
  for (let i = 0; i < 1000; i++) {
    setDeep(atom, 'data.items.0.value', i)
  }
  const endTime = performance.now()

  // Should have rendered once for each update (1000 + 1 = 1001)
  // But with debouncing, might be less
  expect(renderCount).toBeGreaterThan(1)
  expect(renderCount).toBeLessThan(1001) // Debouncing should reduce this
  expect(firstItemValue).toBe(999)
  
  // Performance should be reasonable (< 100ms for 1000 updates)
  expect(endTime - startTime).toBeLessThan(100)

  // Cleanup
  stopEffect()
  atom.decay()
})