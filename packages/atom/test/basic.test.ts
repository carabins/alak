import { test } from 'bun:test'
import { Atom } from '../src'

test('plain object atom', () => {
  const counter = Atom({
    count: 0,
    step: 1,
    increment() {
      this.count += this.step
    }
  })

  console.log('Initial count:', counter.state.count) // 0

  counter.state.count = 10
  console.log('After set:', counter.state.count) // 10

  counter.actions.increment()
  console.log('After increment:', counter.state.count) // 11

  counter.decay()
})

test('class-based atom', () => {
  class User {
    name = ''
    age = 0

    greet() {
      return `Hello, ${this.name}!`
    }
  }

  const user = Atom(User, { name: 'user', realm: 'app' })

  console.log('Initial name:', user.state.name) // ''

  user.state.name = 'John'
  user.state.age = 25

  console.log('Greeting:', user.actions.greet()) // 'Hello, John!'
  console.log('Realm:', user._internal.realm) // 'app.user'

  user.decay()
})

test('computed properties (getters)', () => {
  class Calculator {
    a = 0
    b = 0

    get sum() {
      return this.a + this.b
    }

    get doubled() {
      return this.sum * 2
    }
  }

  const calc = Atom(Calculator)

  console.log('Initial sum:', calc.state.sum) // 0

  calc.state.a = 10
  calc.state.b = 5

  console.log('Sum:', calc.state.sum) // 15
  console.log('Doubled:', calc.state.doubled) // 30

  calc.decay()
})

test('constructor with args', () => {
  class Counter {
    count: number

    constructor(initial: number) {
      this.count = initial
      console.log('Constructor called with:', initial)
    }

    increment() {
      this.count++
    }
  }

  const counter = Atom(Counter, {
    constructorArgs: [100]
  })

  console.log('Initial count from constructor:', counter.state.count) // 100

  counter.actions.increment()
  console.log('After increment:', counter.state.count) // 101

  counter.decay()
})

test('core direct access', () => {
  const data = Atom({
    value: 42
  })

  console.log('Via state:', data.state.value) // 42
  console.log('Via core:', data.core.value.value) // 42 (quark.value)

  // Subscribe to changes
  data.core.value.up((v: number) => {
    console.log('Value changed to:', v)
  })

  data.state.value = 100 // triggers subscription

  data.decay()
})
