import { test } from 'tap'
import { Q, QRealm, GetUnionCore } from 'alak/index'

class CounterModel {
  count = 0
  name = 'counter'

  increment() {
    this.count++
  }

  decrement() {
    this.count--
  }
}

class AdminModel {
  role = 'admin'
  permissions = ['read', 'write']
}

test('Q injector with suffixes', (t) => {
  const uc = GetUnionCore('default')

  uc.addAtom({
    model: CounterModel,
    name: 'counter'
  })

  // Test full bundle (no suffix)
  const bundle = Q('counter')
  t.ok(bundle.atom, 'bundle has atom')
  t.ok(bundle.core, 'bundle has core')
  t.ok(bundle.state, 'bundle has state')
  t.ok(bundle.actions, 'bundle has actions')
  t.type(bundle.state, 'function', 'state is a function')

  // Test Atom suffix
  const atom = Q('counterAtom')
  t.ok(atom, 'counterAtom returns atom')
  t.equal(atom.state.count, 0, 'atom.state.count is 0')

  // Test Core suffix
  const core = Q('counterCore')
  t.ok(core, 'counterCore returns core')
  t.ok(core.count, 'core has count nucleus')
  t.equal(core.count.value, 0, 'core.count.value is 0')

  // Test State suffix
  const state = Q('counterState')
  t.type(state, 'function', 'counterState returns function')
  t.equal(state().count, 0, 'state().count is 0')
  t.equal(state().name, 'counter', 'state().name is counter')

  // Test Actions suffix
  const actions = Q('counterActions')
  t.ok(actions, 'counterActions returns actions')
  t.type(actions.increment, 'function', 'actions.increment is a function')
  t.type(actions.decrement, 'function', 'actions.decrement is a function')

  // Test actions work
  actions.increment()
  t.equal(atom.state.count, 1, 'count incremented to 1')

  t.end()
})

test('QRealm for different namespace', (t) => {
  const adminUc = GetUnionCore('admin')

  adminUc.addAtom({
    model: AdminModel,
    name: 'dashboard'
  })

  // Create Q for admin namespace
  const AdminQ = QRealm('admin')

  // Test full bundle
  const bundle = AdminQ('dashboard')
  t.ok(bundle.atom, 'admin bundle has atom')
  t.ok(bundle.core, 'admin bundle has core')
  t.ok(bundle.state, 'admin bundle has state')
  t.ok(bundle.actions, 'admin bundle has actions')

  // Test suffixes
  const atom = AdminQ('dashboardAtom')
  t.ok(atom, 'dashboardAtom returns atom')
  t.equal(atom.state.role, 'admin', 'atom.state.role is admin')

  const core = AdminQ('dashboardCore')
  t.ok(core.role, 'core has role nucleus')
  t.equal(core.role.value, 'admin', 'core.role.value is admin')

  const state = AdminQ('dashboardState')
  t.type(state, 'function', 'dashboardState returns function')
  t.equal(state().role, 'admin', 'state().role is admin')

  t.end()
})

test('Q.realm() method', (t) => {
  const publicUc = GetUnionCore('public')

  class LandingModel {
    title = 'Welcome'
  }

  publicUc.addAtom({
    model: LandingModel,
    name: 'landing'
  })

  // Use Q.realm() to create namespace-specific Q
  const PublicQ = Q.realm('public')

  const atom = PublicQ('landingAtom')
  t.ok(atom, 'PublicQ.landingAtom returns atom')
  t.equal(atom.state.title, 'Welcome', 'atom.state.title is Welcome')

  const core = PublicQ('landingCore')
  t.ok(core.title, 'core has title nucleus')

  t.end()
})
