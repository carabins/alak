import { executeCommand, info, rm } from './helpers'
import * as path from "path"
import { copyFileSync, readFileSync, writeFileSync } from 'fs'
import { removeSync } from 'fs-extra'
const {log} = console
const chalk = require('chalk')


function joinTypings() {

}

export const tsc = async () => {
  info('compiling typescript packages...')
  rm('lib')
  const tsconfigPath = path.join('packages', 'tsconfig.json')
  const tsconfData = readFileSync('tsconfig.json', {
    encoding:"UTF-8"
  })
  const tsconfig = JSON.parse(tsconfData)
  delete tsconfig.files
  delete tsconfig.include
  writeFileSync(tsconfigPath, JSON.stringify(tsconfig))
  await executeCommand(
    `node ${path.resolve('node_modules/typescript/lib/tsc')} --outDir ../lib`,
    path.resolve('packages'),
  )
  rm(tsconfigPath)
  log(chalk.grey('typescript compiled'))
}
tsc()

