import { Nucleus } from '@alaq/nucleus/index'

export class ActiveMolecule {
  atoms = {} as Record<string, AtomicNode<any>>
  eventBus = Nucleus.holistic().stateless()

  public constructor(public namespace: string) {}
}

const activeMolecules = {}

export function getMolecule(id: string = 'molecule'): ActiveMolecule {
  let am = activeMolecules[id]
  if (!am) {
    am = activeMolecules[id] = new ActiveMolecule(id)
  }
  return am
}

export abstract class PartOfMolecule {
  _: {
    id: any
    name: string
    core: Record<string, INucleon<any>>
    molecule: Record<string, AtomicNode<any>>
    dispatchEvent(name: MoleculeEvents, data?): void
    set(atom: string, nuclon: string, data: any): void
    get(atom: string, nuclon): void
  }
}
