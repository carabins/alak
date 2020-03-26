/**
 * Коренной модуль атома
 * @remarks
 * Атом - это функция-контейнер, предназначенная для атомарной доставки данных
 * в дочерние функции-получатели.
 *
 * - Передача значения в функцию-атом установит значение контейнера и
 * доставит значение в функции-получатели.
 *
 * - Вызов функции-атома без аргументов - вернёт текущее
 * значение контейнера если оно есть.
 * @packageDocumentation
 */

import { createProtoAtom, createAtom } from './create'

/**
 * Опции расширения
 * @remarks
 * Содержит параметры расширения для методов и свойств атома.
 * Доступ к атому из функций обработчиков происходит через контекст `this`.
 */
export interface ExtensionOptions {
  /** { обработчики методов атома}*/
  handlers: {
    [key: string]: (this: Core, ...a: any[]) => any
  }
  // /** {@link ExtensionOptionsHandlers | обработчики свойств атома}*/
  // properties?: ExtensionOptionsHandlers
}

// /** Функция с контекстом {@link Core | атома}*/
// export type ExtensionHandler = {
//   (this: Core, ...a: any[]): any
// }
// /** Объект с обработчиками {@link ExtensionHandler}*/
// export type ExtensionOptionsHandlers = {
//   [key: string]: ExtensionHandler
// }
export { installAtomExtension } from './create'

/** {@link IAtomCoreConstructor} */
export const AC: IAtomCoreConstructor = Object.assign(createProtoAtom, {
  proxy: createAtom,
  proto: createProtoAtom,
})
/** Функция-контейнер*/
export type Core = {
  (...a: any[]): void
  _: IAtom<any>
  _name: string
  value: any
  uid: number
  id: string
  children: Set<AnyFunction>
  grandChildren: Map<AnyFunction, AnyFunction>
  stateListeners: Map<string, Set<AnyFunction>>
  getterFn: any
  wrapperFn: any
  meta: any
  metaMap?: Map<string, any>
  haveFrom: boolean
  isEmpty: boolean
  isAsync: boolean
  isFlow: boolean
  isAwaiting: boolean | any
  isStateless: boolean
}
type AnyFunction = {
  (...v: any[]): any
}
/** @internal */
export type MaybeAny<T> = unknown extends T ? any : T

type Level = 'value' | 'all' | 'decay'

/**
 * Создание прокси-атома и атома
 * @example
 * ```javascript
 * import {AC} from 'alak/atom'
 * const flow = AC() // сокращённая запись AC.proxy()
 * ```
 */
export interface IAtomCoreConstructor {
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

type ValueDownReceiver<T extends any> = (v: T, down: () => void) => void
type ValueFlowReceiver = (...a: any[]) => void
type ValueAtomReceiver<T extends any> = (v: T, a: IAtom<T>) => void
type ValueReceiver<T> = unknown extends T ? ValueFlowReceiver : ValueAtomReceiver<T>

/** Интерфейс ядра атома.
 * @remarks
 * Функция-контейнер.
 */
export interface IAtom<T> {
  /**
   * Вернуть текущее значение контейнера
   */
  (): Promise<T> | T

  /**
   * Доставить значение всем дочерним слушателям и установить новое значение в контейнер.
   * @param value устанавливаемое значние
   */
  (value?: T): T

  /** Доставить значение всем дочерним слушателям и установить новое значение в контейнер.*/
  (value?: T, ...auxiliaryValues): void

  /**
   * Вернуть текущее значение контейнера
   */
  (): Promise<T> | T

  /**
   * Текущее значение контейнера
   */
  readonly value: T
  /** Вернёт `true` при отсутствующем значении в контейнере*/
  readonly isEmpty: boolean

  /** Идентификатор, вернёт `uid` если не был задан {@link IAtom.setId}*/
  readonly id: string
  /** Имя заданное {@link IAtom.setName} */
  readonly name: string

  /** Уникальный идентификатор генерируется при создании.*/
  readonly uid: string
  // on: FlowStateListener
  // /** remove event listener for change async state of data, "await, ready, etc...
  //  * @experimental*/
  // off: FlowStateListener

  /** check 'from' or 'warp' function are async*/
  /** Является ли уставленный добытчик {@link IAtom.setGetter} асинхронным */
  readonly isAsync: Boolean
  /** Находится ли атом в процессе получения значения от асинхронного добытчика
   * {@link IAtom.setGetter}*/
  readonly isAwaiting: Boolean

  /** `true` когда атом не запоминает значение
   * {@link IAtom.stateless}*/
  readonly isStateless: Boolean

  /** Добавить функцию-получатель обновлений значения контейнера
   * и передать текущее значение контейнера, если оно есть
   * @param receiver - функция-получатель
   * @returns {@link atom#IAtom}*/
  up(receiver: ValueReceiver<T>): IAtom<T>

  /** Добавить функцию-получатель и передать значение со следующего обновления
   * @param receiver - функция-получатель
   * @returns {@link IAtom}*/
  next(receiver: ValueReceiver<T>): IAtom<T>

  /** Удалить функцию-получатель
   * @param receiver - функция-получатель
   * @returns {@link atom#IAtom}*/
  down(receiver: ValueReceiver<T>): IAtom<T>

  /** Передать один раз в функцию-получатель значение контейнера,
   * текущее если оно есть или как появится
   * @param receiver - функция-получатель
   * @returns {@link IAtom}*/
  once(receiver: ValueReceiver<T>): IAtom<T>

  /** Добавить функцию-получатель со вторым аргументом функцией-отмены подписки
   * @param receiver - функция-получатель
   * @returns {@link IAtom}*/
  upDown(receiver: ValueDownReceiver<T>): IAtom<T>

  /** Добавить функцию-получатель значений не равных `null` и `undefined`
   * @param receiver - функция-получатель
   * @returns {@link IAtom}*/
  upSome(receiver: ValueReceiver<T>): IAtom<T>

  /** Добавить функцию-получатель значений равных `true`
   * после приведения значения к типу `boolean` методом `!!value`
   * @param receiver - функция-получатель
   * @returns {@link IAtom}*/
  upTrue(receiver: ValueReceiver<T>): IAtom<T>

  /** Добавить функцию-получатель значений равных `false`
   * после приведения значения к типу `boolean` методом `!value`
   * @param receiver - функция-получатель
   * @returns {@link IAtom}*/
  upFalse(receiver: ValueReceiver<T>): IAtom<T>

  /** Добавить функцию-получатель значений равных `false`
   * после приведения значения к типу `boolean` методом `!value`
   * за исключением `null` и `undefined`
   * @param receiver - функция-получатель
   * @returns {@link IAtom}*/
  upSomeFalse(receiver: ValueReceiver<T>): IAtom<T>

  /** Добавить функцию-получатель значений равных `null` и `undefined`
   * @param receiver - функция-получатель
   * @returns {@link IAtom}*/
  upNone(receiver: ValueReceiver<T>): IAtom<T>

  /** Проверить значение контейнера на соответствие
   * @param compareValue - проверяемое значение
   * @returns положительно при соответствии заданного значения значению контейнера*/
  is(compareValue: T): boolean

  /** Добавить слушатель изменения асинхронного состояния функции добычи значения {@link IAtom.setGetter}
   * @param listener - функция-слушатель
   * @returns {@link IAtom}*/
  onAwait(listener: (isAwaiting: boolean) => void): IAtom<T>

  /** Добавить слушатель отчистки значения
   * @remarks
   *  Значение глубины отчистки
   *
   * - value отичстка значения {@link IAtom.clearValue}
   *
   * - all отичстка всего {@link IAtom.clear}
   *
   * - decay рапад {@link IAtom.decay}
   * @param listener - функция-слушатель принимающая строку - значение глубины отчистки
   * @returns {@link IAtom}*/
  onClear(listener: (deep: Level) => void): IAtom<T>

  /** Удалить слушатель отчистки зачения {@link IAtom.clearValue}
   * @param listener - функция-слушатель
   * @returns {@link IAtom}*/
  offClear(listener: () => void): IAtom<T>

  /** Удалить слушатель изменения асинхронного состояния
   * @param listener - функция-слушатель
   * @returns {@link IAtom}*/
  offAwait(listener: AnyFunction): void

  /** Удалить связи всех функций-получателей, слушателей, и очистить значение контейнера
   * @returns {@link IAtom}*/
  clear(): IAtom<T>

  /** Очистить значение контейнера
   * @returns {@link atom#IAtom} */
  clearValue(): IAtom<T>

  /** Распад атома, форсировать отчистку пямятти, удалить все свойства, функции и ссылки.*/
  decay(): void

  /** Повторно отправить значение всем функциям-получателям
   * @returns {@link IAtom} */
  resend(): IAtom<T>

  /** Установить идентификатор
   * @param id - идентификатор
   * @returns {@link IAtom} */
  setId(id: string): IAtom<T>

  /** Установить имя
   * @param name - имя
   * @returns {@link IAtom} */
  setName(name: string): IAtom<T>

  /** Добавить мета-данные
   * @param metaName - название-ключ мета-данных
   * @param value - необязательное значение мета-данных
   * @returns {@link IAtom} */
  addMeta(metaName: string, value?: any): IAtom<T>

  /** Проверить на наличие мета-данных
   * @param metaName - имя мета-данных
   * @returns положительно при наличии мета-данных*/
  hasMeta(metaName: string): boolean

  /** Получить мета-данные по имени
   * @param metaName - имя мета-данных
   * @returns данные мета-данных*/
  getMeta(metaName: string): any

  /** Использовать функцию-добытчик значения контейнера
   * @remarks
   * Функция-добытчик вызывается каждый раз при вызове функции-атома
   * @param getter - функция-добытчик
   * @param isAsync - установить значение {@link IAtom.isAsync}
   * @returns {@link IAtom} */
  setGetter(getter: () => T | Promise<T>, isAsync?: boolean): IAtom<T>

  /** Использовать функцию-добытчик только один раз
   * @param getter - функция-добытчик
   * @param isAsync - установить значение {@link IAtom.isAsync}
   * @returns {@link IAtom} */
  setOnceGet(getter: () => T | Promise<T>, isAsync?: boolean): IAtom<T>

  /** Использовать функцию-обёртку
   * Каждое новое обновление значение контейнера атома,
   * всегда будет проходить сперва через функцию-обёртку
   * @param wrapper - функция-обёртка
   * @param isAsync - установить значение returns {@link IAtom.isAsync}
   * @returns {@link IAtom} */
  setWrapper(wrapper: (newValue: T, prevValue: T) => T | Promise<T>, isAsync?: boolean): IAtom<T>

  /**
   * Сделать конетейнер всегда пустым.
   * Значение переданное в атом, доставится в функции-получатели минуя контейнер.
   * @param bool? - по умолчанию `true`
   * @returns {@link IAtom} */
  stateless(bool?: boolean): IAtom<T>

  /**
   * Сделать конетейнер принимающим и передаюшим множество агрументов.
   * Все аргументы переданные в атом, сохраняются как массив.
   * В функции-получатели значения передаются в полном количестве.
   * @param bool? - по умолчанию `true`
   * @returns {@link IAtom} */
  flow(bool?: boolean): IAtom<T>

  /** Применить функцию к значению в контейнере
   * @param fun - функция принимающая текущее значение и возвращающей
   * новое значение в контейнер и дочерним функциям-получателям
   * @returns {@link IAtom} */
  fmap(fun: (v: T) => T): IAtom<T>

  /**
   * Создать дубликат значение
   * @remarks
   * Методом `JSON.parse(JSON.stringify(value))`
   * @returns T */
  cloneValue(): T

  /** Передаёт значение контейнера в ключ объекта
   * @param targetObject - целевой объект
   * @param key - ключ доступа к значению в объекте
   */
  injectOnce(targetObject: any, key?: string): IAtom<T>
}
