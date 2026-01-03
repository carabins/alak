import {test} from 'bun:test'
import {Qu, Qv} from '../src/index'
import {DEDUP, STATELESS} from "@alaq/quark/flags";

test('Coverage: createQu - все опции', () => {
  const empty = Qu()
  if (empty.value !== undefined) throw new Error('Empty quark should be undefined')

  const withValue = Qu({value: 42})
  if (withValue.value !== 42) throw new Error('Should have value 42')

  const withRealm = Qu({realm: 'test'})
  if ((withRealm as any).realm !== 'test') throw new Error('Should have realm')

  const withId = Qu({id: 'my-id'})
  if (withId.id !== 'my-id') throw new Error('Should have id')

  const withDedup = Qu({dedup: true})
  if (!((withDedup as any)._flags & DEDUP)) throw new Error('Should have DEDUP flag')

  const withStateless = Qu({stateless: true})
  if (!((withStateless as any)._flags & STATELESS)) throw new Error('Should have STATELESS flag')

  const withPipe = Qu<number>({pipe: (v) => v * 2})
  if (!(withPipe as any)._pipeFn) throw new Error('Should have pipe function')

  const full = Qu({
    value: 10,
    realm: 'full',
    id: 'full-id',
    dedup: true,
    stateless: true,
    pipe: (v) => v * 2
  })
  if ((full as any).realm !== 'full') throw new Error('Full options failed')
})

test('Coverage: Qv alias', () => {
  const q1 = Qv()
  if (q1.value !== undefined) throw new Error('Qv() should be empty')

  const q2 = Qv(42)
  if (q2.value !== 42) throw new Error('Qv(42) should have value')

  const q3 = Qv(10, {realm: 'test', dedup: true})
  if (q3.value !== 10) throw new Error('Qv with options should work')
  if ((q3 as any).realm !== 'test') throw new Error('Qv should pass options')
})

test('Coverage: setValue - pipe reject', () => {
  const q = Qu({value: 10})
  q.pipe((value) => {
    if (value < 0) return undefined
    return value
  })

  q(-5)
  if (q.value !== 10) throw new Error('Pipe should reject negative value')

  q(20)
  //@ts-ignore
  if (q.value !== 20) throw new Error('Pipe should accept positive value')
})

test('Coverage: setValue - dedup', () => {
  const q = Qv(10, {dedup: true})
  let callCount = 0
  q.up(() => callCount++)

  q(10)
  if (callCount !== 1) throw new Error('Dedup should prevent duplicate')

  q(20)
  //@ts-ignore
  if (callCount !== 2) throw new Error('Dedup should allow different value')
})

test('Coverage: setValue - stateless', () => {
  const q = Qu({stateless: true})
  q(10)
  if (q.value !== undefined) throw new Error('Stateless should not store value')

  q(20)
  if (q.value !== undefined) throw new Error('Stateless should not store value')
})



test('Coverage: setValue - fast paths', () => {
  const q1 = Qu({value: 0})
  q1(10)
  if (q1.value !== 10) throw new Error('Fast path WAS_SET failed')

  const q2 = Qu({value: 0})
  let called = false
  q2.up(() => {
    called = true
  })
  q2(20)
  if (!called) throw new Error('Fast path HAS_LISTENERS failed')
})

test('Coverage: up - немедленный вызов с существующим значением', () => {
  const q = Qu({value: 42})
  let receivedValue: any = null
  let receivedQuark: any = null

  q.up((value, quark) => {
    receivedValue = value
    receivedQuark = quark
  })

  if (receivedValue !== 42) throw new Error('up should call with existing value')
  if (receivedQuark !== q) throw new Error('up should pass quark')
})

test('Coverage: up - без существующего значения', () => {
  const q = Qu()
  let called = false
  q.up(() => {
    called = true
  })

  if (called) throw new Error('up should not call without value')

  q(10)
  if (!called) throw new Error('up should call after setValue')
})

test('Coverage: down - удаление listener', () => {
  const q = Qu({value: 0})
  let count = 0
  const listener = () => count++

  q.up(listener)
  q(1)

  q.down(listener)
  q(2)

  if (count !== 2) throw new Error('down should remove listener')
})

test('Coverage: silent', () => {
  const q = Qu()
  let count = 0
  q.up(() => count++)

  q.silent(10)
  q.silent(20)

  if (count !== 0) throw new Error('silent should prevent notifications')
  if (q.value !== 20) throw new Error('silent should still set value')

  q(30)
  //@ts-ignore
  if (count !== 1) throw new Error('After silent, notifications should work')
})




test('Coverage: pipe метод', () => {
  const q = Qu({value: 10})

  q.pipe((v) => v * 2)
  q(5)
  if (q.value !== 10) throw new Error('pipe method should transform')
})

test('Coverage: dedup метод', () => {
  const q = Qu({value: 0})
  let count = 0
  q.up(() => count++)

  q.dedup(true)
  q(5)
  q(5)
  if (count !== 2) throw new Error('dedup(true) should work')

  q.dedup(false)
  q(5)
  //@ts-ignore
  if (count !== 3) throw new Error('dedup(false) should work')
})

test('Coverage: stateless метод', () => {
  const q = Qu({value: 10})

  q.stateless(true)
  q(20)
  if (q.value !== 10) throw new Error('stateless(true) should not store value')

  q.stateless(false)
  q(30)
  //@ts-ignore
  if (q.value !== 30) throw new Error('stateless(false) should store value')
})



test('Coverage: комбинированные флаги', () => {
  const q = Qu({
    value: 10,
    realm: 'test',
    dedup: true,
    stateless: true,
    pipe: (v) => v < 0 ? undefined : v
  })

  let count = 0
  q.up(() => count++)

  q(10)
  if (count !== 1) throw new Error('Dedup should prevent')

  q(20)
  //@ts-ignore
  if (count !== 2) throw new Error('Listener should be called')
  if (q.value !== 10) throw new Error('Stateless should not update value')

  q(-5)
  if (count !== 2) throw new Error('Pipe should reject')
})
