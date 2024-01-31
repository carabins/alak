type UnpackedPromise<T> = T extends Promise<infer U> ? U : T
type UnpackedNucleus<T> = T extends INucleus<infer U> ? U : T
type UnpackedFnArgs<T> = T extends (...args: any[]) => infer U ? U : T
type ReturnArrayTypes<IN extends any[]> = {
  [K in keyof IN]: UnpackedPromise<UnpackedNucleus<IN[K]>>
}

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
  <OUT>(fn: ComputeInOut<IN, OUT>): INucleus<OUT>
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
   * Функция-обработчик вызывается обновлением любого нуклона-источника.
   */
  weak: ComputedIn<T, IN>
  /**
   * Функция-обработчик вызывается при наличии значений всех нуклонов исключая `null` и `undefined`.
   */
  some: ComputedIn<T, IN>
  /**
   * При вызове целевого нуклона, будет вызвана функция-добытчик у всех асинхронных нуклонов-источников.
   * Функция-обработчик вызывается при заполнении всех нуклонов любыми значениями.
   */
  strong: ComputedIn<T, IN>
}
