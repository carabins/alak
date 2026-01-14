import { test, expect } from 'bun:test';

import SimpleKeyedArrays from '../src/SimpleKeyedArrays';

test('SimpleKeyedArrays', () => {
  const skv = SimpleKeyedArrays();

  // Test push
  const idx1 = skv.push('key1', 'value1');
  const idx2 = skv.push('key1', 'value2');
  expect(idx1).toBe(0);
  expect(idx2).toBe(1);

  // Test get
  const values = skv.get('key1');
  expect(values).toEqual(['value1', 'value2']);

  // Test size
  expect(skv.size('key1')).toBe(2);

  // Test has
  expect(skv.has('key1')).toBe(true);
  expect(skv.has('nonexistent')).toBe(false);

  // Test forEach
  let forEachResult: any[] = [];
  skv.forEach('key1', (value, index) => {
    forEachResult.push({ value, index });
  });
  expect(forEachResult).toEqual([
    { value: 'value1', index: 0 },
    { value: 'value2', index: 1 }
  ]);

  // Test remove
  skv.remove('key1', 0); // Remove first element
  expect(skv.size('key1')).toBe(1);
  expect(skv.get('key1')).toEqual(['value2']); // With array implementation, remaining element shifts

  // Test clearKey
  skv.push('key1', 'value3');
  skv.clearKey('key1');
  expect(skv.size('key1')).toBe(0);

  // Test clearAll
  skv.push('key1', 'val1');
  skv.push('key2', 'val2');
  skv.clearAll();
  expect(skv.size('key1')).toBe(0);
  expect(skv.size('key2')).toBe(0);
});