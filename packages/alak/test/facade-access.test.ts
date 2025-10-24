import { test } from 'tap'
import { GetUnionCore } from 'alak/index'

class TestModel {
  count = 0
  name = 'test'

  increment() {
    this.count++
  }
}

test('facade access patterns', (t) => {
  const uc = GetUnionCore('facade-test')

  // Добавляем atom
  uc.addAtom({
    model: TestModel,
    name: 'counter'
  })

  // Проверяем разные паттерны доступа

  // 1. facade.counterCore -> atom.core
  t.ok(uc.facade.counterCore, 'facade.counterCore exists')
  t.equal(uc.facade.counterCore.count.value, 0, 'facade.counterCore.count.value works')

  // 2. facade.counterState -> atom.state
  t.ok(uc.facade.counterState, 'facade.counterState exists')
  t.equal(uc.facade.counterState.count, 0, 'facade.counterState.count works')

  // 3. facade.counterAtom -> atom
  t.ok(uc.facade.counterAtom, 'facade.counterAtom exists')
  t.equal(uc.facade.counterAtom.state.count, 0, 'facade.counterAtom.state.count works')

  // 4. facade.counterBus -> atom.bus
  t.ok(uc.facade.counterBus, 'facade.counterBus exists')

  // 5. facade.cores.counter -> atom.core
  t.ok(uc.facade.cores, 'facade.cores exists')
  t.ok(uc.facade.cores.counter, 'facade.cores.counter exists')
  t.equal(uc.facade.cores.counter.count.value, 0, 'facade.cores.counter.count.value works')

  // 6. facade.states.counter -> atom.state
  t.ok(uc.facade.states, 'facade.states exists')
  t.ok(uc.facade.states.counter, 'facade.states.counter exists')
  t.equal(uc.facade.states.counter.count, 0, 'facade.states.counter.count works')

  // 7. facade.actions.counter -> atom.actions
  t.ok(uc.facade.actions, 'facade.actions exists')
  t.ok(uc.facade.actions.counter, 'facade.actions.counter exists')
  t.ok(typeof uc.facade.actions.counter.increment === 'function', 'facade.actions.counter.increment is a function')

  // Изменяем через counterCore
  uc.facade.counterCore.count(10)
  t.equal(uc.facade.counterState.count, 10, 'value changed via counterCore')

  // Вызываем метод
  uc.facade.actions.counter.increment()
  t.equal(uc.facade.counterState.count, 11, 'value changed via actions.counter.increment')

  t.end()
})

test('facade with multiple atoms', (t) => {
  const uc = GetUnionCore('multi-facade-test')

  uc.addAtom({ model: TestModel, name: 'counter' })
  uc.addAtom({ model: TestModel, name: 'tracker' })

  // Оба должны работать
  t.ok(uc.facade.counterCore, 'counterCore exists')
  t.ok(uc.facade.trackerCore, 'trackerCore exists')

  t.ok(uc.facade.counterState, 'counterState exists')
  t.ok(uc.facade.trackerState, 'trackerState exists')

  // Проверяем что они независимы
  uc.facade.counterCore.count(5)
  uc.facade.trackerCore.count(10)

  t.equal(uc.facade.counterState.count, 5, 'counter has 5')
  t.equal(uc.facade.trackerState.count, 10, 'tracker has 10')

  t.end()
})
