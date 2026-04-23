import { describe, it, expect, beforeAll } from 'bun:test'
import { computed, watch, isRef, effectScope } from '@vue/reactivity'
import { Nv } from '@alaq/nucl'
import { setupMagicVue } from '../src/magic'

describe('VueNuclearPlugin (Magic Mode)', () => {
  beforeAll(() => {
    setupMagicVue()
  })

  it('1. marks nucleons as Vue Refs', () => {
    const n = Nv(100)
    // __v_isRef is set in onCreate
    expect((n as any).__v_isRef).toBe(true)
    expect(isRef(n)).toBe(true)
  })

  it('2. provides reactive .value via track/trigger', () => {
    const n = Nv(10)
    
    const double = computed(() => (n as any).value * 2)
    expect(double.value).toBe(20)

    n(20) // Update via nucleon call
    expect(double.value).toBe(40)
  })

  it('3. supports setting via .value', () => {
    const n = Nv(1)
    expect(n()).toBe(1)

    ;(n as any).value = 42
    expect(n()).toBe(42)
  })

  it('4. works with watch()', async () => {
    const n = Nv('initial')
    let changedTo = ''
    
    watch(n as any, (val) => {
      changedTo = val
    }, { flush: 'sync' })

    n('updated')
    expect(changedTo).toBe('updated')
  })

  it('5. handles ghost nodes (SyncNode style)', () => {
    // Simulate a ghost node by adding $meta
    const n = Nv(100)
    ;(n as any).$meta = { isGhost: true }
    
    // In magic.ts: get() returns undefined if isGhost
    expect((n as any).value).toBe(undefined)

    ;(n as any).$meta.isGhost = false
    expect((n as any).value).toBe(100)
  })

  it('6. integrates with effectScope', () => {
    const n = Nv(0)
    const scope = effectScope()
    let count = 0

    scope.run(() => {
      watch(n as any, (val) => {
        count = val
      }, { flush: 'sync' })
    })

    n(1)
    expect(count).toBe(1)

    scope.stop()
    n(2)
    expect(count).toBe(1) // Stopped
  })
})
