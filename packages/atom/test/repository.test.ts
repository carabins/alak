
import { describe, it, expect } from 'bun:test'
import { Atom } from '../src/index'
import { quantumBus } from '@alaq/quark/quantum-bus'
import { CHANGE } from '@alaq/quark'

class User {
  name = 'Guest'
  constructor(arg?: string | { name: string }) {
    if (typeof arg === 'string') {
      this.name = arg
    } else if (arg && typeof arg === 'object') {
      this.name = arg.name
    }
  }
}

describe('Atom Repository & Scope', () => {
  it('should create singleton with .get()', () => {
    const UserRepo = Atom.define(User)
    const user1 = UserRepo.get()
    const user2 = UserRepo.get()
    
    expect(user1).toBe(user2)
    user1.name = 'Admin'
    expect(user2.name).toBe('Admin')
  })

  it('should create distinct instances by ID', () => {
    const UserRepo = Atom.define(User)
    const bob = UserRepo.get('bob')
    const alice = UserRepo.get('alice')
    
    expect(bob).not.toBe(alice)
    bob.name = 'Bob'
    alice.name = 'Alice'
    expect(bob.name).toBe('Bob')
  })

  it('should support object argument with id', () => {
    const UserRepo = Atom.define(User)
    const user = UserRepo.get({ id: 'obj', name: 'Obj' })
    expect(user.name).toBe('Obj')
    
    const same = UserRepo.get('obj')
    expect(same).toBe(user)
  })

  // 'should bubble events with correct scope' moved to failing_events.test.ts
  
  it('should cleanup repository on clear', () => {
    const UserRepo = Atom.define(User)
    const u1 = UserRepo.get('1')
    
    UserRepo.clear()
    
    const u2 = UserRepo.get('1')
    expect(u1).not.toBe(u2)
  })
})
