// const upEnds = new Set(['up', 'upSome', 'upTrue', 'upFalse', 'upSomeFalse', 'upNone', 'upDown'])
const pattern4Atom = '_$'
const pattern4Event = "_on_"

// const upEnds = new Set(['up', 'upSome', 'upTrue', 'upFalse', 'upSomeFalse', 'upNone', 'upDown'])

const subscribeAtom = (atom, nucleusName, listener, listenerType) => {
  if (listenerType) {
    atom.core[nucleusName][listenerType](listener)
  } else {
    atom.core[nucleusName](listener)
  }
}
export default function (q: QuantumAtom) {
  const eventListeners = {}
  let _, moduleName, nucleusName, listenerType
  Object.keys(q.atom.actions).forEach((actionName) => {
    if (!actionName.startsWith('_')) {
      return
    }
    const parts = actionName.split("_")
    parts.shift()
    if (parts.length < 2) {
      return;
    }

    switch (true) {
      case actionName.startsWith(pattern4Event):
        const eventName = camelToSnakeCase(actionName.replace(pattern4Event, '')).toUpperCase()
        eventListeners[eventName] = actionName
        break
      case actionName.startsWith(pattern4Atom):
        ; [moduleName, nucleusName, listenerType] = parts
        moduleName = moduleName.replace('$', '')
        const atom = q.union.facade.atoms[moduleName]
        // console.log(":::", q.name, q.union.namespace, q)
        // console.log("---",  moduleName, nucleusName, atom.core[nucleusName].uid)
        atom && subscribeAtom(atom, nucleusName, q.atom.actions[actionName], listenerType)
      break
      default:
        ; [nucleusName, listenerType] = parts
        subscribeAtom(q.atom, nucleusName, q.atom.actions[actionName], listenerType)
    }
  })
  return Object.keys(eventListeners).length ? eventListeners : false
}

// function getNucleusName(str, pattern) {
//   str = str.replace(pattern, '')
//   if (str.startsWith('_')) {
//     str = str.slice(0, -1)
//   }
//   return str.replaceAt(0, str[0].toLowerCase())
// }
//
//
// function getMiddleName(str, rm: string[]) {
//   rm.forEach((v) => {
//     str = str.replace(v, '')
//   })
//   return str.substring(0, 0) + str[0].toLowerCase() + str.substring(1)
// }

function cap(str) {
  return str.substring(0, 0) + str[0].toUpperCase() + str.substring(1)
}

String.prototype['replaceAt'] = function (index, replacement) {
  return this.substring(0, index) + replacement + this.substring(index + replacement.length)
}

const camelToSnakeCase = (str) => {
  str = str.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()
  if (str.startsWith('_')) {
    return str.slice(1)
  }
  return str
}
