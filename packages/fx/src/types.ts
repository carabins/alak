export interface Subscribable<T> {
  up(listener: (val: T) => void): any;
  down(listener: (val: T) => void): void;
  value: T;
}

export type Listener<T> = (val: T) => void;
export type Unsubscribe = () => void;

export type AsyncHandler<T, R> = (val: T, signal: AbortSignal) => Promise<R>;
