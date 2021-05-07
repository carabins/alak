import { executeCommand, info, rm } from './helpers'
import path from 'path'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import * as fs from 'fs'

export function clearLib() {
  info('clear js...')
  rm('src')
  rm('facade')
  rm('ext-matching')
  rm('ext-computed')
  rm('debug')
  rm('umd')
  rm('core.core.js')
  rm('core.js')
}

const chalk = require('chalk')
const { log } = console
const distPath = path.resolve('dist')

export const tsc = async (libName) => {
  info('compiling typescript packages...')
  rm(distPath)
  await executeCommand(
    'node ' + path.resolve('node_modules/typescript/lib/tsc'),
    path.resolve('.'),
  ).catch((e) => {
    console.warn(e)
  })


  const libPath = path.join('dist', 'packages', libName)
  const libSrcPath = path.join(libPath,'src')
  // fs.renameSync(path.join(libPath, 'src'), path.join(libPath, 'lib'))
  readdirSync(libSrcPath).forEach(f=>
    fs.renameSync(path.join(libSrcPath, f), path.join(libPath,f))
  )
  rm(libSrcPath)


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
  readDef(true, defPacks, distPath, path.join('packages', libName))
  // console.log('dist generics defined')
  // writeFileSync(path.join(distPath, 'packages', 'global.d.ts'), globalTDS)
  for (let key in defPacks) {
    let defs = defPacks[key]
    const sourceDefPacks = {}
    readDef(false, sourceDefPacks, path.resolve('packages'), key)
    console.log(`source generics for package "${key}" defined`)


    let indexDefs = ''
    for (let def in sourceDefPacks) {
      indexDefs += '\n' + sourceDefPacks[def]
    }
    writeFileSync(path.join(distPath, 'packages', key, 'definitions.d.ts'), indexDefs)


    //TODO
    let indexDtsPath = path.join(distPath, 'packages', key, 'index.d.ts')
    let indexDts = readFileSync(indexDtsPath).toString()
    writeFileSync(indexDtsPath, '/// <reference path="definitions.d.ts" />\n' + indexDts)
    console.log(`generation defs for module "${key}" is complete`)
  }
}
