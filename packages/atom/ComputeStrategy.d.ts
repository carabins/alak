type UnpackedPromise<T> = T extends Promise<infer U> ? U : T
type UnpackedFlow<T> = T extends (...args: any[]) => infer U ? U : T
type ReturnArrayTypes<IN extends any[]> = { [K in keyof IN]: UnpackedPromise<UnpackedFlow<IN[K]>> }

type FunComputeIn<T, IN extends any[]> = {
  (...a: ReturnArrayTypes<IN>): T | PromiseLike<T>
}
type ComputedIn<T, IN extends any[]> = {
  (fn: FunComputeIn<T, IN>): T
}

type ComputeInOut<IN extends any[], OUT> = {
  (...v: ReturnArrayTypes<IN>): OUT
}
type ComputeAtom<IN extends any[]> = {
  <OUT>(fn: ComputeInOut<IN, OUT>): IAtom<OUT>
}

/** @internal */
type ComputeStrategicAtom<IN extends any[]> = {
  [K in keyof ComputeStrategy<any, IN>]: ComputeAtom<IN>
}

/**
 * Описание стратегий вычисления значения
 */
interface ComputeStrategy<T, IN extends any[]> {
  /**
   * Функция-обработчик вызывается при наличии значений всех атомов исключая `null` и `undefined`.
   */
  some: ComputedIn<T, IN>
  /**
   * Функция-обработчик вызывается при отличным от предыдущего отбновлении значений всех атомов, исключая `null` и `undefined`.
   * Для мутации объектов и массивов посредством fmap, возвращайте Object.assign({}, value}) и [...value]
   */
  someSafe: ComputedIn<T, IN>
  /**
   * Функция-обработчик вызывается обновлением любого атома-источника.
   */
  weak: ComputedIn<T, IN>
  /**
   * Функция-обработчик вызывается уникальным обновлением любого атома-источника.
   * Для мутации объектов и массивов посредством fmap, возвращайте Object.assign({}, value}) и [...value]
   */
  weakSafe: ComputedIn<T, IN>
  /**
   * При вызове целевого атома, будет вызвана функци-добытчик у всех асинхронных атомов-источников.
   * Функция-обработчик вызывается при заполнении всех атомов любыми значениями.
   */
  strong: ComputedIn<T, IN>
  /**
   * При вызове целевого атома, будет вызвана функци-добытчик у всех асинхронных атомов-источников.
   * Функция-обработчик вызывается при заполнении всех атомов значениями отличными от предыдущего.
   *
   */
  strongSafe: ComputedIn<T, IN>
}
