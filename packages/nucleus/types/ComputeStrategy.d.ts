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
type ComputeNucleon<IN extends any[]> = {
  <OUT>(fn: ComputeInOut<IN, OUT>): INucleon<OUT>
}

/** @internal */
type ComputeStrategicNucleon<IN extends any[]> = {
  [K in keyof ComputeStrategy<any, IN>]: ComputeNucleon<IN>
}

/**
 * Описание стратегий вычисления значения
 */
interface ComputeStrategy<T, IN extends any[]> {
  /**
   * Функция-обработчик вызывается при наличии значений всех нуклонов исключая `null` и `undefined`.
   */
  some: ComputedIn<T, IN>
  /**
   * Функция-обработчик вызывается при отличным от предыдущего отбновлении значений всех нуклонов, исключая `null` и `undefined`.
   * Для мутации объектов и массивов посредством fmap, возвращайте Object.assign({}, value}) и [...value]
   */
  someSafe: ComputedIn<T, IN>
  /**
   * Функция-обработчик вызывается обновлением любого нуклона-источника.
   */
  weak: ComputedIn<T, IN>
  /**
   * Функция-обработчик вызывается уникальным обновлением любого нуклона-источника.
   * Для мутации объектов и массивов посредством fmap, возвращайте Object.assign({}, value}) и [...value]
   */
  weakSafe: ComputedIn<T, IN>
  /**
   * При вызове целевого нуклона, будет вызвана функци-добытчик у всех асинхронных нуклонов-источников.
   * Функция-обработчик вызывается при заполнении всех нуклонов любыми значениями.
   */
  strong: ComputedIn<T, IN>
  /**
   * При вызове целевого нуклона, будет вызвана функци-добытчик у всех асинхронных нуклонов-источников.
   * Функция-обработчик вызывается при заполнении всех нуклонов значениями отличными от предыдущего.
   *
   */
  strongSafe: ComputedIn<T, IN>
}
