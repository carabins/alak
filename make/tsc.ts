import { executeCommand, info, rm } from './helpers'
import path from 'path'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs'

export function clearLib() {
  info('clear js...')
  rm('atom')
  rm('facade')
  rm('ext-matching')
  rm('ext-computed')
  rm('debug')
  rm('umd')
  rm('atom.core.js')
  rm('atom.js')
}

const chalk = require('chalk')
const { log } = console
const distPath = path.resolve('dist')

export const tsc = async () => {
  info('compiling typescript packages...')
  rm(distPath)
  await executeCommand(
    'node ' + path.resolve('node_modules/typescript/lib/tsc'),
    path.resolve('.'),
  ).catch((e) => {
    console.warn(e)
  })

  let globalTDS = readFileSync(path.resolve('packages/global.d.ts')).toString()

  const readDef = (remove, pack, p, name) => {
    let fp = path.join(p, name)
    let stat = statSync(fp)
    if (stat.isDirectory()) {
      readdirSync(fp).forEach((f) => readDef(remove, pack, fp, f))
    } else {
      if (name.slice(-5) === '.d.ts') {
        let pakName = remove ? p.split(`dist${path.sep}packages`)[1].split(path.sep)[1] : name
        if (!pack[pakName]) pack[pakName] = []
        pack[pakName].push(remove ? name : readFileSync(fp).toString())
        console.log('+/-', pakName, name)
        // if (remove) rm(fp)
      }
    }
  }
  const defPacks = {}
  readDef(true, defPacks, distPath, 'packages')
  console.log('dist generics defined')
  //writeFileSync(path.join(distPath, 'packages', 'global.d.ts'), globalTDS)
  for (let key in defPacks) {
    let defs = defPacks[key]
    const sourceDefPacks = {}
    readDef(false, sourceDefPacks, path.resolve('packages'), key)
    console.log(`source generics for package "${key}" defined`)

    // let indexDTS = '/// <reference path="global.d.ts" />'
    let inModuleGlobalDTS = globalTDS
    for (let def in sourceDefPacks) {
      inModuleGlobalDTS += '\n' + sourceDefPacks[def]
    }
    writeFileSync(path.join(distPath, 'packages', key, 'global.d.ts'), inModuleGlobalDTS)
    //TODO
    let indexDtsPath = path.join(distPath, 'packages', key, 'atom', 'index.d.ts')
    let indexDts = readFileSync(indexDtsPath).toString()
    writeFileSync(indexDtsPath, '/// <reference path="../global.d.ts" />\n' + indexDts)
    console.log(`generation defs for module "${key}" is complete`)
  }
}
