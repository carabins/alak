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

  for (const actionName of Object.keys(q.atom.actions)) {
    if (!actionName.startsWith('_')) {
      continue
    }
    if (actionName.startsWith(pattern4Event)) {
      // const eventName = camelToSnakeCase(actionName.replace(pattern4Event, '')).toUpperCase()
      const eventName = actionName.replace(pattern4Event, '')
      eventListeners[eventName] = actionName
      continue
    }
    const parts = actionName.split("_")
    parts.shift()
    if (parts.length < 2) {
      continue;
    }
    let _, moduleName, nucleusName, listenerType
    if (actionName.startsWith(pattern4Atom)) {
      ;[moduleName, nucleusName, listenerType] = parts
      moduleName = moduleName.replace('$', '')
      const atom = q.union.facade.atoms[moduleName]
      // console.log({parts})
      // console.log({moduleName, nucleusName, actionName})
      atom && subscribeAtom(atom, nucleusName, q.atom.actions[actionName], listenerType)
      continue
    }
    ;[nucleusName, listenerType] = parts
    subscribeAtom(q.atom, nucleusName, q.atom.actions[actionName], listenerType)
  }
  return Object.keys(eventListeners).length ? eventListeners : false
}

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
