import { AtomicModel, getAtomCluster } from 'alak/index'
import { atomicModel } from 'alak/atomicModel'

class submodel extends AtomicModel {
  get thisOne() {
    return this['one'] as number
  }
  get thisId() {
    return this._.id as number
  }
}

class model extends submodel {
  one = 1
  add() {
    this.one++
  }

  getIdMethod() {
    // return this._.id
  }
  oneReturnMethod() {
    return this.thisOne
  }
  constructor(...a) {
    super()
    // console.log('constructor', a)
  }

  onEventHelloWorld(data) {
    console.log(this._.name, 'hi event', data)
  }
}

const a = atomicModel({
  name: 'a',
  model,
})

// console.log(a.state.thisOne)
