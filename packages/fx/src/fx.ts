import { Subscribable, Listener, Unsubscribe, AsyncHandler } from './types';

/**
 * Core Fx class implementing the Fluent Interface.
 * Acts as a wrapper around a Subscribable source.
 */
export class Fx<T> implements Subscribable<T> {
  constructor(private source: Subscribable<T>) {}

  // --- Subscribable Interface ---

  get value(): T {
    return this.source.value;
  }

  up(listener: Listener<T>): Unsubscribe {
    // We delegate subscription to the source.
    // However, some sources might strictly return void on .up(),
    // so we assume .down() is the way to unsubscribe.
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
        // We create a specific wrapper for this listener to handle the mapping
        // We need to store it to unsubscribe later (WeakMap or closure if simple)
        // Since Fx creates a chain, the listener passed to `mappedSource.up` is usually 
        // the `handler` of the next node in chain.
        const wrapper = (val: T) => listener(fn(val));
        // We rely on the parent to handle the subscription of the wrapper
        // But how do we map `listener` back to `wrapper` for .down()?
        // Simple solution: The chain is static during subscription.
        // But `down` requires the reference.
        // We use a property on the listener function to store the wrapper, or a Map.
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
   * Alias for filter.
   */
  when(predicate: (val: T) => boolean): Fx<T> {
    return this.filter(predicate);
  }

  /**
   * Samples another source without subscribing to it.
   */
  with<S>(other: Subscribable<S>): Fx<[T, S]> {
    // Since we can't create a [T, S] from just T in the simple chain helper,
    // we implement this manually like map.
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
    // Need manual impl to unsubscribe from parent
    return new Fx({
      get value() { return parent.value; },
      up: (listener) => {
        const wrapper = (val: T) => {
          if (count < n) {
            count++;
            listener(val);
            if (count === n) {
              // Auto-unsubscribe logic would go here if we had full control
              // For now, simple flow stops emitting.
              // In a perfect world, we'd notify upstream to stop.
            }
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
    let timer: any = null;
    
    // We need to store timers per listener if we support multiple subscribers.
    // For Fx usage (usually 1 chain = 1 subscriber), closure is okay-ish,
    // but correct implementation maps listener -> state.
    
    return this.wrap((listener, val) => {
       // access state associated with listener? 
       // Simpler: assume Fx chains are unicast or handle state in wrapper factory.
    }, (listener) => {
       // Factory for the wrapper
       let timer: any = null;
       const wrapper = (val: T) => {
         if (timer) clearTimeout(timer);
         timer = setTimeout(() => listener(val), ms);
       };
       // Hook for cleanup when unsubscribing (down)
       (wrapper as any)._cleanup = () => { if(timer) clearTimeout(timer); };
       return wrapper;
    });
  }

  delay(ms: number): Fx<T> {
    return this.wrap(null, (listener) => {
      let timer: any = null;
      const wrapper = (val: T) => {
        // Delay logic: if value changes, we might want to cancel previous delay?
        // SPEC says: "If source updates... previous timer cancelled (cleanup)"
        // This acts like switchMap with delay.
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
    
    // We treat async result as the new value.
    // Initial value is tricky... maybe undefined? 
    // Or we just don't emit until first async resolves.
    
    return new Fx<R>({
      // We can't synchronously know the value of an async operation.
      // So .value might be undefined initially or stale.
      // @ts-ignore
      get value() { return undefined as unknown as R; }, 
      
      up: (listener) => {
        let abortCtrl: AbortController | null = null;
        
        const wrapper = (val: T) => {
          // Cancel previous
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
        
        // Attach cleanup logic for explicit unsubscription
        (wrapper as any)._cleanup = () => {
          if (abortCtrl) abortCtrl.abort();
        };
        
        (listener as any)._fxWrapper = wrapper;
        parent.up(wrapper);
      },
      
      down: (listener) => {
        const wrapper = (listener as any)._fxWrapper;
        if (wrapper) {
          // Execute cleanup (abort active requests)
          if ((wrapper as any)._cleanup) (wrapper as any)._cleanup();
          parent.down(wrapper);
        }
      }
    });
  }

  catch(errorHandler: (err: any) => void): Fx<T> {
    // Placeholder. To implement properly, we need an error channel alongside value channel.
    // For now, errors in .async are logged.
    return this;
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

export function fx<T>(source: Subscribable<T>): Fx<T> {
  return new Fx(source);
}
