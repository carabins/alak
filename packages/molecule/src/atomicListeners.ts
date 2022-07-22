export default function (q: QuantumAtom) {
  const eventListeners = {}
  Object.keys(q.atom.actions).forEach((name) => {
    if (name.startsWith('on')) {
      const nn = name.replace('on', '')
      if (checkUp(q, nn, name)) {
        return
      }
      if (nn.endsWith('Listener')) {
        const n = getName(nn, ['Listener'])
        eventListeners[camelToSnakeCase(n)] = name
        return
      }
    }
    if (q.molecule && name.startsWith('in')) {
      checkIn(q, name.replace('in', ''), name)
    }
  })
  return Object.keys(eventListeners).length ? eventListeners : false
}

function checkIn(q, nn, name) {
  const parts = camelToSnakeCase(nn).split('_')
  const module = parts[1].toLowerCase()
  const atom = q.molecule?.atoms[module]
  if (atom) {
    for (const up of upEnds) {
      const c = cap(up)
      if (nn.endsWith(c)) {
        const n = getName(nn, [cap(module), c])
        if (n) {
          atom.core[n][up](q.atom.actions[name])
          return true
        }
      }
    }
  }
  return false
}

const upEnds = ['up', 'upSome', 'upTrue', 'upFalse', 'upSomeFalse', 'upNone', 'upDown']

function checkUp(q, nn, name) {
  for (const up of upEnds) {
    const c = cap(up)
    // console.log('check', up, c)
    if (nn.endsWith(c)) {
      q.atom.core[getName(nn, [c])][up](q.atom.actions[name])
      return true
    }
  }
  return false
}

function getName(str, rm: string[]) {
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
