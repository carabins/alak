import ProxyPath from '@alaq/datastruct/ProxyPath'
import { test, expect } from 'bun:test'

test('ProxyPath', () => {
  const p = ProxyPath()
  expect(p.l1.l2.l3().join('.')).toBe('l1.l2.l3')
  expect(p.l1().join('.')).toBe('l1')
})
