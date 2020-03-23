import { executeCommand, info, prepare, rm } from './helpers'

import * as path from 'path'
import { copyFileSync, readFileSync, writeFileSync } from 'fs'
import { removeSync } from 'fs-extra'
import { fork } from 'child_process'
const { log } = console
const chalk = require('chalk')

import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import { rollup } from 'rollup'
import { tsc } from './tsc'


const packUmd = (packName, outName) =>
  new Promise(done =>
    rollup({
      input: `${packName}/${outName}.js`,

      plugins: [
        terser(),
        commonjs({
          ignoreGlobal: true,
          sourceMap: false,
        }),
      ],
    }).then(build =>
      build
        .write({
          file: `./${outName}.js`,
          format: 'umd',
          name: 'A',
        })
        .then(()=>{
          rm(`./${outName}.d.ts`)
          done()
        }),
    ),
  )

export async function lib(){
  info('make library...')
  await tsc()
  await packUmd('umd', 'atom')
  await packUmd('umd', 'atom.core')
  info('library created')
}

// rollup(rolupConfing("facade", "alak"))
// executeCommand(`node ${path.resolve('node_modules/jest/bin/jest')}`, path.resolve('.'))

// info('done')
