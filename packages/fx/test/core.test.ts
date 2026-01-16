import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fx, Subscribable } from '../src';

// Simple Mock Source
class MockSource<T> implements Subscribable<T> {
  private listeners = new Set<(val: T) => void>();
  constructor(public value: T) {}

  up(listener: (val: T) => void) {
    this.listeners.add(listener);
  }

  down(listener: (val: T) => void) {
    this.listeners.delete(listener);
  }

  emit(val: T) {
    this.value = val;
    this.listeners.forEach(fn => fn(val));
  }
}

describe('fx core', () => {
  it('should subscribe and unsubscribe', () => {
    const source = new MockSource(0);
    const listener = vi.fn();

    const dispose = fx(source).up(listener);
    
    source.emit(1);
    expect(listener).toHaveBeenCalledWith(1);

    dispose();
    source.emit(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should map values', () => {
    const source = new MockSource(1);
    const listener = vi.fn();

    fx(source)
      .map(x => x * 2)
      .up(listener);

    source.emit(2);
    expect(listener).toHaveBeenCalledWith(4);
  });

  it('should filter values', () => {
    const source = new MockSource(1);
    const listener = vi.fn();

    fx(source)
      .filter(x => x > 5)
      .up(listener);

    source.emit(4);
    expect(listener).not.toHaveBeenCalled();

    source.emit(6);
    expect(listener).toHaveBeenCalledWith(6);
  });

  it('should skip values', () => {
    const source = new MockSource(1);
    const listener = vi.fn();

    fx(source).skip(2).up(listener);

    source.emit(2); // 1
    source.emit(3); // 2
    expect(listener).not.toHaveBeenCalled();

    source.emit(4); // 3 (pass)
    expect(listener).toHaveBeenCalledWith(4);
  });

  it('should take values', () => {
    const source = new MockSource(1);
    const listener = vi.fn();

    fx(source).take(2).up(listener);

    source.emit(2);
    source.emit(3);
    expect(listener).toHaveBeenCalledTimes(2);

    source.emit(4);
    expect(listener).toHaveBeenCalledTimes(2); // Should ignore
  });

  it('should sample with another source (.with)', () => {
    const source = new MockSource('trigger');
    const store = new MockSource('data');
    const listener = vi.fn();

    fx(source).with(store).up(listener);

    source.emit('click');
    expect(listener).toHaveBeenCalledWith(['click', 'data']);

    store.emit('newData');
    // changing store should NOT trigger listener
    expect(listener).toHaveBeenCalledTimes(1);

    source.emit('click2');
    expect(listener).toHaveBeenCalledWith(['click2', 'newData']);
  });
});

describe('fx timing', () => {
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  it('should debounce values', async () => {
    const source = new MockSource('a');
    const listener = vi.fn();

    fx(source).debounce(50).up(listener);

    source.emit('b');
    await sleep(30);
    source.emit('c');
    await sleep(30);
    
    // Total 60ms from 'b', but only 30ms from 'c'. Should not fire yet.
    expect(listener).not.toHaveBeenCalled();

    await sleep(30); 
    // Now 60ms from 'c'.
    expect(listener).toHaveBeenCalledWith('c');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should delay values and cancel on new emit', async () => {
    const source = new MockSource('start');
    const listener = vi.fn();

    fx(source).delay(50).up(listener);

    source.emit('change1');
    await sleep(30);
    source.emit('change2'); // Should cancel 'change1' timer
    
    await sleep(30); 
    expect(listener).not.toHaveBeenCalled();

    await sleep(30);
    expect(listener).toHaveBeenCalledWith('change2');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('fx async', () => {
  it('should handle async and abort previous calls', async () => {
    const source = new MockSource(0);
    const listener = vi.fn();
    const asyncFn = vi.fn();

    // Simulation of async work
    const work = (id: number, signal: AbortSignal) => new Promise(resolve => {
       const timer = setTimeout(() => {
         if (!signal.aborted) resolve(`result-${id}`);
       }, 50);
       // Mock abort behavior
       signal.addEventListener('abort', () => clearTimeout(timer));
    });

    fx(source)
      .async(async (val, signal) => {
        asyncFn(val);
        return work(val, signal);
      })
      .up(listener);

    source.emit(1);
    source.emit(2); // Should abort 1

    await new Promise(r => setTimeout(r, 100)); // Wait for real timers (using real promise here)

    expect(asyncFn).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('result-2');
  });
});
