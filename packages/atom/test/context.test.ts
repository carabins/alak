import { describe, it, expect } from 'bun:test'
import { Atom } from '../src/atom'

class PrivateModel {
  publicProp = 1
  _privateProp = 2
  
  getPublic() {
    return this.publicProp
  }
  
  getPrivate() {
    // Accessing private prop internally should work
    return this._privateProp
  }
}

describe('Atom v6 - Context & Privacy', () => {
  it('should hide _ properties from keys', () => {
    const atom = Atom(PrivateModel)
    
    const keys = Object.keys(atom)
    expect(keys).toContain('publicProp')
    expect(keys).not.toContain('_privateProp')
  })

  it('should allow internal access to _ properties', () => {
    const atom = Atom(PrivateModel)
    expect(atom.getPrivate()).toBe(2)
  })

  it('should provide context via $', () => {
    const atom = Atom(PrivateModel)
    expect(atom.$).toBeDefined()
    expect(atom.$.bus).toBeDefined()
    expect(atom.$.options).toBeDefined()
  })

  it('should decay properly', () => {
    const atom = Atom(PrivateModel)
    // Manually setting a Nucl to check cleanup
    atom.publicProp = 10
    
    atom.$.decay()
    
    // Internal map should be cleared
    expect(atom.$._nucl.size).toBe(0)
  })
})
