import { describe, it, expect } from 'bun:test'
import { effect, computed, watch, nextTick } from '@vue/reactivity'
import { Atom, kind } from '@alaq/atom'
import { Nu, defineKind } from '@alaq/nucl'
import { setupAlaqVue, VueNuclPlugin } from '../src'

// Ensure Vue integration is setup once
setupAlaqVue()

describe('@alaq/vue - Integration', () => {
  it('should trigger Vue effects when Alaq state changes', () => {
    const count = Nu({ value: 0 })
    
    let rendered = -1
    effect(() => {
      rendered = count.value
    })
    
    expect(rendered).toBe(0)
    
    count(10)
    expect(rendered).toBe(10)
  })

  it('should work with Alaq Atoms natively in effects', () => {
    class UserModel {
      name = 'Guest'
      age = 20
    }
    
    const user = Atom(UserModel)
    
    let template = ''
    effect(() => {
      template = `${user.name} (${user.age})`
    })
    
    expect(template).toBe('Guest (20)')
    
    user.name = 'Admin'
    expect(template).toBe('Admin (20)')
    
    user.age = 30
    expect(template).toBe('Admin (30)')
  })

  it('should work with Vue computed properties', () => {
    const user = Atom(class {
      firstName = 'John'
      lastName = 'Doe'
    })

    const fullName = computed(() => `${user.firstName} ${user.lastName}`)
    
    expect(fullName.value).toBe('John Doe')
    
    user.firstName = 'Jane'
    expect(fullName.value).toBe('Jane Doe')
    
    user.lastName = 'Smith'
    expect(fullName.value).toBe('Jane Smith')
  })

  it('should support v-model simulation (writing from Vue side)', () => {
    const store = Atom(class {
      text = 'init'
    })

    // Simulate v-model: reading tracks, writing updates
    expect(store.text).toBe('init')
    
    store.text = 'updated' // This calls the setter in VueNuclPlugin
    expect(store.text).toBe('updated')
    expect(store.$text.value).toBe('updated')
  })

  it('should work with Alaq computeds (Fusion)', () => {
    const store = Atom(class {
      a = 1
      b = 2
      get sum() { return this.a + this.b }
    })

    let renderedSum = 0
    effect(() => {
      renderedSum = store.sum
    })

    expect(renderedSum).toBe(3)

    store.a = 10
    expect(renderedSum).toBe(12)

    store.b = 20
    expect(renderedSum).toBe(30)
  })

  it('should support __v_isRef for template unwrapping compatibility', () => {
    const count = Nu({ value: 0 })
    expect((count as any).__v_isRef).toBe(true)
    
    const user = Atom(class { name = 'test' })
    expect((user.$name as any).__v_isRef).toBe(true)
  })

  it('should allow using specific "vue" kind', () => {
    // Already defined in setupAlaqVue, but let's test explicit usage
    const count = Nu({ kind: 'vue', value: 5 })
    
    let val = 0
    effect(() => { val = count.value })
    
    expect(val).toBe(5)
    count(100)
    expect(val).toBe(100)
  })

  it('should clean up notify correctly (no safeEmit errors)', () => {
    const count = Nu({ value: 0 })
    expect(() => count(1)).not.toThrow()
  })
})
