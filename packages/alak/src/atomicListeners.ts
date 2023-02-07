import { quarkProps } from '@alaq/nucleus/handlers'

const patternOnUpdate = 'onUpdate'
const patternOnEvent = 'onEvent'

const upEnds = ['up', 'upSome', 'upTrue', 'upFalse', 'upSomeFalse', 'upNone', 'upDown']

export default function (q: QuantumAtom) {
  const eventListeners = {}
  Object.keys(q.atom.actions).forEach((name) => {
    ///Deprecated
    if (name.startsWith('on')) {
      const nn = name.replace('on', '')
      if (nn[0] !== nn[0].toUpperCase()) {
        return
      }
      if (checkUp(q, nn, name)) {
        return
      }
      if (nn.endsWith('Listener')) {
        const n = getMidlleName(nn, ['Listener'])
        eventListeners[camelToSnakeCase(n)] = name
        return
      }
    }
    if (q.cluster && name.startsWith('in')) {
      checkIn(q, name.replace('in', ''), name)
    }

    //new style
    if (name.startsWith(patternOnUpdate)) {
      const nucleusName = getNucleusName(name, patternOnUpdate)
      q.atom.core[nucleusName].up(q.atom.actions[name])
    }
    if (name.startsWith(patternOnEvent)) {
      let eventName = getMidlleName(name.replace(patternOnEvent, ''), [])
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
  const atom = q.cluster.atoms[module]

  if (atom) {
    for (const up of upEnds) {
      const c = cap(up)
      if (nn.endsWith(c)) {
        const n = getMidlleName(nn, [cap(module), c])
        if (n) {
          atom.core[n][up](q.atom.actions[name])
          return true
        }
      }
    }
  }
  return false
}

function checkUp(q, nn, name) {
  for (const up of upEnds) {
    const c = cap(up)
    if (nn.endsWith(c)) {
      q.atom.core[getMidlleName(nn, [c])][up](q.atom.actions[name])
      return true
    }
  }
  return false
}

function getMidlleName(str, rm: string[]) {
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
