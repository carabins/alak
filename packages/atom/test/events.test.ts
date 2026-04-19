import { describe, it, expect } from 'bun:test'
import { Atom } from '../src/atom'
import { quantumBus } from '@alaq/quark/quantum-bus'
import { CHANGE } from '@alaq/quark'

class EventModel {
  count = 0
  name = 'Guest'
}

describe('Atom v6 - Events & Bubbling', () => {
  it('should emit changes to quantum bus when emitChanges is true', () => {
    const realm = 'events-test-' + Math.random()
    const bus = quantumBus.getRealm(realm)
    const atom = Atom(EventModel, { realm, emitChanges: true, name: 'Test' })
    
    let received: any = null
    bus.on(CHANGE, (data) => {
      received = data
    })
    
    atom.count = 1
    
    expect(received).toBeDefined()
    expect(received.data.id).toContain('Test.count')
    expect(received.data.value).toBe(1)
  })

  it('should bubble events with correct scope', () => {
    const realm = 'bubble-test-' + Math.random()
    const bus = quantumBus.getRealm(realm)
    const atom = Atom(EventModel, { 
      realm, 
      emitChanges: true, 
      name: 'User',
      scope: 'User.1' 
    })
    
    let received: any = null
    bus.on(CHANGE, (data) => {
      received = data
    })
    
    atom.name = 'Admin'
    
    expect(received).toBeDefined()
    expect(received.scope).toBe('User.1.name')
    expect(received.data.value).toBe('Admin')
  })

  it('should use custom emitChangeName', () => {
    const realm = 'custom-event-test-' + Math.random()
    const bus = quantumBus.getRealm(realm)
    const CUSTOM_EVENT = 'CUSTOM_UPDATE'
    const atom = Atom(EventModel, { 
      realm, 
      emitChanges: true, 
      emitChangeName: CUSTOM_EVENT 
    })
    
    let received: any = null
    bus.on(CUSTOM_EVENT, (data) => {
      received = data
    })
    
    atom.count = 100
    
    expect(received).toBeDefined()
    expect(received.event).toBe(CUSTOM_EVENT)
    expect(received.data.value).toBe(100)
  })
})
