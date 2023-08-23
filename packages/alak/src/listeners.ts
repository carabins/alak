const patternOnUpdate = 'onUpdate'
const patternOnEvent = 'onEvent'

const upEnds = ['up', 'upSome', 'upTrue', 'upFalse', 'upSomeFalse', 'upNone', 'upDown']

export default function (q: QuantumAtom) {
  const eventListeners = {}
  Object.keys(q.atom.actions).forEach((name) => {
    if ( name.startsWith('in')) {
      checkIn(q, name.replace('in', ''), name)
    }
    if (name.startsWith(patternOnUpdate)) {
      const nucleusName = getNucleusName(name, patternOnUpdate)
      q.atom.core[nucleusName].up(q.atom.actions[name])
    }
    if (name.startsWith(patternOnEvent)) {
      let eventName = getMiddleName(name.replace(patternOnEvent, ''), [])
      eventListeners[camelToSnakeCase(eventName)] = name
    }
  })

  return Object.keys(eventListeners).length ? eventListeners : false
}

function getNucleusName(str, pattern) {
  str = str.replace(pattern, '')
  if (str.startsWith('_')) {
    str = str.slice(0, -1)
  }
  return str.replaceAt(0, str[0].toLowerCase())
}

function checkIn(q, nn, name) {
  const parts = camelToSnakeCase(nn).split('_')
  if (parts.length <= 1) {
    return false
  }
  const module = parts[1].toLowerCase()
  const atom = q.union.services.atoms[module]

  if (atom) {
    for (const up of upEnds) {
      const c = cap(up)
      if (nn.endsWith(c)) {
        const n = getMiddleName(nn, [cap(module), c])
        if (n) {
          atom.core[n][up](q.atom.actions[name])
          return true
        }
      }
    }
  }
  return false
}

function getMiddleName(str, rm: string[]) {
  rm.forEach((v) => {
    str = str.replace(v, '')
  })
  return str.substring(0, 0) + str[0].toLowerCase() + str.substring(1)
}

function cap(str) {
  return str.substring(0, 0) + str[0].toUpperCase() + str.substring(1)
}

String.prototype['replaceAt'] = function (index, replacement) {
  return this.substring(0, index) + replacement + this.substring(index + replacement.length)
}

const camelToSnakeCase = (str) => str.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()
