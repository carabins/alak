import { describe, it, expect } from 'bun:test'
import { Atom } from '../src/atom'

class User {
  firstName = 'John'
  lastName = 'Doe'
  age = 20

  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }

  get displayName() {
    // Nested computed dependency
    return `${this.fullName} (${this.age})`
  }
  
  get isAdult() {
    return this.age >= 18
  }
}

describe('Atom v6 - Computed', () => {
  it('should transform getters to computed properties', () => {
    const user = Atom(User)
    expect(user.fullName).toBe('John Doe')
  })

  it('should be reactive', () => {
    const user = Atom(User)
    
    user.firstName = 'Jane'
    expect(user.fullName).toBe('Jane Doe')
    
    user.lastName = 'Smith'
    expect(user.fullName).toBe('Jane Smith')
  })

  it('should handle nested computed dependencies', () => {
    const user = Atom(User)
    
    expect(user.displayName).toBe('John Doe (20)')
    
    user.age = 30
    expect(user.displayName).toBe('John Doe (30)')
    
    user.firstName = 'Alice'
    expect(user.displayName).toBe('Alice Doe (30)')
  })

  it('should expose Fusion instance via $', () => {
    const user = Atom(User)
    const fusion = user.$fullName
    
    expect(fusion).toBeDefined()
    
    let result = ''
    fusion.up((v: string) => result = v)
    
    user.firstName = 'Bob'
    expect(result).toBe('Bob Doe')
  })
})
