import { test, expect } from 'bun:test'
import { coreAtom } from '@alaq/atom/index'

const model = {
  other: 30,
} as Model

class Model {
  state: number
  other = 30
  _somePrivateVar = 3

  get privateOther() {
    return this._somePrivateVar * this.other
  }
}

type FilteredKeys<T> = FilterNotStartingWith<keyof T, '_'>
type NewOrigin<T> = Pick<T, FilteredKeys<T>>
function baseTest(m) {
  m.state.up((v) => {
    expect(v).toBe(10)
  })
  m.state(10)
  expect(m.other.value).toBe(30)
}

test('pure one atom: object ', async () => {
  const m = coreAtom(model)
  baseTest(m)
})

test('pure atom one', async () => {
  const m = coreAtom(Model)
  baseTest(m)
})

test('private model atom ', async () => {
  const m = coreAtom(Model)
  m.privateOther.up((v) => {
    expect(v === 90 || v === 60).toBeTruthy()
  })
  m.other(20)
})
