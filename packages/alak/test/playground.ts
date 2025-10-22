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

  betweenOne = 1
  betweenTwo = 2

  _$a_betweenOne_up(v) {
    console.log('+_$a_betweenOne_up',v, this._modelName)
    this.betweenTwo = v
  }

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


const uc = UnionConstructor({
  namespace: 'same',
  models: {
    a: LocalListenerModel,
    b: LocalListenerModel
  },
})
// t.plan(4)
// Изменяем count
const {atoms, cores, states} = uc.facade

cores.a.betweenOne(10)
cores.a.betweenOne(20)
console.log(states.b.betweenTwo)
console.log("a.betweenOne uid", cores.a.betweenOne.uid)
// console.log("b.betweenOne uid", cores.b.betweenOne.uid)
// console.log("a.betweenTwo uid", cores.a.betweenTwo.uid)
console.log("b.betweenTwo uid", cores.b.betweenTwo.uid)


