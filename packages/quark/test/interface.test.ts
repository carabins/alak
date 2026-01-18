import { test, expect } from 'bun:test'
import { Qu, Qv, IQ } from '../src/index'

test('Quark should have __q flag', () => {
  const q = Qu()
  // @ts-ignore
  expect(q.__q).toBe(true)
})

test('Qv should have __q flag', () => {
  const q = Qv(1)
  // @ts-ignore
  expect(q.__q).toBe(true)
})

test('Duck typing vs Flag check performance', () => {
  const q = Qu()
  const ITERATIONS = 1_000_000

  // 1. Duck Typing
  const startDuck = performance.now()
  for (let i = 0; i < ITERATIONS; i++) {
    const isQuark = typeof q === 'function' && 'up' in q && 'down' in q
  }
  const endDuck = performance.now()

  // 2. Flag Check
  const startFlag = performance.now()
  for (let i = 0; i < ITERATIONS; i++) {
    // @ts-ignore
    const isQuark = q.__q === true
  }
  const endFlag = performance.now()

  console.log(`Duck Typing: ${(endDuck - startDuck).toFixed(2)}ms`)
  console.log(`Flag Check:  ${(endFlag - startFlag).toFixed(2)}ms`)

  expect(endFlag - startFlag).toBeLessThan(endDuck - startDuck)
})
