import { describe, it, expect } from 'bun:test'
import { Atom } from '../src/atom'

class Base {
  baseValue = 10
  get baseComputed() {
    return this.baseValue * 2
  }
  baseMethod() {
    return this.baseValue
  }
}

class Derived extends Base {
  childValue = 5
  get total() {
    return this.baseComputed + this.childValue
  }
}

describe('Atom v6 - Inheritance', () => {
  it('should inherit properties', () => {
    const atom = Atom(Derived)
    expect(atom.baseValue).toBe(10)
    expect(atom.childValue).toBe(5)
    
    // Check reactivity
    expect(atom.$baseValue).toBeDefined()
    atom.baseValue = 20
    expect(atom.baseValue).toBe(20)
  })

  it('should inherit computed properties', () => {
    const atom = Atom(Derived)
    expect(atom.baseComputed).toBe(20)
    
    atom.baseValue = 30
    expect(atom.baseComputed).toBe(60)
  })

  it('should compose computed properties across chain', () => {
    const atom = Atom(Derived)
    // total = baseComputed(20) + 5 = 25
    expect(atom.total).toBe(25)
    
    atom.baseValue = 20
    // total = baseComputed(40) + 5 = 45
    expect(atom.total).toBe(45)
  })

  it('should inherit methods', () => {
    const atom = Atom(Derived)
    expect(atom.baseMethod()).toBe(10)
    
    atom.baseValue = 50
    expect(atom.baseMethod()).toBe(50)
  })
})
