/**
 * Опции расширения
 * @remarks
 * Содержит параметры расширения для методов и свойств нуклона.
 * Доступ к нуклону из функций обработчиков происходит через контекст `this`.
 */
interface NucleonExtension {
  /** { обработчики методов нуклона}*/
  [key: string]: (this: Quark, ...a: any[]) => any
}

/** @internal */
type MaybeAny<T> = unknown extends T ? any : T

type AnyFunction = {
  (...v: any[]): any
}

type Level = 'value' | 'all' | 'decay'

interface QuarkBus<Events, DataType> {
  addEverythingListener(listener: (event: Events, data: DataType) => void): void

  addEventListener(event: Events, listener: (data: DataType) => void): void

  removeEventListener(listener, event): void

  removeListener(listener): void

  dispatchEvent(event: string, data?: DataType): void

  getListenersMap(): Map<string, Set<AnyFunction>>

  connectEventBus(event, bus: QuarkBus<any, any>): void
}

interface Quark {
  (...a: any[]): void

  _: INucleon<any>
  _name?: string
  value?: any
  prev?: any
  uid: number
  id?: string
  listeners: Set<AnyFunction>
  grandListeners?: Map<AnyFunction, AnyFunction>
  stateListeners?: Map<string, Set<AnyFunction>>
  everythingListeners?: Set<AnyFunction>
  getterFn?: any
  wrapperFn?: any
  meta?: any
  metaMap?: Map<string, any>
  parents?: INucleon<any>[]
  isEmpty?: boolean
  isAsync?: boolean
  isSafe?: boolean
  isHoly?: boolean
  isPrivate?: boolean
  isAwaiting?: boolean | any
  isStateless?: boolean
  tunedTarget?: INucleon<any>
  decays?: any[]
}

/**
 * Создание прокси-нуклона и нуклона
 * @example
 * ```javascript
 * import {AC} from 'alak/quark'
 * const holistic = AC() // сокращённая запись AC.proxy()
 * ```
 */
interface INucleonQuarkConstructor {
  /** Создать {@link INucleon} с необязательным аргументом как стартовое значение*/ <T>(
    value?: T,
  ): INucleon<MaybeAny<T>>

  /**
   * Создать {@link INucleon} с необязательным аргументом как стартовое значение
   * @remarks
   * Максимальные функции, максимальная скорость создания, минимальное потребление памяти.
   * @param value - необязательное стартовое значение
   * @returns {@link INucleon}
   * @readonly
   */
  proxy<T>(value?: T): INucleon<MaybeAny<T>>

  /**
   * Создать {@link INucleon} с необязательным аргументом как стартовое значение
   * @remarks
   * Минимальные функции, максимальная скорость доставки значения за счёт увеличения потребления памяти.
   * @param value - необязательное стартовое значение
   * @returns {@link INucleon}
   */
  proto<T>(value?: T): INucleon<MaybeAny<T>>
}

type ValueDownReceiver<T> = (v: T, down?: () => void) => void
type ValueReceiver<T> = (v: T, nucleon: INucleon<T>, ...flow: any[]) => void
