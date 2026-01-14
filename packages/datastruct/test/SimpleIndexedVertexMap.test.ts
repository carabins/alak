import { test, expect } from 'bun:test';

import SimpleIndexedVertexMap from '../src/IndexedVertexMap/index.simple';

test('SimpleIndexedVertexMap', () => {
  const ivm = SimpleIndexedVertexMap();

  // Test push
  const idx1 = ivm.push('key1', 'value1');
  const idx2 = ivm.push('key1', 'value2');
  expect(idx1).toBe('0');
  expect(idx2).toBe('1');

  // Test get
  const values = ivm.get('key1');
  expect(values).toEqual(['value1', 'value2']);

  // Test size
  expect(ivm.size('key1')).toBe(2);

  // Test has
  expect(ivm.has('key1')).toBe(true);
  expect(ivm.has('nonexistent')).toBe(false);

  // Test forEach
  let forEachResult: any[] = [];
  ivm.forEach('key1', (value, index) => {
    forEachResult.push({ value, index });
  });
  expect(forEachResult).toEqual([
    { value: 'value1', index: '0' },
    { value: 'value2', index: '1' }
  ]);

  // Test remove
  ivm.remove('key1', '0'); // Remove first element
  expect(ivm.size('key1')).toBe(1);
  expect(ivm.get('key1')).toEqual(['value2']); // With array implementation, remaining element shifts

  // Test clearKey
  ivm.push('key1', 'value3');
  ivm.clearKey('key1');
  expect(ivm.size('key1')).toBe(0);

  // Test clearAll
  ivm.push('key1', 'val1');
  ivm.push('key2', 'val2');
  ivm.clearAll();
  expect(ivm.size('key1')).toBe(0);
  expect(ivm.size('key2')).toBe(0);
});