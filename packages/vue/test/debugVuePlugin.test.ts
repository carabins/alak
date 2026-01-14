import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom'
import { track, trigger, TrackOpTypes, TriggerOpTypes } from '@vue/reactivity'

const debugVuePlugin = {
  symbol: Symbol('debug-vue'),
  wrapState(originalState: any, atom: any) {
    const vueReactiveTarget = {}
    
    // Subscribe to atom's bus
    const allKeys = [
      ...Object.keys(atom._internal.properties || {}), 
      ...Object.keys(atom._internal.computed || {})
    ];
    
    const unsubscribe = atom.bus.on('NUCLEUS_CHANGE', ({ key, value }: { key: string, value: any }) => {
      console.log(`NUCLEUS_CHANGE event: ${key} = ${value}`);
      if (allKeys.includes(key)) {
        trigger(vueReactiveTarget, TriggerOpTypes.SET, key, value, originalState[key])
        console.log(`Triggered Vue reactivity for ${key}`);
      }
    });
    
    // Create proxy with Vue tracking
    const vueProxy = new Proxy({}, {
      get(target, key: string | symbol) {
        console.log('Proxy get called for key:', key);
        
        // Vue internal flags
        if (key === '__v_isReactive') return true
        if (key === '__v_isReadonly') return false
        if (key === '__v_isShallow') return false
        if (key === '__v_raw') return originalState
        if (key === '__v_skip') return false

        // Track access for Vue reactivity
        console.log('Tracking access for Vue reactivity');
        track(vueReactiveTarget, TrackOpTypes.GET, key)

        // For symbols, we can return from original state
        if (typeof key === 'symbol') {
          return originalState[key]
        }

        // For regular properties, return from original state
        const value = originalState[key as string]
        console.log('Value from originalState[', key, ']:', value);
        return value
      },
      
      set(target, key: string, newValue: any) {
        const oldValue = originalState[key as string]
        console.log('Setting', key, 'from', oldValue, 'to', newValue);

        // Update the original state
        originalState[key as string] = newValue

        // Trigger Vue updates
        trigger(vueReactiveTarget, TriggerOpTypes.SET, key, newValue, oldValue)

        return true
      }
    });
    
    return vueProxy;
  }
};

test('Debug Vue reactivity plugin', () => {
  const atom = Atom(
    { count: 0, msg: 'Hello' },
    { plugins: [debugVuePlugin] }
  );
  
  console.log('atom.state.count:', atom.state.count);
  console.log('atom.state.msg:', atom.state.msg);
  
  expect(atom.state.count).toBe(0);
  expect(atom.state.msg).toBe('Hello');
  
  // Test setting values
  atom.state.count = 5;
  expect(atom.state.count).toBe(5);
});