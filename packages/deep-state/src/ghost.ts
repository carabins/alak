import { IDeepState } from './types'

export const GHOST_SYMBOL = Symbol('GHOST')

const ghostHandler: ProxyHandler<any> = {
  get(target, key) {
    if (key === GHOST_SYMBOL) return true
    
    // Примитивные конвертации -> undefined
    if (key === Symbol.toPrimitive || key === 'valueOf' || key === 'toString' || key === 'toJSON') {
      return () => undefined
    }
    
    // Избегаем thenable поведения (чтобы await ghost не висел вечно)
    if (key === 'then') return undefined

    // Любой другой доступ -> Новый призрак (рекурсия)
    const parentPath = target.path
    const newPath = parentPath ? parentPath + '.' + String(key) : String(key)
    
    // Мы находимся внутри призрака, значит onGhost уже был вызван при входе.
    // Здесь мы просто продолжаем путь.
    // НО: Если мы хотим поддерживать ленивую загрузку вложенных полей,
    // возможно стоит триггерить onGhost и здесь?
    // Решение: Нет, onGhost ("дай мне данные по этому пути") должен вызываться при переходе границы.
    // Если мы уже в призраке, значит данных нет выше.
    
    return createGhost(target.root, newPath)
  },
  
  apply() {
    return undefined 
  }
}

export function createGhost(root: IDeepState['root'], path: string) {
  const ghostTarget = function() {}
  ;(ghostTarget as any).root = root
  ;(ghostTarget as any).path = path
  
  return new Proxy(ghostTarget, ghostHandler)
}

export function isGhost(val: any) {
  return val && val[GHOST_SYMBOL] === true
}
