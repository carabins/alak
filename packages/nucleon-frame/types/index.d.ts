

//
// /**
//  * @proposal
//  * Объеденить объект с объектом и уведомить слушателей
//  * @param key по умолчанию "id"
//  */
// boxAssign(object: T, context?: INucleon<any>): INucleon<T>
//
// /**
//  * @proposal
//  * Объеденить массив с объектом ключу и уведомить слушателей
//  * @param array: UnpackKV<T>
//  * @param key по умолчанию "id"
//  */
// boxMerge(array: UnpackKV<T>, key?: string | number, context?: INucleon<any>): INucleon<T>
//
// /**
//  * @proposal
//  * Достать значние по ключу из вложенного объекта и уведомить слушателей*
//  * @param key
//  * @returns UnpackKV<T>
//  */
// boxGet(key: string, orInsert?: T): UnpackKV<T>
//
// /**
//  * @proposal
//  * Удалить значние по ключу из вложенного объекта и уведомить слушателей
//  * @param key
//  */
// boxDelete(key: string): INucleon<T>
//
// /**
//  * @proposal
//  * Установить значние по ключу во вложенный объект и уведомить слушателей
//  * @param key
//  * @param value
//  */
// boxSet(key: keyof T, value: UnpackKV<T>, context?: string): INucleon<T>
//
// /**
//  * @proposal
//  * Перебрать значения ключей текущего объекта один раз
//  * Свёрнутый код: Object.values(box).forEach(fun...
//  * @param funIterator
//  */
// boxEach(funIterator: (value: UnpackKV<T>) => void): INucleon<T>
//
// /**
//  * @proposal
//  * Создать новый нуклон на основе значения объекта текущего
//  * обработанного функцией мутатором
//  * @param funMutator
//  * @returns INucleon<KV<U>>
//  */
// boxMap<U>(funMutator: (value: UnpackKV<T>) => U): INucleon<KV<U>>
//
// /**
//  * @proposal
//  * Создать новый нуклон на основе ключей объекта текущего переобразованного в массив
//  * @returns INucleon<UnpackKV<T>[]>
//  */
// boxToList(): INucleon<UnpackKV<T>[]>
//
// /**
//  * @deprecated
//  * * Распаковать ключи объекта и передать каждый в функцию ;
//  * @param funMutator
//  * @returns U[]
//  */
// unboxToMap<U>(funMutator: (value: UnpackKV<T>) => U): Record<string, U>
//
// /**
//  * @proposal
//  * Получить значения объека
//  * Свёрнутая запись : Object.values()
//  * @returns UnpackKV<T>[]
//  */
// unboxToList(): UnpackKV<T>[]

// /** Применить функцию к значению в контейнере
//  * @param fun - функция принимающая текущее значение и возвращающей
//  * новое значение в контейнер и дочерним функциям-получателям
//  * @returns {@link INucleon} */
// applyBefore(fun: (v: T) => T): INucleon<T>

//
// /**
//  * @deprecated
//  * размер внутреннего массива
//  */
// listSize(): number
//
// /**
//  * @proposal
//  * добавить элемент к массиву и уведомить слушателей
//  */
// listAdd(value: UnpackKV<T>, context?: any): INucleon<T>
//
// /**
//  * @proposal
//  * объеденить массив и уведомить слушателей
//  */
// listMerge(list: T, context?: any): INucleon<T>
//
// /**
//  * @proposal
//  * создать новый нуклон на основе текущего
//  */
// listMap<R>(fun: (value: UnpackKV<T>) => R): INucleon<R[]>
//
// /**
//  * @proposal
//  * создать новый нуклон из текущего массива как объект
//  */
// listToBox(key?: string): INucleon<KV<UnpackKV<T>>>
