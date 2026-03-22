import { Subscribable, Listener, Unsubscribe, AsyncHandler } from './types';

/**
 * Core Fx class implementing the Fluent Interface.
 * Acts as a wrapper around a Subscribable source.
 */
export class Fx<T> implements Subscribable<T> {
  readonly __q = true; // Implement IQ interface marker

  constructor(private source: Subscribable<T>) {}

  // --- Subscribable Interface ---

  get value(): T {
    return this.source.value;
  }

  up(listener: Listener<T>): Unsubscribe {
    this.source.up(listener);
    return () => this.source.down(listener);
  }

  down(listener: Listener<T>): void {
    this.source.down(listener);
  }

  // --- Transformations ---

  /**
   * Transforms the value using a projection function.
   */
  map<R>(fn: (val: T) => R): Fx<R> {
    const parent = this.source;
    const mappedSource: Subscribable<R> = {
      get value() { return fn(parent.value); },
      up: (listener) => {
        const wrapper = (val: T) => listener(fn(val));
        (listener as any)._fxWrapper = wrapper; 
        parent.up(wrapper);
      },
      down: (listener) => {
        const wrapper = (listener as any)._fxWrapper;
        if (wrapper) parent.down(wrapper);
      }
    };
    return new Fx(mappedSource);
  }

  /**
   * Filters values. Values not matching the predicate are not propagated.
   */
  filter(predicate: (val: T) => boolean): Fx<T> {
    return this.chain((listener, val) => {
      if (predicate(val)) listener(val);
    });
  }

  /**
   * Only emits when the value is different from the previous one.
   */
  distinct(): Fx<T> {
    let lastValue: T = this.source.value;
    return this.chain((listener, val) => {
      if (val !== lastValue) {
        lastValue = val;
        listener(val);
      }
    });
  }

  /**
   * Alias for filter.
   */
  when(predicate: (val: T) => boolean): Fx<T> {
    return this.filter(predicate);
  }

  /**
   * Samples another source without subscribing to it.
   */
  with<S>(other: Subscribable<S>): Fx<[T, S]> {
    const parent = this.source;
    return new Fx({
      get value(): [T, S] { return [parent.value, other.value]; },
      up: (listener) => {
        const wrapper = (val: T) => listener([val, other.value]);
        (listener as any)._fxWrapper = wrapper;
        parent.up(wrapper);
      },
      down: (listener) => {
        const wrapper = (listener as any)._fxWrapper;
        if (wrapper) parent.down(wrapper);
      }
    });
  }

  // --- Flow Control ---

  skip(n: number): Fx<T> {
    let count = 0;
    return this.chain((listener, val) => {
      if (count >= n) listener(val);
      else count++;
    });
  }

  take(n: number): Fx<T> {
    let count = 0;
    const parent = this.source;
    return new Fx({
      get value() { return parent.value; },
      up: (listener) => {
        const wrapper = (val: T) => {
          if (count < n) {
            count++;
            listener(val);
          }
        };
        (listener as any)._fxWrapper = wrapper;
        parent.up(wrapper);
      },
      down: (listener) => {
         const wrapper = (listener as any)._fxWrapper;
         if (wrapper) parent.down(wrapper);
      }
    });
  }

  // --- Timing ---

  debounce(ms: number): Fx<T> {
    return this.wrap(null, (listener) => {
       let timer: any = null;
       const wrapper = (val: T) => {
         if (timer) clearTimeout(timer);
         timer = setTimeout(() => listener(val), ms);
       };
       (wrapper as any)._cleanup = () => { if(timer) clearTimeout(timer); };
       return wrapper;
    });
  }

  delay(ms: number): Fx<T> {
    return this.wrap(null, (listener) => {
      let timer: any = null;
      const wrapper = (val: T) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => listener(val), ms);
      };
      (wrapper as any)._cleanup = () => { if(timer) clearTimeout(timer); };
      return wrapper;
    });
  }

  // --- Async ---

  async<R>(handler: AsyncHandler<T, R>): Fx<R> {
    const parent = this.source;
    return new Fx<R>({
      // @ts-ignore
      get value() { return undefined as unknown as R; }, 
      up: (listener) => {
        let abortCtrl: AbortController | null = null;
        const wrapper = (val: T) => {
          if (abortCtrl) abortCtrl.abort();
          abortCtrl = new AbortController();
          const signal = abortCtrl.signal;
          handler(val, signal)
            .then(res => {
              if (signal.aborted) return;
              listener(res);
            })
            .catch(err => {
              if (signal.aborted) return;
              console.error('Fx Async Error:', err);
            });
        };
        (wrapper as any)._cleanup = () => { if (abortCtrl) abortCtrl.abort(); };
        (listener as any)._fxWrapper = wrapper;
        parent.up(wrapper);
      },
      down: (listener) => {
        const wrapper = (listener as any)._fxWrapper;
        if (wrapper) {
          if ((wrapper as any)._cleanup) (wrapper as any)._cleanup();
          parent.down(wrapper);
        }
      }
    });
  }

  catch(errorHandler: (err: any) => void): Fx<T> {
    return this;
  }

  // --- Events ---

  /**
   * Subscribes to an event from the source (if it's an EventTarget).
   */
  fromEvent(eventName: string): Fx<any> {
    const target = this.source.value as unknown as EventTarget;
    const eventSource: Subscribable<any> = {
      value: undefined,
      up: (listener) => {
        const handler = (event: Event) => listener(event);
        (listener as any)._eventHandler = handler;
        target.addEventListener(eventName, handler);
      },
      down: (listener) => {
        const handler = (listener as any)._eventHandler;
        if (handler) target.removeEventListener(eventName, handler);
      }
    };
    return new Fx(eventSource);
  }

  // --- Helpers ---

  /**
   * Helper to create simple intermediate nodes that process values synchronously.
   */
  private chain(processor: (listener: Listener<T>, val: T) => void): Fx<T> {
    const parent = this.source;
    return new Fx({
      get value() { return parent.value; },
      up: (listener) => {
        const wrapper = (val: T) => processor(listener, val);
        (listener as any)._fxWrapper = wrapper;
        parent.up(wrapper);
      },
      down: (listener) => {
        const wrapper = (listener as any)._fxWrapper;
        if (wrapper) parent.down(wrapper);
      }
    });
  }

  /**
   * Advanced helper for stateful wrappers (timers, etc).
   */
  private wrap(
    _unused: null | any, 
    wrapperFactory: (listener: Listener<T>) => Listener<T>
  ): Fx<T> {
    const parent = this.source;
    return new Fx({
      get value() { return parent.value; },
      up: (listener) => {
        const wrapper = wrapperFactory(listener);
        (listener as any)._fxWrapper = wrapper;
        parent.up(wrapper);
      },
      down: (listener) => {
        const wrapper = (listener as any)._fxWrapper;
        if (wrapper) {
          if ((wrapper as any)._cleanup) (wrapper as any)._cleanup();
          parent.down(wrapper);
        }
      }
    });
  }
}

export function fx<A>(source: Subscribable<A>): Fx<A>;
export function fx<A extends EventTarget>(target: A): Fx<A>;
export function fx<A, B>(sources: [Subscribable<A>, Subscribable<B>]): Fx<[A, B]>;
export function fx<A, B, C>(sources: [Subscribable<A>, Subscribable<B>, Subscribable<C>]): Fx<[A, B, C]>;
export function fx<A, B, C, D>(sources: [Subscribable<A>, Subscribable<B>, Subscribable<C>, Subscribable<D>]): Fx<[A, B, C, D]>;
export function fx<A, B, C, D, E>(sources: [Subscribable<A>, Subscribable<B>, Subscribable<C>, Subscribable<D>, Subscribable<E>]): Fx<[A, B, C, D, E]>;
export function fx(source: any): Fx<any> {
  if (Array.isArray(source)) {
    const sources = source;
    const combined: Subscribable<any[]> = {
      get value() { return sources.map(s => s.value); },
      up: (listener) => {
        const emit = () => listener(sources.map(s => s.value));
        (listener as any)._combinedWrapper = emit;
        sources.forEach(s => s.up(emit));
      },
      down: (listener) => {
        const emit = (listener as any)._combinedWrapper;
        if (emit) {
          sources.forEach(s => s.down(emit));
        }
      }
    };
    return new Fx(combined);
  }
  
  // If it's not a Subscribable, wrap it
  if (!source || !source.up || !source.down) {
    return new Fx({
      value: source,
      up: () => {},
      down: () => {}
    });
  }
  
  return new Fx(source);
}

