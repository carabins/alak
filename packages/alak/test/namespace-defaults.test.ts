import { test } from 'tap'
import { UnionModel, GetUnionCore } from 'alak/index'

// Test 1: UnionModel without parameter uses 'default' namespace
class DefaultModel extends UnionModel {
  count = 0
  name = 'default-model'
}

test('UnionModel without generic parameter uses default namespace', (t) => {
  const uc = GetUnionCore('default')

  uc.addAtom({
    model: DefaultModel,
    name: 'defaultTest'
  })

  t.ok(uc.services.atoms.defaultTest, 'atom created in default namespace')
  t.equal(uc.services.atoms.defaultTest.state.name, 'default-model', 'state accessible')

  t.end()
})

// Test 2: UnionModel with explicit namespace parameter
class ExplicitModel extends UnionModel<'custom'> {
  value = 42
}

test('UnionModel with explicit namespace parameter', (t) => {
  const uc = GetUnionCore('custom')

  uc.addAtom({
    model: ExplicitModel,
    name: 'explicitTest'
  })

  t.ok(uc.services.atoms.explicitTest, 'atom created in custom namespace')
  t.equal(uc.services.atoms.explicitTest.state.value, 42, 'state accessible')

  t.end()
})

// Test 3: Multiple models in different namespaces
class AdminModel extends UnionModel<'admin'> {
  role = 'admin'
}

class PublicModel extends UnionModel<'public'> {
  role = 'guest'
}

test('Multiple models in different namespaces', (t) => {
  const adminUc = GetUnionCore('admin')
  const publicUc = GetUnionCore('public')

  adminUc.addAtom({
    model: AdminModel,
    name: 'dashboard'
  })

  publicUc.addAtom({
    model: PublicModel,
    name: 'landing'
  })

  t.ok(adminUc.services.atoms.dashboard, 'admin atom exists')
  t.ok(publicUc.services.atoms.landing, 'public atom exists')

  t.equal(adminUc.services.atoms.dashboard.state.role, 'admin', 'admin role correct')
  t.equal(publicUc.services.atoms.landing.state.role, 'guest', 'public role correct')

  t.end()
})
