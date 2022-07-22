import { Nucleus } from '@alaq/nucleus/index'
import { flightySym } from '@alaq/atom/property'

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
    atoms: MoleculeAtoms
    dispatchEvent(name: MoleculeEvents, data?): void
    set(atom: string, nuclon: string, data: any): void
    get(atom: string, nuclon): void
  }
}
