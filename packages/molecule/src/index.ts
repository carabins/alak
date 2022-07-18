import {Nucleus} from "@alaq/nucleus/index";
import {atomicNode, atomicNodes} from "@alaq/molecule/atomicNode";






export function molecule<Atoms extends Record<string, AtomicNode<any, any>>,
  MultiAtoms extends Record<string, MultiAtomicNode<any, any, any, any>>>
(consturctor: {
  atoms?: Atoms
  multi?: MultiAtoms
}) {

  const eventBus = Nucleus.stateless().holistic()
  Object.keys(consturctor.atoms).forEach(key => {
    consturctor.atoms[key]['name'] = key
    consturctor.atoms[key]['eventBus'] = eventBus
  })
  return {
    atoms: consturctor.atoms,
    multi: consturctor.multi,
    emitEvent: eventBus as {
      (name: Uppercase<string>, data?: any): void
    }
  }
}
export default molecule
