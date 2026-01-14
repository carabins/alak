import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'

const debugPlugin = {
  symbol: Symbol('debug'),
  wrapState(originalState: any, atom: any) {
    console.log('originalState type:', typeof originalState);
    console.log('originalState keys:', Object.keys(originalState));
    console.log('originalState.count:', originalState.count);
    console.log('originalState.msg:', originalState.msg);
    
    // Now let's try creating a proxy similar to my implementation
    const testProxy = new Proxy({}, {
      get(target, key: string) {
        console.log('Proxy get called for key:', key);
        const value = originalState[key];
        console.log('Value from originalState[', key, ']:', value);
        return value;
      },
      set(target, key: string, newValue) {
        console.log('Proxy set called for key:', key, 'with value:', newValue);
        originalState[key] = newValue;
        return true;
      }
    });
    
    return testProxy;
  }
};

test('Debug original state', () => {
  const atom = Atom(
    { count: 0, msg: 'Hello' },
    { plugins: [debugPlugin] }
  );
  
  console.log('atom.state.count:', atom.state.count);
  console.log('atom.state.msg:', atom.state.msg);
  
  expect(atom.state.count).toBe(0);
  expect(atom.state.msg).toBe('Hello');
});