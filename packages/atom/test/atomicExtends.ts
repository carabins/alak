import { Atom } from '@alaq/atom/index'
import { test } from 'tap'

class OldIdea {
  one = 1

  get two() {
    return this.one + 1
  }
}

class NewIdea extends OldIdea {
  n = 'n'

  get N() {
    return this.n
  }
}

const a = Atom({ model: NewIdea })

test('atom extends', (t) => {
  t.equal(a.state.two, 2)
  t.end()
})
