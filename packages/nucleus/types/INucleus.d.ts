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
   *
   * - decay рапад {@link INucleus.decay}
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
   */
  clearListeners(): INucleus<T>

  /** Очистить значение контейнера
   * @returns {@link quark#INucleon} */
  clearValue(): INucleus<T>

  /** Распад нуклона, форсировать отчистку пямятти, удалить все свойства, функции и ссылки.*/
  decay(): void

  /** Повторно отправить значение всем функциям-получателям
   */
  resend(): INucleus<T>

  /** Вызвать всех слушателей
   */
  emit(): INucleus<T>

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
  safe(bool?: boolean): INucleus<T>

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
