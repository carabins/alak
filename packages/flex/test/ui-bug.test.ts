import { test, expect } from 'bun:test'
import { Button } from '@pixi/ui'
import { Container } from 'pixi.js'

test('Pixi Container has .on', () => {
  const c = new Container();
  expect(typeof c.on).toBe('function');
})

test('Pixi UI Button with explicit view', () => {
  try {
    const view = new Container();
    console.log('View created, has .on:', typeof view.on);
    const btn = new Button({ view, text: 'Test' });
    expect(btn).toBeDefined();
  } catch (e) {
    console.error(e);
    throw e;
  }
})