type Ref<T> =
  | T
  | {
      value: T
    }

type AContext = string | IAtom<any>
type KV<T> = {
  [key: string]: T
}
type UnpackKV<T> = T[keyof T]

/** Интерфейс ядра атома.
 * @remarks
 * Функция-контейнер.
 */
interface IAtom<T> {
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
  cast: T
  ref: T
  links:any
  refWatch: T
  _: T
  /**
   * Только в функциях-приёмниках возвращает предидущее значение
   */
  readonly prev: T

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

  isPrivate: Boolean

  /** `true` когда атом не запоминает значение
   * {@link IAtom.stateless}*/
  readonly isStateless: Boolean

  /** Добавить функцию-получатель обновлений значения контейнера
   * и передать текущее значение контейнера, если оно есть
   * @param receiver - функция-получатель
   * @returns {@link core#IAtom}*/
  up(receiver: ValueReceiver<T>): IAtom<T>

  /** Каррирование, создаёт новую чистую функцию для приёма значения
   * для случаев когда нужны bind, call, apply
   * @param context?:string - контекст для отладки в логах
   * @returns ValueReceiver<T> */
  curry(context: string): ValueReceiver<T>

  /** Установить значение контейнера не уведомляя текущих слушателей
   * @param value?:T - устанавливаемое значние
   * @returns ValueReceiver<T> */
  silent(value: T): ValueReceiver<T>

  /** Добавить атом-получатель обновлений значения контейнера
   * и отписать другого родителя по имени
   * атом-поставшик данных для имени может быть только один
   * @param a:{@link core#IAtom} - атом-получатель
   * @param name:string? - опциональное имя канала
   * @returns {@link core#IAtom}*/
  parentFor(atom: IAtom<T>, parentName?: string): IAtom<T>

  /** Добавить функцию-получатель обновлений значения контейнера
   * с возможностью отписаться {@link IAtom.downLink} по объёкту-ссылке
   * @param receiver - функция-получатель
   * @param linkObject - любой объект для вызова {@link IAtom.downLink}
   * @returns {@link core#IAtom}*/
  link(linkObject: any, receiver: ValueReceiver<T>): IAtom<T>

  /** Отписать функцию-получатель по объекту ссылки установленную в {@link IAtom.link}
   * @param linkObject - функция-получатель
   * @returns {@link IAtom}*/
  downLink(linkObject: any): IAtom<T>

  /** Добавить функцию-получатель и передать значение со следующего обновления
   * @param receiver - функция-получатель
   * @returns {@link IAtom}*/
  next(receiver: ValueReceiver<T>): IAtom<T>

  /** Удалить функцию-получатель
   * @param receiver - функция-получатель
   * @returns {@link core#IAtom}*/
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

  /** Сгенерировать событие
   * @param event - имя события
   * @param value - необязательное значение
   * @returns {@link IAtom}*/
  dispatch(event: string, ...value: any[]): IAtom<T>

  /** Удалить слушатель события {@link IAtom.on}
   * @param event - имя события
   * @param listener - функция-слушатель
   * @returns {@link IAtom}*/
  off(event: string, listener: (...value: any[]) => void): IAtom<T>

  /** Добавить слушатель события
   * @param event - имя события
   * @param listener - функция-слушатель
   * @returns {@link IAtom}*/
  on(event: string, listener: (...value: any[]) => void): IAtom<T>

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
  clearListeners(): IAtom<T>

  /** Очистить значение контейнера
   * @returns {@link core#IAtom} */
  clearValue(): IAtom<T>

  /** Распад атома, форсировать отчистку пямятти, удалить все свойства, функции и ссылки.*/
  decay(): void

  /** Повторно отправить значение всем функциям-получателям
   * @returns {@link IAtom} */
  resend(): IAtom<T>

  /** Вызвать всех слушателей
   * @returns {@link IAtom} */
  emit(): IAtom<T>

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
  holistic(bool?: boolean): IAtom<T>

  /**
   * Обновление  фукнций-приёмников происходит только при уникальных значениях
   * @param bool? - по умолчанию `true`
   * @returns {@link IAtom} */
  setFiniteLoop(bool?: boolean): IAtom<T>

  /** Применить функцию к значению в контейнере
   * @param fun - функция принимающая текущее значение и возвращающей
   * новое значение в контейнер и дочерним функциям-получателям
   * @returns {@link IAtom} */
  mix(fun: (v: T) => T): IAtom<T>

  /**
   * @deprecated
   */
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
  injectTo(targetObject: any, key?: string): IAtom<T>

  /**
   * Создать атом из нескольких других атомов и стратегии вычисления.
   * @param atoms - набор входных атомов для вычисления значения
   * @returns {@link ext-computed#ComputeStrategy}
   */
  from<IN extends IAtom<any>[]>(...atoms: IN): ComputeStrategicAtom<IN>

  /**
   * Список производных атомов {@link from}
   * @returns IAtom<any>[]
   */
  parents: IAtom<any>[]

  /**
   * @proposal
   * Объеденить объект с объектом и уведомить слушателей
   * @param key по умолчанию "id"
   */
  boxAssign(object: T, context?: IAtom<any>): IAtom<T>

  /**
   * @proposal
   * Объеденить массив с объектом ключу и уведомить слушателей
   * @param array: UnpackKV<T>
   * @param key по умолчанию "id"
   */
  boxMerge(array: UnpackKV<T>, key?: string | number, context?: IAtom<any>): IAtom<T>

  /**
   * @proposal
   * Достать значние по ключу из вложенного объекта и уведомить слушателей*
   * @param key
   * @returns UnpackKV<T>
   */
  boxGet(key: string, orInsert?: T): UnpackKV<T>

  /**
   * @proposal
   * Удалить значние по ключу из вложенного объекта и уведомить слушателей
   * @param key
   */
  boxDelete(key: string): IAtom<T>

  /**
   * @proposal
   * Установить значние по ключу во вложенный объект и уведомить слушателей
   * @param key
   * @param value
   */
  boxSet(key: keyof T, value: UnpackKV<T>, context?: string): IAtom<T>

  /**
   * @proposal
   * Перебрать значения ключей текущего объекта один раз
   * Свёрнутый код: Object.values(box).forEach(fun...
   * @param funIterator
   */
  boxEach(funIterator: (value: UnpackKV<T>) => void): IAtom<T>

  /**
   * @proposal
   * Создать новый атом на основе значения объекта текущего
   * обработанного функцией мутатором
   * @param funMutator
   * @returns IAtom<KV<U>>
   */
  boxMap<U>(funMutator: (value: UnpackKV<T>) => U): IAtom<KV<U>>

  /**
   * @proposal
   * Создать новый атом на основе ключей объекта текущего переобразованного в массив
   * @returns IAtom<UnpackKV<T>[]>
   */
  boxToList(): IAtom<UnpackKV<T>[]>

  /**
   * @deprecated
   * * Распаковать ключи объекта и передать каждый в функцию ;
   * @param funMutator
   * @returns U[]
   */
  unboxToMap<U>(funMutator: (value: UnpackKV<T>) => U): KV<U>

  /**
   * @proposal
   * Получить значения объека
   * Свёрнутая запись : Object.values()
   * @returns UnpackKV<T>[]
   */
  unboxToList(): UnpackKV<T>[]

  /**
   * Подписать текущий атом на друой атом
   * Отписав его от прошлой настройки
   * Работает как переключить источник
   * @param IAtom<T>
   */
  tuneTo(atom: IAtom<T>): void

  /**
   * Отключить атом от подключенных ранее через tuneTo
   */
  tuneOff(): void

  /**
   * @deprecated
   * размер внутреннего массива
   */
  listSize(): number

  /**
   * @proposal
   * добавить элемент к массиву и уведомить слушателей
   */
  listAdd(value: UnpackKV<T>, context?: any): IAtom<T>

  /**
   * @proposal
   * объеденить массив и уведомить слушателей
   */
  listMerge(list: T, context?: any): IAtom<T>

  /**
   * @proposal
   * создать новый атом на основе текущего
   */
  listMap<R>(fun: (value: UnpackKV<T>) => R): IAtom<R[]>

  /**
   * @proposal
   * создать новый атом из текущего массива как объект
   */
  listToBox(key?: string): IAtom<KV<UnpackKV<T>>>
}
