
import { UnionModel, GetUnionCore, Q } from 'alak/index'

// 1. Создайте модель
class CounterModel extends UnionModel {
  count = 0
  countX10 = 0

  increment() {
    this.count++
  }

  _count_up(v){
    this.countX10 = v*10
  }

  _on_INIT(){
    this.count = 1
  }
  _on_SET_COUNT(v){
    this.count = v
  }
}

// 2. Зарегистрируйте в union
const union = GetUnionCore('default')
union.addAtom({ model: CounterModel, name: 'counter' })

// 3. Используйте через Q
const core = Q('counterCore')
const actions = Q('counterActions')

core.countX10.up(value => console.log('Count:', value))
actions.increment()
union.bus.dispatchEvent("SET_COUNT", 0)
core.count(10)
