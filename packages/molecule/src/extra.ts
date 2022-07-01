export function AssignMolecule(molecule, object?) {
  const as = (o) =>
    Object.keys(o).forEach((key) => {
      molecule[key](o[key])
      // console.log("as", key, molecule[key].uid, molecule[key].value)
    })
  if (object) {
    as(object)
  } else {
    return (o) => as(o)
  }
}

export const isDefined = (v) => v !== undefined && v !== null

export function eternalAtom(atom: IAtom<any>, atomId: string) {
  const id = atomId || atom.id
  const v = JSON.parse(localStorage.getItem(id))
  // console.log(typeof v, id, v)
  isDefined(v) && atom(v)
  atom.up((v) => {
    localStorage.setItem(id, JSON.stringify(v))
  })
}
