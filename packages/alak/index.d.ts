/**
 * Опции расширения
 * @remarks
 * Содержит параметры расширения для методов и свойств атома.
 * Доступ к атому из функций обработчиков происходит через контекст `this`.
 */
interface ExtensionOptions {
  /** { обработчики методов атома}*/
  handlers: {
    [key: string]: (this: Core, ...a: any[]) => any
  }
  // /** {@link ExtensionOptionsHandlers | обработчики свойств атома}*/
  // properties?: ExtensionOptionsHandlers
}

/** @internal */
type MaybeAny<T> = unknown extends T ? any : T

type Level = 'value' | 'all' | 'decay'

// /** Функция с контекстом {@link Core | атома}*/
// type ExtensionHandler = {
//   (this: Core, ...a: any[]): any
// }
// /** Объект с обработчиками {@link ExtensionHandler}*/
// type ExtensionOptionsHandlers = {
//   [key: string]: ExtensionHandler
// }
type Core = {
  (...a: any[]): void
  _: IAtom<any>
  _name: string
  value: any
  prev: any
  uid: number
  id: string
  children: Set<AnyFunction>
  grandChildren: Map<AnyFunction, AnyFunction>
  stateListeners: Map<string, Set<AnyFunction>>
  getterFn: any
  wrapperFn: any
  meta: any
  metaMap?: Map<string, any>
  parents: IAtom<any>[]
  isEmpty: boolean
  isAsync: boolean
  isSafe: boolean
  isHoly: boolean
  isAwaiting: boolean | any
  isStateless: boolean
  tunedTarget: IAtom<any>
  decays: any[]
}

/**
 * Создание прокси-атома и атома
 * @example
 * ```javascript
 * import {AC} from 'alak/core'
 * const holistic = AC() // сокращённая запись AC.proxy()
 * ```
 */
interface IAtomCoreConstructor {
  /** Создать {@link IAtom} с необязательным аргументом как стартовое значение*/ <T>(
    value?: T,
  ): IAtom<MaybeAny<T>>

  /**
   * Создать {@link IAtom} с необязательным аргументом как стартовое значение
   * @remarks
   * Максимальные функции, максимальная скорость создания, минимальное потребление памяти.
   * @param value - необязательное стартовое значение
   * @returns {@link IAtom}
   * @readonly
   */
  proxy<T>(value?: T): IAtom<MaybeAny<T>>

  /**
   * Создать {@link IAtom} с необязательным аргументом как стартовое значение
   * @remarks
   * Минимальные функции, максимальная скорость доставки значения за счёт увеличения потребления памяти.
   * @param value - необязательное стартовое значение
   * @returns {@link IAtom}
   */
  proto<T>(value?: T): IAtom<MaybeAny<T>>
}

type ValueDownReceiver<T extends any> = (v: T, down?: () => void) => void
type ValueReceiver<T extends any> = (v: T, atom: IAtom<T>, ...flow: any[]) => void
