import { GetUnionCore } from './UnionCore'
import { ActiveUnions, CurrentNamespace, defaultNamespace } from './namespaces'

// Extract Models from IUnionCore
type ExtractModels<UC> = UC extends IUnionCore<infer M, any, any, any> ? M : never

// Parse atom name with suffix
type ParseAtomName<S extends string> =
  S extends `${infer Base}Atom` ? { base: Capitalize<Base>, part: 'atom' } :
  S extends `${infer Base}Core` ? { base: Capitalize<Base>, part: 'core' } :
  S extends `${infer Base}State` ? { base: Capitalize<Base>, part: 'state' } :
  S extends `${infer Base}Actions` ? { base: Capitalize<Base>, part: 'actions' } :
  { base: Capitalize<S>, part: 'bundle' }

// Atom bundle for a single atom
type AtomBundle<M> = {
  atom: IAtom<Instance<M>>
  core: IAtomCore<Instance<M>>
  state: () => IModelState<M>
  actions: Actions<Instance<M>>
}

// Get correct type based on part
type GetAtomPart<M, Part> =
  Part extends 'atom' ? IAtom<Instance<M>> :
  Part extends 'core' ? IAtomCore<Instance<M>> :
  Part extends 'state' ? () => IModelState<M> :
  Part extends 'actions' ? Actions<Instance<M>> :
  Part extends 'bundle' ? AtomBundle<M> :
  never

// Helper to get model from parsed name
type GetModel<NS extends keyof ActiveUnions, Parsed> =
  Parsed extends { base: infer Base, part: any }
    ? Base extends keyof ExtractModels<ActiveUnions[NS]>
      ? ExtractModels<ActiveUnions[NS]>[Base]
      : never
    : never

// Q injector type
type QInjector<NS extends keyof ActiveUnions> = {
  <Name extends string>(
    name: Name
  ): ParseAtomName<Name> extends infer Parsed
    ? GetModel<NS, Parsed> extends infer M
      ? M extends never
        ? any
        : Parsed extends { part: infer Part }
          ? GetAtomPart<M, Part>
          : never
      : never
    : never

  realm<NS2 extends keyof ActiveUnions>(ns: NS2): QInjector<NS2>
}

// Runtime implementation
function createQ(namespace: string): any {
  const q = function(name: string) {
    const suffixes = [
      { suffix: 'Atom', key: 'atom' },
      { suffix: 'Core', key: 'core' },
      { suffix: 'State', key: 'state' },
      { suffix: 'Actions', key: 'actions' }
    ]

    // Try to match suffix
    for (const { suffix, key } of suffixes) {
      if (name.endsWith(suffix)) {
        const baseName = name.slice(0, -suffix.length)
        // Convert first letter to lowercase for atom lookup
        const atomName = baseName[0].toLowerCase() + baseName.slice(1)

        const uc = GetUnionCore(namespace)
        const atom = uc.services.atoms[atomName]

        if (!atom) return undefined

        if (key === 'atom') return atom
        if (key === 'core') return atom.core
        if (key === 'state') return () => atom.state
        if (key === 'actions') return atom.actions
      }
    }

    // No suffix - return full bundle
    // Convert first letter to lowercase for atom lookup
    const atomName = name[0].toLowerCase() + name.slice(1)
    const uc = GetUnionCore(namespace)
    const atom = uc.services.atoms[atomName]

    if (!atom) return undefined

    return {
      atom,
      core: atom.core,
      state: () => atom.state,
      actions: atom.actions
    }
  }

  q.realm = (ns: string) => createQ(ns)

  return q
}

// Main Q - bound to current namespace
export const Q: QInjector<CurrentNamespace> = createQ(defaultNamespace)

// Factory for creating namespace-specific Q
export function QRealm<NS extends keyof ActiveUnions>(namespace: NS): QInjector<NS> {
  return createQ(namespace as string) as QInjector<NS>
}
