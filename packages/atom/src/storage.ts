let isBrowser = new Function('try {return this===window;}catch(e){ return false;}')
let isServer = !isBrowser()

// type IStorage = {
//   init(nucleon: INucleon<any>): void
//   clear?(): void
// }

export const storage = {
  init(nucleon: INucleon<any>) {
    if (isServer) return false
    let v = localStorage.getItem(nucleon.id)
    if (v && v != 'undefined') {
      let vv = JSON.parse(v)
      nucleon(vv)
      nucleon.next((v) => localStorage.setItem(nucleon.id, JSON.stringify(v)))
    }
    nucleon.onClear(() => {
      localStorage.removeItem(nucleon.id)
    })
    nucleon.up((v) => {
      localStorage.setItem(nucleon.id, JSON.stringify(v))
    })
  },
}
