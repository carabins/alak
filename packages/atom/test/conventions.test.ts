import { describe, it, expect } from 'bun:test'
import { Atom } from '../src/atom'
import { quantumBus } from '@alaq/quark/quantum-bus'

class ReactiveModel {
  count = 0
  lastValue = 0
  eventData: any = null

  // 1. Reactivity Convention
  _count_up(val: number) {
    this.lastValue = val
  }

  // 2. Bus Convention
  _on_TEST_EVENT(payload: any) {
    // Since we removed magic unwrapping, we get the full bus event object
    // { event: 'TEST_EVENT', data: ... }
    this.eventData = payload.data
  }
}

describe('Atom v6 - Conventions', () => {
  it('should auto-wire _prop_up methods', () => {
    const atom = Atom(ReactiveModel)
    
    expect(atom.lastValue).toBe(0)
    
    atom.count = 42
    // Should trigger _count_up
    expect(atom.lastValue).toBe(42)
  })

  it('should auto-wire _on_EVENT methods', () => {
    // Use a specific realm to avoid pollution
    const realmName = 'test-realm-' + Math.random()
    const atom = Atom(ReactiveModel, { realm: realmName })
    const bus = quantumBus.getRealm(realmName)

    expect(atom.eventData).toBeNull()
    
    bus.emit('TEST_EVENT', { foo: 'bar' })
    expect(atom.eventData).toEqual({ foo: 'bar' })
  })

  it('should support emitChanges option', () => {
    const realmName = 'changes-realm-' + Math.random()
    const atom = Atom(ReactiveModel, { 
      realm: realmName, 
      name: 'model',
      emitChanges: true 
    })
    const bus = quantumBus.getRealm(realmName)

    let caughtEvent: any = null
    bus.on('model.count', (val: any) => {
        // The event object structure from Quark might vary, 
        // usually it emits the object { event, data } wrapper if listening on bus,
        // or just data if specific listener? 
        // Let's check what Quark emits.
        caughtEvent = val
    })

    atom.count = 99
    
    // Quark emit logic: bus.emit(id, { id, value })
    // Bus logic: listeners receive { event, data: { id, value } }
    expect(caughtEvent.data.value).toBe(99) 
  })
})