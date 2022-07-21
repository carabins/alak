type UnpackKV<T> = T[keyof T]

/** Интерфейс ядра нуклона.
 * @remarks
 * Функция-контейнер.
 */
interface INucleon<T> {
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
  readonly isFilledisFilled: boolean

  /** Идентификатор, вернёт `uid` если не был задан {@link INucleon.setId}*/
  readonly id: string
  /** Имя заданное {@link INucleon.setName} */
  readonly name: string

  /** Уникальный идентификатор генерируется при создании.*/
  readonly uid: string
  // on: FlowStateListener
  // /** remove event listener for change async state of data, "await, ready, etc...
  //  * @experimental*/
  // off: FlowStateListener

  /** check 'from' or 'warp' function are async*/
  /** Является ли уставленный добытчик {@link INucleon.setGetter} асинхронным */
  readonly isAsync: Boolean
  /** Находится ли нуклон в процессе получения значения от асинхронного добытчика
   * {@link INucleon.setGetter}*/
  readonly isAwaiting: Boolean

  /** `true` когда нуклон не запоминает значение
   * {@link INucleon.stateless}*/
  readonly isStateless: Boolean

  /** `true` когда нуклон передаёт все аргументы функциям-слушателям
   * {@link INucleon.stateless}*/
  readonly isHoly: Boolean

  /** Добавить функцию-получатель обновлений значения контейнера
   * и передать текущее значение контейнера, если оно есть
   * @param receiver - функция-получатель
   * @returns {@link quark#INucleon}*/
  up(receiver: ValueReceiver<T>): INucleon<T>

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
  parentFor(nucleon: INucleon<T>, parentName?: string): INucleon<T>

  /** Добавить функцию-получатель обновлений значения контейнера
   * с возможностью отписаться {@link INucleon.downLink} по объёкту-ссылке
   * @param receiver - функция-получатель
   * @param linkObject - любой объект для вызова {@link INucleon.downLink}
   * @returns {@link quark#INucleon}*/
  link(linkObject: any, receiver: ValueReceiver<T>): INucleon<T>

  /** Отписать функцию-получатель по объекту ссылки установленную в {@link INucleon.link}
   * @param linkObject - функция-получатель
   */
  downLink(linkObject: any): INucleon<T>

  /** Добавить функцию-получатель и передать значение со следующего обновления
   * @param receiver - функция-получатель
   */
  next(receiver: ValueReceiver<T>): INucleon<T>

  /** Удалить функцию-получатель
   * @param receiver - функция-получатель
   * @returns {@link quark#INucleon}*/
  down(receiver: ValueReceiver<T>): INucleon<T>

  /** Передать один раз в функцию-получатель значение контейнера,
   * текущее если оно есть или как появится
   * @param receiver - функция-получатель
   */
  once(receiver: ValueReceiver<T>): INucleon<T>

  /** Добавить функцию-получатель со вторым аргументом функцией-отмены подписки
   * @param receiver - функция-получатель
   */
  c(receiver: ValueDownReceiver<T>): INucleon<T>

  /** Добавить функцию-получатель значений не равных `null` и `undefined`
   * @param receiver - функция-получатель
   */
  upSome(receiver: ValueReceiver<T>): INucleon<T>

  /** Добавить функцию-получатель значений равных `true`
   * после приведения значения к типу `boolean` методом `!!value`
   * @param receiver - функция-получатель
   */
  upTrue(receiver: ValueReceiver<T>): INucleon<T>

  /** Добавить функцию-получатель значений равных `false`
   * после приведения значения к типу `boolean` методом `!value`
   * @param receiver - функция-получатель
   */
  upFalse(receiver: ValueReceiver<T>): INucleon<T>

  /** Добавить функцию-получатель значений равных `false`
   * после приведения значения к типу `boolean` методом `!value`
   * за исключением `null` и `undefined`
   * @param receiver - функция-получатель
   */
  upSomeFalse(receiver: ValueReceiver<T>): INucleon<T>

  /** Добавить функцию-получатель значений равных `null` и `undefined`
   * @param receiver - функция-получатель
   */
  upNone(receiver: ValueReceiver<T>): INucleon<T>

  /** Проверить значение контейнера на соответствие
   * @param compareValue - проверяемое значение
   * @returns положительно при соответствии заданного значения значению контейнера*/
  is(compareValue: T): boolean

  /** Сгенерировать событие
   * @param event - имя события
   * @param value - необязательное значение
   */
  dispatch(event: string, ...value: any[]): INucleon<T>

  /** Удалить слушатель события {@link INucleon.on}
   * @param event - имя события
   * @param listener - функция-слушатель
   */
  off(event: string, listener: (...value: any[]) => void): INucleon<T>

  /** Добавить слушатель события
   * @param event - имя события
   * @param listener - функция-слушатель
   */
  on(event: string, listener: (...value: any[]) => void): INucleon<T>

  /** Добавить слушатель изменения асинхронного состояния функции добычи значения {@link INucleon.setGetter}
   * @param listener - функция-слушатель
   */
  onAwait(listener: (isAwaiting: boolean) => void): INucleon<T>

  /** Добавить слушатель отчистки значения
   * @remarks
   *  Значение глубины отчистки
   *
   * - value отичстка значения {@link INucleon.clearValue}
   *
   * - all отичстка всего {@link INucleon.clear}
   *
   * - decay рапад {@link INucleon.decay}
   * @param listener - функция-слушатель принимающая строку - значение глубины отчистки
   */
  onClear(listener: (deep: Level) => void): INucleon<T>

  /** Удалить слушатель отчистки зачения {@link INucleon.clearValue}
   * @param listener - функция-слушатель
   */
  offClear(listener: () => void): INucleon<T>

  /** Удалить слушатель изменения асинхронного состояния
   * @param listener - функция-слушатель
   */
  offAwait(listener: AnyFunction): void

  /** Удалить связи всех функций-получателей, слушателей, и очистить значение контейнера
   */
  clearListeners(): INucleon<T>

  /** Очистить значение контейнера
   * @returns {@link quark#INucleon} */
  clearValue(): INucleon<T>

  /** Распад нуклона, форсировать отчистку пямятти, удалить все свойства, функции и ссылки.*/
  decay(): void

  /** Повторно отправить значение всем функциям-получателям
   */
  resend(): INucleon<T>

  /** Вызвать всех слушателей
   */
  emit(): INucleon<T>

  /** Установить идентификатор
   * @param id - идентификатор
   */
  setId(id: string): INucleon<T>

  /** Установить имя
   * @param name - имя
   */
  setName(name: string): INucleon<T>

  /** Добавить мета-данные
   * @param metaName - название-ключ мета-данных
   * @param value - необязательное значение мета-данных
   */
  addMeta(metaName: string, value?: any): INucleon<T>

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
   * @param isAsync - установить значение {@link INucleon.isAsync}
   */
  setGetter(getter: () => T | Promise<T>, isAsync?: boolean): INucleon<T>

  /** Использовать функцию-добытчик только один раз
   * @param getter - функция-добытчик
   * @param isAsync - установить значение {@link INucleon.isAsync}
   */
  setOnceGet(getter: () => T | Promise<T>, isAsync?: boolean): INucleon<T>

  /** Использовать функцию-обёртку
   * Каждое новое обновление значение контейнера нуклона,
   * всегда будет проходить сперва через функцию-обёртку
   * @param wrapper - функция-обёртка
   * @param isAsync - установить значение returns {@link INucleon.isAsync}
   */
  setWrapper(wrapper: (newValue: T, prevValue: T) => T | Promise<T>, isAsync?: boolean): INucleon<T>

  /**
   * Сделать конетейнер всегда пустым.
   * Значение переданное в нуклон, доставится в функции-получатели минуя контейнер.
   * @param bool? - по умолчанию `true`
   */
  stateless(bool?: boolean): INucleon<T>

  /**
   * Сделать конетейнер принимающим и передаюшим множество агрументов.
   * Все аргументы переданные в нуклон, сохраняются как массив.
   * В функции-получатели значения передаются в полном количестве.
   * @param bool? - по умолчанию `true`
   */
  holistic(bool?: boolean): INucleon<T>

  /**
   * Обновление  фукнций-приёмников происходит только при уникальных значениях
   * @param bool? - по умолчанию `true`
   */
  safe(bool?: boolean): INucleon<T>

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
  injectTo(targetObject: any, key?: string): INucleon<T>

  /**
   * Создать нуклон из нескольких других нуклонов и стратегии вычисления.
   * @param nucleons - набор входных нуклонов для вычисления значения
   * @returns {@link ext-computed#ComputeStrategy}
   */
  from<IN extends INucleon<any>[]>(...nucleons: IN): ComputeStrategicNucleon<IN>

  /**
   * Список производных нуклонов {@link from}
   * @returns INucleon<any>[]
   */
  parents: INucleon<any>[]

  /**
   * Подписать текущий нуклон на друой нуклон
   * Отписав его от прошлой настройки
   * Работает как переключить источник
   * @param INucleon<T>
   */
  tuneTo(nucleon: INucleon<T>): void

  /**
   * Отключить нуклон от подключенных ранее через tuneTo
   */

  // private toString():string
}
