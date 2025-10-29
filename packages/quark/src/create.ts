/**
 * Quark Creation - создание кварка с оптимизациями
 */

import { HAS_LISTENERS, HAS_EVENTS, HAS_REALM, WAS_SET, DEDUP, STATELESS } from './flags'
import { quantumBus } from './quantum-bus'
import { quarkProto } from './prototype'

type Listener<T> = (value: T, quark: any) => void

let uidCounter = 0

/** Установка значения (максимально оптимизированная) */
function setValue(quark: any, value: any) {
  const flags = quark._flags

  // Pipe: трансформация/валидация
  if (quark._pipeFn) {
    const transformed = quark._pipeFn(value)
    if (transformed === undefined) return quark.value // Отклонено
    value = transformed
  }

  // Dedup: пропустить если значение не изменилось
  if ((flags & DEDUP) && quark.value === value) {
    return value
  }

  const wasSet = flags & WAS_SET

  // Stateless: не сохранять значение
  if (!(flags & STATELESS)) {
    quark.value = value
  }

  quark._flags |= WAS_SET

  // Первая установка → QUARK_AWAKE
  if (!wasSet && (flags & HAS_REALM)) {
    quantumBus.emit(quark._realm, 'QUARK_AWAKE', {
      id: quark.id,
      value,
      quark
    })
  }

  // Fast path: ничего нет
  if (flags === WAS_SET) return value

  // Fast path: только listeners
  if (flags === (HAS_LISTENERS | WAS_SET)) {
    quark.listeners.forEach((fn: Listener<any>) => fn(value, quark))
    return value
  }

  // Notify listeners
  if (flags & HAS_LISTENERS) {
    quark.listeners.forEach((fn: Listener<any>) => fn(value, quark))
  }

  // Emit change event (если есть слушатели)
  if ((flags & HAS_EVENTS) && quark._eventCounts?.change) {
    const eventData = { id: quark.id, value }
    quark._events.get('change').forEach((fn: any) => fn(eventData))
  }

  // Emit в realm bus
  if (flags & HAS_REALM) {
    if (quantumBus.hasListeners(quark._realm, 'change')) {
      quantumBus.emit(quark._realm, 'change', {
        id: quark.id,
        value,
        quark
      })
    }
  }

  return value
}

/** Опции создания */
interface QuOptions<T = any> {
  value?: T
  realm?: string
  id?: string
  dedup?: boolean
  stateless?: boolean
  pipe?: (value: T) => T | undefined
}

/** Создание кварка */
export function createQu<T>(options?: QuOptions<T>): any {
  const quark = function(this: any, ...args: any[]) {
    if (args.length > 0) {
      return setValue(quark, args[0])
    } else {
      return quark.value
    }
  } as any

  // Базовая инициализация
  quark.uid = ++uidCounter
  quark._flags = 0
  quark.id = options?.id
  quark._pipeFn = options?.pipe || null

  // Realm
  if (options?.realm) {
    quark._realm = options.realm
    quark._realmPrefix = options.realm + ':'
    quark._flags |= HAS_REALM
  }

  // Dedup
  if (options?.dedup) {
    quark._flags |= DEDUP
  }

  // Stateless
  if (options?.stateless) {
    quark._flags |= STATELESS
  }

  // Прототип
  Object.setPrototypeOf(quark, quarkProto)

  // Начальное значение (без setValue чтобы не тригерить QUARK_AWAKE)
  if (options?.value !== undefined) {
    quark.value = options.value
  }

  return quark
}
