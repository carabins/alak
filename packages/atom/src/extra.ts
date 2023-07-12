namespace Atom {
  export function assign(atom, ...object) {
    const as = (o) =>
      Object.keys(o).forEach((key) => {
        atom[key](o[key])
      })
    if (object.length) {
      object.forEach(as)
    } else {
      return (o) => as(o)
    }
  }
}

export const isDefined = (v) => v !== undefined && v !== null

export function savedNucleon(nucleon: INucleon<any>, nucleonId: string) {
  const id = nucleonId || nucleon.id
  const v = JSON.parse(localStorage.getItem(id))
  isDefined(v) && nucleon(v)
  nucleon.up((v) => {
    localStorage.setItem(id, JSON.stringify(v))
  })
}
