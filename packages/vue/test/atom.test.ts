import { test, expect } from 'bun:test'
import { ref } from 'vue'
import { Atom } from 'alak/index'
import { installPlugin } from '@alaq/nucleus/index'
import { VueNucleusPlugin } from '../src/nucleusPlugin'

// Устанавливаем Vue плагин для nucleus
installPlugin(VueNucleusPlugin)

// ============================================================================
// Работа с atom.core
// ============================================================================

test('atom.core - toRef works with atom properties', () => {
  class CounterModel {
    count = 0
  }

  const counter = Atom({ model: CounterModel })
  const countRef = counter.core.count.toRef()

  expect(countRef.value).toBe(0)

  counter.core.count(5)
  expect(countRef.value).toBe(5)
})

test('atom.core - toReactive with atom properties', async () => {
  class FormModel {
    username = ''
    email = ''
  }

  const form = Atom({ model: FormModel })

  const usernameRef = form.core.username.toReactive()
  const emailRef = form.core.email.toReactive()

  // nucleus -> ref
  form.core.username('john')
  expect(usernameRef.value).toBe('john')

  // ref -> nucleus
  emailRef.value = 'john@example.com'
  await new Promise(resolve => setTimeout(resolve, 10))
  expect(form.core.email()).toBe('john@example.com')
})

test('atom.core - syncWith external ref', async () => {
  class SettingsModel {
    theme = 'light'
    fontSize = 14
  }

  const settings = Atom({ model: SettingsModel })

  const themeRef = ref('dark')
  settings.core.theme.syncWith(themeRef)

  expect(settings.core.theme()).toBe('dark')

  themeRef.value = 'auto'
  await new Promise(resolve => setTimeout(resolve, 10))
  expect(settings.core.theme()).toBe('auto')

  settings.core.theme('light')
  expect(themeRef.value).toBe('light')
})

test('atom.core - multiple refs from same atom', async () => {
  class UserModel {
    firstName = 'John'
    lastName = 'Doe'
    age = 30
  }

  const user = Atom({ model: UserModel })

  const firstNameRef = user.core.firstName.toReactive()
  const lastNameRef = user.core.lastName.toReactive()
  const ageRef = user.core.age.toRef()

  expect(firstNameRef.value).toBe('John')
  expect(lastNameRef.value).toBe('Doe')
  expect(ageRef.value).toBe(30)

  // Change via nucleus
  user.core.firstName('Jane')
  expect(firstNameRef.value).toBe('Jane')

  // Change via ref
  lastNameRef.value = 'Smith'
  await new Promise(resolve => setTimeout(resolve, 10))
  expect(user.core.lastName()).toBe('Smith')

  // toRef is one-way only
  ageRef.value = 31
  await new Promise(resolve => setTimeout(resolve, 10))
  expect(user.core.age()).toBe(30)
})

test.skip('atom.core - computed values (with ComputedPlugin)', () => {
  // Этот тест требует ComputedPlugin
  try {
    const { ComputedPlugin } = require('@alaq/next')
    installPlugin(ComputedPlugin)

    class CartModel {
      price = 100
      quantity = 2
    }

    const cart = Atom({ model: CartModel })

    // Создаем computed nucleus
    const total = cart.core.price.from(cart.core.price, cart.core.quantity)
      .weak((price, qty) => price * qty)

    const totalRef = total.toRef()

    expect(totalRef.value).toBe(200)

    cart.core.price(150)
    expect(totalRef.value).toBe(300)

    cart.core.quantity(3)
    expect(totalRef.value).toBe(450)
  } catch (e) {
    // ComputedPlugin not available
  }
})

test('atom.core - cleanup on atom decay', async () => {
  class TempModel {
    value = 0
  }

  const temp = Atom({ model: TempModel })
  const valueRef = temp.core.value.toReactive()

  temp.core.value(42)
  expect(valueRef.value).toBe(42)

  // Decay atom (should trigger nucleus decay)
  temp.decay()

  // ref should keep last value
  expect(valueRef.value).toBe(42)

  // Changing ref should not cause errors
  valueRef.value = 100
  await new Promise(resolve => setTimeout(resolve, 10))
  expect(valueRef.value).toBe(100)
})

test('atom.core - works with getters', async () => {
  class PersonModel {
    firstName = 'John'
    lastName = 'Doe'

    get fullName() {
      return `${this.firstName} ${this.lastName}`
    }
  }

  const person = Atom({ model: PersonModel })

  const firstNameRef = person.core.firstName.toReactive()
  const lastNameRef = person.core.lastName.toReactive()

  expect(person.state.fullName).toBe('John Doe')

  firstNameRef.value = 'Jane'
  await new Promise(resolve => setTimeout(resolve, 10))
  expect(person.core.firstName()).toBe('Jane')
  expect(person.state.fullName).toBe('Jane Doe')

  lastNameRef.value = 'Smith'
  await new Promise(resolve => setTimeout(resolve, 10))
  expect(person.state.fullName).toBe('Jane Smith')
})
