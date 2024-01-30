import ProxyPath from '@alaq/datastruct/ProxyPath'
import { test } from 'tap'

test('ProxyPath', (t) => {
  const p = ProxyPath()
  t.equal(p.l1.l2.l3().join('.'), 'l1.l2.l3')
  t.equal(p.l1().join('.'), 'l1')
  t.end()
})
