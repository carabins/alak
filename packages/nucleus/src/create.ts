import { createQuark } from './quark'
import { handlers, props } from './handlers'
import { pluginRegistry } from './plugin'

const quant = {
  extensions: {} as Record<string, AnyFunction>,
}

/**
 * Установить расширения нуклона
 */
export function nucleonExtensions(...extensions: NucleonExtension[]) {
  extensions.forEach((ext) => {
    Object.assign(quant.extensions, ext)
  })
}

const proxy = {
  get(q, key) {
    // Сначала проверяем plugin properties
    const pluginProperty = pluginRegistry.properties[key]
    if (pluginProperty && pluginProperty.get) {
      const r = q[key]
      // Если это plugin property и значение undefined, вызываем plugin getter
      if (r === undefined || r === null) {
        return pluginProperty.get.call(q)
      }
      // Если есть существующее значение - сохраняем его в мета, но используем plugin
      const metaKey = `__existing_${String(key)}`
      if (!q.hasMeta || !q.hasMeta(metaKey)) {
        q.addMeta && q.addMeta(metaKey, r)
      }
      return pluginProperty.get.call(q)
    }

    // Проверяем plugin methods и handlers ПЕРЕД обращением к quark свойствам
    // Это важно чтобы переопределить встроенные методы функций (bind, call, apply и т.д.)
    let f = pluginRegistry.extensions[key] || handlers[key]
    if (f) {
      return (...a) => f.call(q, ...a)
    }

    // Проверяем extensions и props - они вызываются как геттеры
    f = quant.extensions[key] || props[key]
    if (f) {
      return f.apply(q)
    }

    // Теперь проверяем существующее значение в quark
    const r = q[key]
    if (r || typeof r != 'undefined' || r != null) {
      return r
    }

    return r
  },

  set(q, key, value) {
    // Проверяем plugin properties (setters)
    const pluginProperty = pluginRegistry.properties[key]
    if (pluginProperty && pluginProperty.set) {
      // Расширение: вызываем plugin setter
      pluginProperty.set.call(q, value)

      // Если было существующее значение, можем также обновить его
      const metaKey = `__existing_${String(key)}`
      if (q.hasMeta && q.hasMeta(metaKey)) {
        q.addMeta(metaKey, value)
      }

      return true
    }

    // Стандартное поведение
    q[key] = value
    return true
  }
}

export function createNucleus<T>(value?: T) {
  const quark = createQuark(...arguments)
  quark._ = new Proxy(quark, proxy)

  // Вызываем init hooks всех плагинов
  pluginRegistry.initHooks.forEach(hook => hook(quark))

  return quark._
}
