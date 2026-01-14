import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'
import { AtomicStatePlugin } from '../src/atomic-state'

test('Test AtomicStatePlugin directly', () => {
  const atom = Atom(
    { count: 0, msg: 'Hello' },
    { plugins: [AtomicStatePlugin] }
  );
  
  console.log('atom.state.count:', atom.state.count);
  console.log('atom.state.msg:', atom.state.msg);
  console.log('__v_isReactive:', (atom.state as any).__v_isReactive);
  
  expect(atom.state.count).toBe(0);
  expect(atom.state.msg).toBe('Hello');
  expect((atom.state as any).__v_isReactive).toBe(true);
  
  // Test setting values
  atom.state.count = 5;
  expect(atom.state.count).toBe(5);
});