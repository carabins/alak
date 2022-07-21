import { Nucleus } from '@alaq/nucleus/index'
import { atomicNode, atomicNodes } from '@alaq/molecule/atomicNode'
import { flightySym } from '@alaq/atom/property'

export function molecule<
  Atoms extends Record<string, AtomicNode<any>>,
  MultiAtoms extends Record<string, MultiAtomicNode<any, any, any>>,
>(consturctor: { atoms?: Atoms; multi?: MultiAtoms }) {
  const eventBus = Nucleus.stateless().holistic()

  const molecule = {
    atoms: consturctor.atoms,
    multi: consturctor.multi,
    emitEvent: eventBus as {
      (name: Uppercase<string>, data?: any): void
    },
  }

  Object.keys(consturctor.atoms).forEach((key) => {
    consturctor.atoms[key]['name'] = key
    consturctor.atoms[key]['injectBus'] = eventBus
    consturctor.atoms[key]['molecule'] = molecule
  })

  return molecule
}

export default molecule

export class PartOfMolecule {
  _: {
    dispatchEvent(name: MoleculeEvents, data?: any)
    atoms: MoleculeAtoms
  }
  q: any
  private _isPartOfMolecule = {
    sym: flightySym,
    startValue: true,
  }
}
