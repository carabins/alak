import { AtomFactory, AtomInstance, AtomOptions } from './types'

export interface AtomRepository<T> {
  /** 
   * Get or create a singleton/instance based on arguments 
   */
  (args?: any): AtomInstance<T>
  
  /**
   * Get an existing instance by ID or create a new one.
   * @param idOrObj ID string/number, or object with 'id' property, or constructor argument object
   */
  get(idOrObj?: any): AtomInstance<T>
  
  /**
   * Create a new anonymous instance (bypassing the Identity Map)
   */
  create(args?: any[], options?: AtomOptions): AtomInstance<T>
  
  /**
   * Destroy an instance by ID and remove from repository
   */
  decay(id: string): void
  
  /**
   * Destroy all instances
   */
  clear(): void
  
  /**
   * Check if instance exists
   */
  has(id: string): boolean
  
  /**
   * Get number of active instances
   */
  get size(): number
}

export function createAtomRepository<T>(
  factory: AtomFactory<T>, 
  modelName: string,
  repositoryOptions: AtomOptions = {}
): AtomRepository<T> {
  const instances = new Map<string, AtomInstance<T>>()
  const SINGLETON_ID = '$'

  function resolveId(arg: any): string | undefined {
    if (arg === undefined || arg === null) return undefined
    if (typeof arg === 'string' || typeof arg === 'number') return String(arg)
    if (typeof arg === 'object' && 'id' in arg) return String(arg.id)
    return undefined
  }

  function get(idOrObj?: any): AtomInstance<T> {
    const id = resolveId(idOrObj) ?? SINGLETON_ID
    
    if (instances.has(id)) {
      return instances.get(id)!
    }

    // Prepare args
    let args: any[] = []
    if (idOrObj !== undefined && idOrObj !== null) {
       args = [idOrObj]
    }

    // Determine Scope
    const scope = id === SINGLETON_ID ? modelName : `${modelName}.${id}`

    const instance = factory(args, { 
      ...repositoryOptions,
      name: `${modelName}#${id}`,
      scope: scope
    })
    
    // Patch decay to cleanup repository
    const originalDecay = instance.$.decay
    instance.$.decay = () => {
      instances.delete(id)
      originalDecay.call(instance.$)
    }

    instances.set(id, instance)
    return instance
  }

  function create(args?: any[], options?: AtomOptions): AtomInstance<T> {
    return factory(args, { ...repositoryOptions, ...options })
  }

  function decay(id: string) {
    const instance = instances.get(id)
    if (instance) {
      instance.$.decay() // This will trigger delete from map via patched decay
    }
  }

  function clear() {
    instances.forEach(i => i.$.decay())
    instances.clear()
  }

  const repo = get as AtomRepository<T>
  repo.get = get
  repo.create = create
  repo.decay = decay
  repo.clear = clear
  repo.has = (id: string) => instances.has(id)
  Object.defineProperty(repo, 'size', { get: () => instances.size })

  return repo
}
