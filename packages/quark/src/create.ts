/**
 * Quark Creation - создание кварка с оптимизациями
 */

import { HAS_LISTENERS, HAS_EVENTS, HAS_REALM, WAS_SET, DEDUP, STATELESS, SILENT } from './flags'
import { quantumBus } from './quantum-bus'
import { quarkProto } from './prototype'

type Listener<T> = (value: T, quark: any) => void

let uidCounter = 0

/** Установка значения (максимально оптимизированная) */
export function setValue(quark: any, value: any) {
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

  // SILENT: пропустить все уведомления
  if (flags & SILENT) {
    return value
  }

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
    const listeners = quark.listeners
    for (let i = 0, len = listeners.length; i < len; i++) {
      listeners[i](value, quark)
    }
    return value
  }

  // Notify listeners
  if (flags & HAS_LISTENERS) {
    const listeners = quark.listeners
    for (let i = 0, len = listeners.length; i < len; i++) {
      listeners[i](value, quark)
    }
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
export interface QuOptions<T = any> {
  value?: T
  realm?: string
  id?: string
  dedup?: boolean
  stateless?: boolean
  pipe?: (value: T) => T | undefined
}

/** Создание кварка - HYBRID */
export function createQu<T>(options?: QuOptions<T>): any {
  const quark = function(this: any, value: any) {
    return setValue(quark, value)
  } as any

  // CRITICAL FIELDS - всегда для monomorphic shape
  quark.uid = ++uidCounter
  quark._flags = 0

  // VALUE - только если есть
  if (options?.value !== undefined) {
    quark.value = options.value
  }

  // ID - только если есть
  if (options?.id) {
    quark.id = options.id
  }

  // REALM - условно (только если нужен)
  if (options?.realm) {
    quark._realm = options.realm
    quark._realmPrefix = options.realm + ':'
    quark._flags |= HAS_REALM
  }

  // PIPE - только если есть
  if (options?.pipe) {
    quark._pipeFn = options.pipe
  }

  // FLAGS - устанавливаем если нужны
  if (options?.dedup) {
    quark._flags |= DEDUP
  }
  if (options?.stateless) {
    quark._flags |= STATELESS
  }

  // LISTENERS, EVENTS - НЕ инициализируем! Lazy!
  // Будут созданы в up(), on() и т.д.

  // Прототип
  Object.setPrototypeOf(quark, quarkProto)

  return quark
}
