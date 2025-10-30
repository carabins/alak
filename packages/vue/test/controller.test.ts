import {test, expect} from 'bun:test'
import {UnionModel} from 'alak/index'
import {vueController} from '../src/vueController'

class model extends UnionModel<any> {
  one = 1
  two: number
  three: number

  doIt() {
    this.two = 2
  }

  _one_up(v) {
    this.two = this.two * v
  }

  setA20() {
    this._.cores.a.one(10)
  }
  _$a_one_up(v) {
    this.three = 3 * v
  }
}

test('vue constructor', () => {
  const a = vueController({
    name: "a", model,
    namespace: 'vue_test',
    sync: true
  })()

  const b = vueController({
    name: "b", model,
    namespace: 'vue_test',
  })()

  // console.log(a.state)
  expect(a.state.one == 1).toBeTruthy()
  a.core.doIt()
  expect(a.state.two == 2).toBeTruthy()
  b.core.setA20()
  expect(a.state.one == 10).toBeTruthy()
  expect(a.state.two == 20).toBeTruthy()
  a.state.two = 2

  expect(a.core.two.value == 2).toBeTruthy()
  a.core.one(10)
  expect(b.state.three).toBe(30)
})

