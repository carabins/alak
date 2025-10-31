import { test, expect } from 'bun:test'
import { ref, watch } from 'vue'
import { Nucleus, installPlugin } from '@alaq/nucleus/index'
import { ComputedPlugin } from '../src/plugin'
import { VueNucleusPlugin } from '../../vue/src/nucleusPlugin'

// Устанавливаем плагины
installPlugin(ComputedPlugin)
installPlugin(VueNucleusPlugin)

// ============================================================================
// Vue watch + ComputedPlugin интеграция
// ============================================================================

test('vue watch - tracks computed nucleus changes', () => {
  const a = Nucleus(1)
  const b = Nucleus(2)

  const sum = Nucleus()
    .from(a, b)
    .weak((x, y) => x + y)

  const sumRef = sum.toRef()

  let watchCallCount = 0
  let lastValue: number | undefined

  watch(sumRef, (newValue) => {
    watchCallCount++
    lastValue = newValue
  })

  expect(sumRef.value).toBe(3)

  a(5)
  setTimeout(() => {
    expect(sumRef.value).toBe(7)
    expect(watchCallCount).toBe(1)
    expect(lastValue).toBe(7)

    b(10)
    setTimeout(() => {
      expect(sumRef.value).toBe(15)
      expect(watchCallCount).toBe(2)
      expect(lastValue).toBe(15)
    }, 10)
  }, 10)
})

test('vue watch - tracks async computed nucleus', () => {
  const input = Nucleus(10)

  const doubled = Nucleus()
    .from(input)
    .weak(async (x) => {
      await new Promise(resolve => setTimeout(resolve, 5))
      return x * 2
    })

  const doubledRef = doubled.toRef()

  let watchCallCount = 0

  watch(doubledRef, (newValue) => {
    watchCallCount++
    expect(newValue).toBeTruthy()
  })

  // Даем время на первый async compute
  setTimeout(() => {
    expect(doubledRef.value).toBe(20)
    expect(watchCallCount).toBe(1)

    input(15)

    setTimeout(() => {
      expect(doubledRef.value).toBe(30)
      expect(watchCallCount).toBe(2)
    }, 20)
  }, 20)
})

test('vue watch - immediate mode with computed', () => {
  const count = Nucleus(5)

  const doubled = Nucleus()
    .from(count)
    .weak(x => x * 2)

  const doubledRef = doubled.toRef()

  let immediateValue: number | undefined

  watch(doubledRef, (newValue) => {
    immediateValue = newValue
  }, { immediate: true })

  expect(immediateValue).toBe(10)

  count(7)
  setTimeout(() => {
    expect(immediateValue).toBe(14)
  }, 10)
})

test('vue watch - chain of computed with refs', () => {
  const input = Nucleus(2)

  const doubled = Nucleus()
    .from(input)
    .weak(x => x * 2)

  const tripled = Nucleus()
    .from(doubled)
    .weak(x => x * 3)

  const inputRef = input.toReactive()
  const tripledRef = tripled.toRef()

  let watchCalls = 0

  watch(tripledRef, () => {
    watchCalls++
  })

  expect(tripledRef.value).toBe(12)

  // Изменяем через Vue ref
  inputRef.value = 3
  setTimeout(() => {
    expect(tripledRef.value).toBe(18)
    expect(watchCalls).toBe(1)

    inputRef.value = 4
    setTimeout(() => {
      expect(tripledRef.value).toBe(24)
      expect(watchCalls).toBe(2)
    }, 10)
  }, 10)
})

test('vue watch - multiple computed sources', () => {
  const firstName = Nucleus('John')
  const lastName = Nucleus('Doe')
  const age = Nucleus(30)

  const profile = Nucleus()
    .from(firstName, lastName, age)
    .weak((first, last, a) => `${first} ${last}, ${a} years old`)

  const firstNameRef = firstName.toReactive()
  const lastNameRef = lastName.toReactive()
  const profileRef = profile.toRef()

  let watchValues: string[] = []

  watch(profileRef, (newValue) => {
    watchValues.push(newValue)
  })

  expect(profileRef.value, 'John Doe, 30 years old')

  firstNameRef.value = 'Jane'
  setTimeout(() => {
    expect(profileRef.value, 'Jane Doe, 30 years old')
    expect(watchValues.length).toBe(1)

    lastNameRef.value = 'Smith'
    setTimeout(() => {
      expect(profileRef.value)
      expect(watchValues.length).toBe(2)
      expect(watchValues).toEqual([
        'Jane Doe, 30 years old',
        'Jane Smith, 30 years old'
      ])
    }, 10)
  }, 10)
})

test('vue watch - stop watching computed', () => {
  const count = Nucleus(0)

  const doubled = Nucleus()
    .from(count)
    .weak(x => x * 2)

  const doubledRef = doubled.toRef()

  let watchCalls = 0

  const stopWatch = watch(doubledRef, () => {
    watchCalls++
  })

  count(5)
  setTimeout(() => {
    expect(watchCalls).toBe(1)

    // Останавливаем watcher
    stopWatch()

    count(10)
    setTimeout(() => {
      expect(watchCalls).toBe(1)
      expect(doubledRef.value).toBe(20)
    }, 10)
  }, 10)
})

test('vue watch - deep watch with computed objects', () => {
  const user = Nucleus({ name: 'John', age: 30 })

  const profile = Nucleus()
    .from(user)
    .weak(u => ({ ...u, ageInMonths: u.age * 12 }))

  const profileRef = profile.toRef()

  let watchCalls = 0
  let lastProfile: any

  watch(profileRef, (newValue) => {
    watchCalls++
    lastProfile = newValue
  }, { deep: true })

  expect(profileRef.value).toEqual({ name: 'John', age: 30, ageInMonths: 360 })

  user({ name: 'Jane', age: 25 })
  setTimeout(() => {
    expect(watchCalls).toBe(1)
    expect(lastProfile).toEqual({ name: 'Jane', age: 25, ageInMonths: 300 })
    expect(profileRef.value.ageInMonths).toBe(300)
  }, 10)
})

test('vue watch - computed with external ref sync', () => {
  const price = Nucleus(100)
  const quantity = Nucleus(2)

  const total = Nucleus()
    .from(price, quantity)
    .weak((p, q) => p * q)

  const totalRef = total.toRef()

  let watchCalls = 0

  // Создаем watch ДО синхронизации
  watch(totalRef, () => {
    watchCalls++
  })

  expect(totalRef.value).toBe(200)

  // Синхронизируем price с внешним ref после создания watch
  const externalPrice = ref(150)
  price.syncWith(externalPrice)

  setTimeout(() => {
    expect(price()).toBe(150)
    expect(totalRef.value).toBe(300)
    expect(watchCalls).toBe(1)

    externalPrice.value = 200
    setTimeout(() => {
      expect(totalRef.value).toBe(400)
      expect(watchCalls).toBe(2)
    }, 10)
  }, 10)
})

test('vue watch - cleanup on nucleus decay', () => {
  const source = Nucleus(10)

  const computed = Nucleus()
    .from(source)
    .weak(x => x * 2)

  const computedRef = computed.toRef()

  let watchCalls = 0

  watch(computedRef, () => {
    watchCalls++
  })

  source(20)
  setTimeout(() => {
    expect(watchCalls).toBe(1)

    // Decay computed nucleus
    computed.decay()

    // Ref должен сохранить последнее значение
    expect(computedRef.value).toBe(40)

    // Изменение source не должно вызывать watch
    source(30)
    setTimeout(() => {
      expect(watchCalls).toBe(1)
      expect(computedRef.value).toBe(40)
    }, 10)
  }, 10)
})

test('vue watch - watchEffect with computed', () => {
  const { watchEffect } = require('vue')

  const a = Nucleus(1)
  const b = Nucleus(2)

  const sum = Nucleus()
    .from(a, b)
    .weak((x, y) => x + y)

  const sumRef = sum.toRef()

  let effectCalls = 0
  let lastSum = 0

  const stopEffect = watchEffect(() => {
    effectCalls++
    lastSum = sumRef.value
  })

  // watchEffect вызывается сразу
  expect(effectCalls).toBe(1)
  expect(lastSum).toBe(3)

  a(5)
  setTimeout(() => {
    expect(effectCalls).toBe(2)
    expect(lastSum).toBe(7)

    stopEffect()

    b(10)
    setTimeout(() => {
      expect(effectCalls).toBe(2)
    }, 10)
  }, 10)
})
