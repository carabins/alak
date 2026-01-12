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
type UnpackKV<T> = T[keyof T]

/** Интерфейс ядра нуклона.
 * @remarks
 * Функция-контейнер.
 */
interface INucleus<T> {
  /**
   * Вернуть текущее значение контейнера
   */
  (): Promise<T> | T

  /**
   * Доставить значение всем дочерним слушателям и установить новое значение в контейнер.
   * @param value устанавливаемое значние
   */
  (value?: T): T

  (value?: T, ...auxiliaryValues): void

  /**
   * Текущее значение контейнера
   */
  readonly value: T

  // links: any
  // _: T
  /**
   * Только в функциях-приёмниках возвращает предидущее значение
   */
  readonly prev: T

  /** Вернёт `true` при отсутствующем значении в контейнере*/
  readonly isEmpty: boolean

  /** Вернёт `true` при наличии значения в контейнере*/
  readonly isFull: boolean

  /** Идентификатор, вернёт `uid` если не был задан {@link INucleus.setId}*/
  readonly id: string
  /** Имя заданное {@link INucleus.setName} */
  readonly name: string

  /** Уникальный идентификатор генерируется при создании.*/
  readonly uid: string
  // on: FlowStateListener
  // /** remove event listener for change async state of data, "await, ready, etc...
  //  * @experimental*/
  // off: FlowStateListener

  /** check 'from' or 'warp' function are async*/
  /** Является ли уставленный добытчик {@link INucleus.setGetter} асинхронным */
  readonly isAsync: Boolean
  /** Находится ли нуклон в процессе получения значения от асинхронного добытчика
   * {@link INucleus.setGetter}*/
  readonly isAwaiting: Boolean

  /** `true` когда нуклон не запоминает значение
   * {@link INucleus.stateless}*/
  readonly isStateless: Boolean

  /** `true` когда нуклон передаёт все аргументы функциям-слушателям
   * {@link INucleus.stateless}*/
  readonly isHoly: Boolean

  /** Добавить функцию-получатель обновлений значения контейнера
   * и передать текущее значение контейнера, если оно есть
   * @param receiver - функция-получатель
   * @returns {@link quark#INucleon}*/
  up(receiver: ValueReceiver<T>): INucleus<T>

  /** Каррирование, создаёт новую чистую функцию для приёма значения
   * для случаев когда нужны bind, call, apply
   * @param context?:string - контекст для отладки в логах
   * @returns ValueReceiver<T> */
  curry(context: string): ValueReceiver<T>

  /** Установить значение контейнера не уведомляя текущих слушателей
   * @param value?:T - устанавливаемое значние
   * @returns ValueReceiver<T> */
  silent(value: T): ValueReceiver<T>

  /** Добавить нуклон-получатель обновлений значения контейнера
   * и отписать другого родителя по имени
   * нуклон-поставшик данных для имени может быть только один
   * @param a:{@link quark#INucleon} - нуклон-получатель
   * @param name:string? - опциональное имя канала
   * @returns {@link quark#INucleon}*/
  connect(nucleon: INucleus<T>, parentName?: string): INucleus<T>

  /** Добавить функцию-получатель обновлений значения контейнера
   * с возможностью отписаться {@link INucleus.downLink} по объёкту-ссылке
   * @param receiver - функция-получатель
   * @param linkObject - любой объект для вызова {@link INucleus.downLink}
   * @returns {@link quark#INucleon}*/
  link(linkObject: any, receiver: ValueReceiver<T>): INucleus<T>

  /** Отписать функцию-получатель по объекту ссылки установленную в {@link INucleus.link}
   * @param linkObject - функция-получатель
   */
  downLink(linkObject: any): INucleus<T>

  /** Добавить функцию-получатель и передать значение со следующего обновления
   * @param receiver - функция-получатель
   */
  next(receiver: ValueReceiver<T>): INucleus<T>

  /** Удалить функцию-получатель
   * @param receiver - функция-получатель
   * @returns {@link quark#INucleon}*/
  down(receiver: ValueReceiver<T>): INucleus<T>

  /** Передать один раз в функцию-получатель значение контейнера,
   * текущее если оно есть или как появится
   * @param receiver - функция-получатель
   */
  once(receiver: ValueReceiver<T>): INucleus<T>

  /** Добавить функцию-получатель со вторым аргументом функцией-отмены подписки
   * @param receiver - функция-получатель
   */
  coldUp(receiver: ValueDownReceiver<T>): INucleus<T>

  /** Добавить функцию-получатель значений не равных `null` и `undefined`
   * @param receiver - функция-получатель
   */
  upSome(receiver: ValueReceiver<T>): INucleus<T>

  /** Добавить функцию-получатель значений равных `true`
   * после приведения значения к типу `boolean` методом `!!value`
   * @param receiver - функция-получатель
   */
  upTrue(receiver: ValueReceiver<T>): INucleus<T>

  /** Добавить функцию-получатель значений равных `false`
   * после приведения значения к типу `boolean` методом `!value`
   * @param receiver - функция-получатель
   */
  upFalse(receiver: ValueReceiver<T>): INucleus<T>

  /** Добавить функцию-получатель значений равных `false`
   * после приведения значения к типу `boolean` методом `!value`
   * за исключением `null` и `undefined`
   * @param receiver - функция-получатель
   */
  upSomeFalse(receiver: ValueReceiver<T>): INucleus<T>

  /** Добавить функцию-получатель значений равных `null` и `undefined`
   * @param receiver - функция-получатель
   */
  upNone(receiver: ValueReceiver<T>): INucleus<T>

  /** Проверить значение контейнера на соответствие
   * @param compareValue - проверяемое значение
   * @returns положительно при соответствии заданного значения значению контейнера*/
  is(compareValue: T): boolean

  /** Сгенерировать событие
   * @param event - имя события
   * @param value - необязательное значение
   */
  dispatch(event: string, ...value: any[]): INucleus<T>

  /** Удалить слушатель события {@link INucleus.on}
   * @param event - имя события
   * @param listener - функция-слушатель
   */
  off(event: string, listener: (...value: any[]) => void): INucleus<T>

  /** Добавить слушатель события
   * @param event - имя события
   * @param listener - функция-слушатель
   */
  on(event: string, listener: (...value: any[]) => void): INucleus<T>

  /** Добавить слушатель изменения асинхронного состояния функции добычи значения {@link INucleus.setGetter}
   * @param listener - функция-слушатель
   */
  onAwait(listener: (isAwaiting: boolean) => void): INucleus<T>

  /** Добавить слушатель отчистки значения
   * @remarks
   *  Значение глубины отчистки
   *
   * - value отичстка значения {@link INucleus.clearValue}
   *
   * - all отичстка всего {@link INucleus.clear}
   * @param listener - функция-слушатель принимающая строку - значение глубины отчистки
   */
  onClear(listener: (deep: Level) => void): INucleus<T>

  /** Удалить слушатель отчистки зачения {@link INucleus.clearValue}
   * @param listener - функция-слушатель
   */
  offClear(listener: () => void): INucleus<T>

  /** Удалить слушатель изменения асинхронного состояния
   * @param listener - функция-слушатель
   */
  offAwait(listener: AnyFunction): void

  /** Удалить связи всех функций-получателей, слушателей, и очистить значение контейнера
   * Распад нуклона, форсировать отчистку пямятти, удалить все свойства, функции и ссылки.
   **/
  decay(): void

  /** Очистить значение контейнера
   * @returns {@link quark#INucleon} */
  clearValue(): INucleus<T>

  /** Повторно отправить значение всем функциям-получателям
   */
  resend(): INucleus<T>

  /** Повторно применить функцию обёртку к текущему значению
   */
  mutate(mutator: (v: T) => T): INucleus<T>

  /** Установить идентификатор
   * @param id - идентификатор
   */
  setId(id: string): INucleus<T>

  /** Установить имя
   * @param name - имя
   */
  setName(name: string): INucleus<T>

  /** Добавить мета-данные
   * @param metaName - название-ключ мета-данных
   * @param value - необязательное значение мета-данных
   */
  addMeta(metaName: string, value?: any): INucleus<T>

  /** Проверить на наличие мета-данных
   * @param metaName - имя мета-данных
   * @returns положительно при наличии мета-данных*/
  hasMeta(metaName: string): boolean

  /** Удалить мета-данных
   * @param metaName - имя мета-данных
   * @returns положительно при наличии мета-данных*/
  deleteMeta(metaName: string): boolean

  /** Получить мета-данные по имени
   * @param metaName - имя мета-данных
   * @returns данные мета-данных*/
  getMeta(metaName: string): any

  /** Использовать функцию-добытчик значения контейнера
   * @remarks
   * Функция-добытчик вызывается каждый раз при вызове функции-нуклона
   * @param getter - функция-добытчик
   * @param isAsync - установить значение {@link INucleus.isAsync}
   */
  setGetter(getter: () => T | Promise<T>, isAsync?: boolean): INucleus<T>

  /** Использовать функцию-добытчик только один раз
   * @param getter - функция-добытчик
   * @param isAsync - установить значение {@link INucleus.isAsync}
   */
  setOnceGet(getter: () => T | Promise<T>, isAsync?: boolean): INucleus<T>

  /** Использовать функцию-обёртку
   * Каждое новое обновление значение контейнера нуклона,
   * всегда будет проходить сперва через функцию-обёртку
   * @param wrapper - функция-обёртка
   * @param isAsync - установить значение returns {@link INucleus.isAsync}
   */
  setWrapper(wrapper: (newValue: T, prevValue: T) => T | Promise<T>, isAsync?: boolean): INucleus<T>

  /**
   * Сделать конетейнер всегда пустым.
   * Значение переданное в нуклон, доставится в функции-получатели минуя контейнер.
   * @param bool? - по умолчанию `true`
   */
  stateless(bool?: boolean): INucleus<T>

  /**
   * Сделать конетейнер принимающим и передаюшим множество агрументов.
   * Все аргументы переданные в нуклон, сохраняются как массив.
   * В функции-получатели значения передаются в полном количестве.
   * @param bool? - по умолчанию `true`
   */
  holistic(bool?: boolean): INucleus<T>

  /**
   * Обновление  фукнций-приёмников происходит только при уникальных значениях
   * @param bool? - по умолчанию `true`
   */
  finite(bool?: boolean): INucleus<T>

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
  injectTo(targetObject: any, key?: string): INucleus<T>

  /**
   * Создать нуклон из нескольких других нуклонов и стратегии вычисления.
   * @param nucleons - набор входных нуклонов для вычисления значения
   * @returns {@link ext-computed#ComputeStrategy}
   */
  from<IN extends INucleus<any>[]>(...nucleons: IN): ComputeStrategicNucleon<IN>

  /**
   * Список производных нуклонов {@link from}
   * @returns INucleus<any>[]
   */
  parents: INucleus<any>[]

  /**
   * Подписать текущий нуклон на друой нуклон
   * Отписав его от прошлой настройки
   * Работает как переключить источник
   * @param INucleon<T>
   */
  tuneTo(nucleon: INucleus<T>): void

  /**
   * Отключить нуклон от подключенных ранее через tuneTo
   */
  tuneOff(nucleon: INucleus<T>): void

  haveListeners: boolean
}
/** Конструктор нуклона
 * @remarks
 * Функция-константа, расширяет {@link src#INucleonQuarkConstructor}
 * ```
 * */
interface INucleonConstructor<D> extends INucleonQuarkConstructor {
  <T>(value?: T): INucleus<MaybeAny<T>>

  /**
   * Создать нуклон c предустановленным идентификатором
   * то же что и  {@link INucleus.setId}.
   */
  id<T>(id: string | number, startValue?: T): INucleus<MaybeAny<T>>

  /**
   * Создать нуклон c функцией обёртки
   * то же что и {@link INucleus.setWrapper}.
   */
  setWrapper<T>(wrapperFun: (v: D) => T): INucleus<MaybeAny<T>>
  /**
   * Создать нуклон c функцией добытчика
   */
  setGetter<T>(getterFn: () => T): INucleus<T>

  /**
   * Создать нуклон c функцией добытчика вызываемый только раз
   */
  setOnceGet<D>(getterFn: () => D): INucleus<D>
  /**
   * Создать нуклон, с контейнерем не запоминающием значение.
   */
  stateless(): INucleus<MaybeAny<D>>
  /**
   * Создать нуклон, с аргументами передающимися в функции-добытчики в полном числе.
   */
  holistic(): INucleus<MaybeAny<D>>
  /**
   * Создать нуклон из нескольких других нуклонов и стратегии вычисления.
   * Смотрите описание стратегий: {@link ext-computed#ComputeStrategy}.
   * @example
   * ```javascript
   * const a1 = A(1)
   * const a2 = A(2)
   * const computedNucleon = A
   *          .from(a1, a2)
   *          .some((v1, v2) => v1 + v2)
   * console.log(computedNucleon()) //output:3
   * ```
   * @param nucleons - набор входных нуклонов для вычисления значения
   * @returns {@link ext-computed#ComputeStrategy}
   */
  from<IN extends INucleus<any>[]>(...nucleons: IN): ComputeStrategicNucleon<IN>
}
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
  isFinite?: boolean
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
