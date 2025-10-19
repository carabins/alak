import {UnionModel} from "alak/index";
import {UnionConstructor} from "alak/UnionConstructor";

console.log('+++++')

class LocalListenerModel extends UnionModel<any> {
  count = 0
  name = 'initial'

  countChanged = false
  lastCount = null
  nameChanged = false
  lastName = null

  // Слушатель для собственного нуклеона count
  _count_next(value) {
    console.log(":::::::", value)
    this.countChanged = true
    this.lastCount = value
  }

  // Слушатель для собственного нуклеона name
  _name(value) {
    this.nameChanged = true
    this.lastName = value
  }
}

UnionConstructor({
  namespace: 'xasd',
  models: { a: LocalListenerModel },
})

const uc = UnionConstructor({
  namespace: 'localTest',
  models: { test: LocalListenerModel },
})

UnionConstructor({
  namespace: 'ddd',
  models: { a: LocalListenerModel },
})
// t.plan(4)
// Изменяем count
const {atoms, cores, states} = uc.facade
cores.test.count(5)
console.log(states.test.count)
// t.ok(facade.states.test.countChanged, 'count listener triggered')
// t.equal(facade.states.test.lastCount, 5, 'count value passed correctly')
//
// // Изменяем name
// facade.atoms.test.core.name('updated')
// t.ok(facade.states.test.nameChanged, 'name listener triggered')
// t.equal(facade.states.test.lastName, 'updated', 'name value passed correctly')

console.log(":+++:", {cores})
