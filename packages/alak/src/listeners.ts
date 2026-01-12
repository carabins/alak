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

  const addEventListener = (event, action) => {
      if (eventListeners[event]) {
          if (Array.isArray(eventListeners[event])) {
              eventListeners[event].push(action)
          } else {
              eventListeners[event] = [eventListeners[event], action]
          }
      } else {
          eventListeners[event] = action
      }
  }

  for (const actionName of Object.keys(q.atom.actions)) {
    if (!actionName.startsWith('_')) {
      continue
    }

    // New Scheme: $ separator
    if (actionName.includes('$')) {
      // Event: _on$event
      if (actionName.startsWith('_on$')) {
        let eventName = actionName.substring(4)
        if (eventName === 'init') eventName = 'INIT' // Map init to INIT for compatibility
        addEventListener(eventName, actionName)
        continue
      }

      // Nucleus listener: _nucleus$type (excluding legacy _$ external listeners)
      if (!actionName.startsWith('_$')) {
        const parts = actionName.split('$')
        if (parts.length === 2) {
          const [prefix, listenerType] = parts
          const nucleusName = prefix.substring(1)
          if (nucleusName && q.atom.core[nucleusName]) {
             subscribeAtom(q.atom, nucleusName, q.atom.actions[actionName], listenerType)
             continue
          }
        }
      }
    }

    // Legacy Scheme
    if (actionName.startsWith(pattern4Event)) {
      // const eventName = camelToSnakeCase(actionName.replace(pattern4Event, '')).toUpperCase()
      const eventName = actionName.replace(pattern4Event, '')
      addEventListener(eventName, actionName)
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
    if (q.atom.core[nucleusName]) { // Add safety check
        subscribeAtom(q.atom, nucleusName, q.atom.actions[actionName], listenerType)
    }
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
