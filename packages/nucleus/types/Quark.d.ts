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

type Level = 'value' | 'all'

type EventConnector = Function

// interface QuarkBus<Events, DataType> {
//   addEverythingListener(listener: (event: Events, data: DataType) => void): void
//
//   addEventListener(event: Events, listener: (data: DataType) => void): void
//
//   removeEventListener(listener, event: Events): void
//
//   removeListener(listener): void
//
//   dispatchEvent(event: Events, data?: DataType): void
//
//   getListenersMap(): Map<string, Set<AnyFunction>>
//
//   addEventToBus(event, bus: QuarkBus<any, any>): EventConnector
//
//   removeEventToBus(connector: EventConnector): void
//
//   addBus(bus: QuarkBus<any, any>): void
//
//   removeBus(bus: QuarkBus<any, any>): void
//
//   decay():void
// }

interface IQuarkBus<ListenerEvents extends object, DispatchEvents extends object> {
  addEverythingListener<E extends keyof ListenerEvents>(
    listener: (event: E, data: ListenerEvents[E]) => void,
  ): void

  addEventListener<E extends keyof ListenerEvents>(
    event: E,
    listener: (data: ListenerEvents[E]) => void,
  ): void

  removeEventListener(event: keyof ListenerEvents, listener: Function): void

  removeListener(listener: Function): void

  dispatchEvent<E extends keyof DispatchEvents>(event: E | string, data?: DispatchEvents[E]): void

  getListenersMap(): Map<string, Set<AnyFunction>>

  addEventToBus(event, bus: IQuarkBus<any, any>): EventConnector

  removeEventToBus(connector: EventConnector): void

  addBus(bus: IQuarkBus<any, any>): void

  removeBus(bus: IQuarkBus<any, any>): void
  decay(): void
}

interface Quark {
  (...a: any[]): void

  _: INucleus<any>
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
  parents?: INucleus<any>[]
  isEmpty?: boolean
  isAsync?: boolean
  isSafe?: boolean
  isHoly?: boolean
  isPrivate?: boolean
  isAwaiting?: boolean | any
  isStateless?: boolean
  tunedTarget?: INucleus<any>
  decayHooks?: Function[]
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
  /** Создать {@link INucleus} с необязательным аргументом как стартовое значение*/ <T>(
    value?: T,
  ): INucleus<MaybeAny<T>>

  /**
   * Создать {@link INucleus} с необязательным аргументом как стартовое значение
   * @remarks
   * Максимальные функции, максимальная скорость создания, минимальное потребление памяти.
   * @param value - необязательное стартовое значение
   * @returns {@link INucleon}
   * @readonly
   */
  proxy<T>(value?: T): INucleus<MaybeAny<T>>

  /**
   * Создать {@link INucleus} с необязательным аргументом как стартовое значение
   * @remarks
   * Минимальные функции, максимальная скорость доставки значения за счёт увеличения потребления памяти.
   * @param value - необязательное стартовое значение
   * @returns {@link INucleon}
   */
  proto<T>(value?: T): INucleus<MaybeAny<T>>
}

type ValueDownReceiver<T> = (v: T, down?: () => void) => void
type ValueReceiver<T> = (v: T, nucleon: INucleus<T>, ...flow: any[]) => void
