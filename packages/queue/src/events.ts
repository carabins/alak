import type { QueueEvent } from './types';

type EventHandler<T = any> = (data: T, ...args: any[]) => void;

export class QueueEmitter {
  private _listeners = new Map<QueueEvent, Set<EventHandler>>();

  on<T = any>(event: QueueEvent, handler: EventHandler<T>): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      const set = this._listeners.get(event);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          this._listeners.delete(event);
        }
      }
    };
  }

  emit(event: QueueEvent, ...args: any[]): void {
    const handlers = this._listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          (handler as any)(...args);
        } catch (e) {
          console.error(`[QueueEmitter] Error in handler for ${event}:`, e);
        }
      }
    }
  }

  clear() {
    this._listeners.clear();
  }
}
