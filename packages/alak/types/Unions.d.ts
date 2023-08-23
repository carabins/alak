
type UnionFacades = {
  ActiveUnion: UnionFacade<any>
}

interface UnionCoreService {
  atoms: Record<string, AlakAtom<any>>
  bus: QuarkBus<any, any>
}

type UnionCore = {
  bus: QuarkBus<any, any>
  facade: UnionFacade<any>
  services: UnionCoreService
}

type UnionFacade<Models> = {
  readonly atoms: { [K in keyof Models]: AlakAtom<Models[K]> }
  readonly name: string
  readonly nucleons: { [K in keyof Models]: AtomCore<Instance<Models[K]>>; };
  readonly states: { [K in keyof Models]: ModelState<Models[K]>; };
  readonly buses: { [K in keyof Models]: QuarkBus<any, any>; };
  readonly bus: QuarkBus<string, any>;
}
