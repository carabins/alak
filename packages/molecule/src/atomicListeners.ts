export default function (q: QuantumAtom) {
  const eventListeners = {}
  Object.keys(q.atom.actions).forEach((name) => {
    if (name.startsWith('on')) {
      const nn = name.replace('on', '')
      if (nn.endsWith('Up')) {
        q.atom.core[getName(nn, 'Up')].up(q.atom.actions[name])
      }
      if (nn.endsWith('UpSome')) {
        q.atom.core[getName(nn, 'UpSome')].up(q.atom.actions[name])
      }
      if (nn.endsWith('Listener')) {
        const n = getName(nn, 'Listener')
        eventListeners[camelToSnakeCase(n)] = name
      }
    }
  })
  return Object.keys(eventListeners).length ? eventListeners : false
}

function getName(str, rmEnd) {
  str = str.replace(rmEnd, '')
  return str.substring(0, 0) + str[0].toLowerCase() + str.substring(1)
}
String.prototype['replaceAt'] = function (index, replacement) {
  return this.substring(0, index) + replacement + this.substring(index + replacement.length)
}

const camelToSnakeCase = (str) => str.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()
