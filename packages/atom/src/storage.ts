const isBrowser = () => ![typeof window, typeof document].includes('undefined')

const isServer = !isBrowser()

export const storage = {
  init(nucleon: INucleus<any>) {
    if (isServer) {
      fsStore(nucleon)
    } else {
      browserStore(nucleon)
    }
  },
}

const fsProps = {
  dir: './.nuclearStore',
  isReady: false,
}

function fsStore(nucleon: INucleus<any>) {
  const fs = require('fs')
  const path = require('path')
  if (!fsProps.isReady) {
    fsProps.dir = path.resolve(fsProps.dir)
    if (!fs.existsSync(fsProps.dir)) {
      fs.mkdirSync(fsProps.dir)
    }
    fsProps.isReady = true
  }
  const filePatch = path.join(fsProps.dir, nucleon.id + '.json')
  let lastWrite
  let waiting
  const writeHandler = (v) => {
    if (!lastWrite || Date.now() - lastWrite > 300) {
      lastWrite = Date.now()
      fs.writeFile(filePatch, JSON.stringify(v), () => {})
    } else if (!waiting) {
      waiting = setTimeout(() => {
        lastWrite = Date.now()
        waiting = null
        fs.writeFile(filePatch, JSON.stringify(nucleon.value), () => {})
      }, 300)
    }
  }
  if (fs.existsSync(filePatch)) {
    const v = fs.readFileSync(filePatch)
    const vv = JSON.parse(v)
    nucleon(vv)
    nucleon.next(writeHandler)
  } else {
    nucleon.up(writeHandler)
  }
}

function browserStore(nucleon: INucleus<any>) {
  let v = localStorage.getItem(nucleon.id)
  const writeHandler = (v) => localStorage.setItem(nucleon.id, JSON.stringify(v))
  if (v && v != 'undefined') {
    let vv = JSON.parse(v)
    nucleon(vv)
    nucleon.next(writeHandler)
  } else {
    nucleon.up(writeHandler)
  }
  nucleon.onClear(() => {
    localStorage.removeItem(nucleon.id)
  })
}
