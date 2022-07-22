import create from './create'

import cloudCreate from './cloud.create'

export const eternalAtom = <T>(name: string, model: T) => create(model).name(name).eternal().one()
export const eternalAtoms = <T>(name: string, model: T) => create(model).name(name).eternal().many()

export const pureAtom = <T>(model: T) => create(model).one()
export const pureAtoms = <T>(model: T) => create(model).many()

export const createAtom = create

export const Atom = cloudCreate

export const A = cloudCreate

export class MultiAtomic {
  id: string | any
}