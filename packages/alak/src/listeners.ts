const upStart = '$'
// const upModuleStart = '$'
const patternOnEvent = 'on$'

const upEnds = new Set(['up', 'upSome', 'upTrue', 'upFalse', 'upSomeFalse', 'upNone', 'upDown'])

const subscribeAtom = (atom, nucleusName, actionName, listenerType) => {
  if (upEnds.has(listenerType)) {
    atom.core[nucleusName][listenerType](atom.actions[actionName])
  } else {
    atom.core[nucleusName].up(atom.actions[actionName])
  }
}
export default function (q: QuantumAtom) {
  const eventListeners = {}
  Object.keys(q.atom.actions).forEach((actionName) => {
    if (actionName.startsWith('_')) {
      const processName = actionName.slice(1)
      let _, module, nucleusName, listenerType
      switch (true) {
        case processName.startsWith(patternOnEvent):
          const eventName = camelToSnakeCase(processName.replace(patternOnEvent, '')).toUpperCase()

          eventListeners[eventName] = actionName
          break
        case processName.startsWith(upStart):
          ;[_, module, nucleusName, listenerType] = processName.split(upStart)
          const atom = q.union.services.atoms[module]
          atom && subscribeAtom(atom, nucleusName, actionName, listenerType)
          break
        case processName.includes(upStart):
          ;[nucleusName, listenerType] = processName.split(upStart)
          subscribeAtom(q.atom, nucleusName, actionName, listenerType)
          break
      }
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
