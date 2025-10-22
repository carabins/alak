import {test} from 'tap'
import {UnionModel} from 'alak/index'
import {vueController} from '../src/vueController'

class model extends UnionModel<any> {
  one = 1
  two: number

  doIt() {
    this.two = 2
  }

  _one_up(v) {
    console.log({v})
    this.two = this.two * v
  }

  setA20() {
    this._.cores.a.one(10)
  }
}

test('vue constructor', (t) => {
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
  t.ok(a.state.one == 1)
  a.core.doIt()
  t.ok(a.state.two == 2)
  b.core.setA20()
  t.ok(a.state.one == 10)
  t.ok(a.state.two == 20)
  a.state.two = 2
  t.ok(a.core.two.value == 2)

  t.end()
})
