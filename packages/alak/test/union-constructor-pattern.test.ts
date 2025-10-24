import { test } from 'tap'
import { UnionConstructor, UnionModel } from 'alak/index'

class SessionModel extends UnionModel {
  userId = undefined
  isAuthenticated = false

  init() {
    this.userId = 'default-user'
    this.isAuthenticated = true
  }

  login(userId: string) {
    this.userId = userId
    this.isAuthenticated = true
  }

  logout() {
    this.userId = undefined
    this.isAuthenticated = false
  }
}

class ChatSessionModel extends UnionModel {
  messages = []
  activeRoom = undefined

  init() {
    this.activeRoom = 'lobby'
  }

  sendMessage(text: string) {
    this.messages.push({ text, timestamp: Date.now() })
  }
}

test('UnionConstructor with facade destructuring', (t) => {
  const uc = UnionConstructor({
    models: {
      session: SessionModel,
      chat: ChatSessionModel
    }
  })

  // Деструктуризация facade
  const { atoms, cores, states, actions, bus } = uc.facade

  t.ok(atoms, 'atoms exists')
  t.ok(cores, 'cores exists')
  t.ok(states, 'states exists')
  t.ok(actions, 'actions exists')
  t.ok(bus, 'bus exists')

  // Проверка доступа через деструктурированные части
  t.ok(atoms.session, 'atoms.session exists')
  t.ok(cores.session, 'cores.session exists')
  t.ok(states.session, 'states.session exists')
  t.ok(actions.session, 'actions.session exists')

  // Начальные значения
  t.equal(states.session.userId, undefined, 'session.userId is undefined')
  t.equal(states.session.isAuthenticated, false, 'session.isAuthenticated is false')

  // Использование actions
  actions.session.login('user123')
  t.equal(states.session.userId, 'user123', 'userId set via actions')
  t.equal(states.session.isAuthenticated, true, 'isAuthenticated set via actions')

  // Использование cores
  cores.session.userId('user456')
  t.equal(states.session.userId, 'user456', 'userId set via cores')

  t.end()
})

test('Manual initialization after UnionConstructor', (t) => {
  const uc = UnionConstructor({
    namespace: 'initTest',
    models: {
      session: SessionModel,
      chat: ChatSessionModel
    }
  })

  const { atoms, states } = uc.facade

  // ATOM_INIT уже отправлено при создании UnionConstructor
  // Нужно вручную вызывать init() для каждого atom

  // Проверяем начальные значения (до init)
  t.equal(states.session.userId, undefined, 'userId not initialized yet')
  t.equal(states.chat.activeRoom, undefined, 'activeRoom not initialized yet')

  // Вручную инициализируем
  if (atoms.session.actions.init) {
    atoms.session.actions.init()
  }
  if (atoms.chat.actions.init) {
    atoms.chat.actions.init()
  }

  // Проверяем что init() методы были вызваны
  t.equal(states.session.userId, 'default-user', 'session.init() was called')
  t.equal(states.session.isAuthenticated, true, 'session authenticated')
  t.equal(states.chat.activeRoom, 'lobby', 'chat.init() was called')

  t.end()
})

test('TypeScript pattern with typeof uc', (t) => {
  const uc = UnionConstructor({
    namespace: 'tsPattern',
    models: {
      session: SessionModel
    }
  })

  const { atoms, cores, states, actions } = uc.facade

  // Этот паттерн работает:
  // type NS = typeof uc
  // declare module 'alak/namespaces' {
  //   interface ActiveUnions {
  //     tsPattern: NS
  //   }
  // }

  // Проверяем что все части доступны
  t.ok(atoms.session, 'atoms accessible')
  t.ok(cores.session, 'cores accessible')
  t.ok(states.session, 'states accessible')
  t.ok(actions.session, 'actions accessible')

  // Проверяем функциональность
  actions.session.login('test-user')
  t.equal(states.session.userId, 'test-user', 'works after typing')

  t.end()
})

test('Using _on_ATOM_INIT for auto-initialization', (t) => {
  class AutoInitModel extends UnionModel {
    isReady = false

    init() {
      this.isReady = true
    }

    // Автоматически вызывается при ATOM_INIT
    _on_ATOM_INIT() {
      this.init()
    }
  }

  const uc = UnionConstructor({
    namespace: 'autoInit',
    models: {
      auto: AutoInitModel
    }
  })

  const { states } = uc.facade

  // init() был вызван автоматически через _on_ATOM_INIT
  t.equal(states.auto.isReady, true, 'auto-initialized via _on_ATOM_INIT')

  t.end()
})
