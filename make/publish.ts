import { lib } from './make-lib'
import { readFileSync, readSync, writeFileSync } from 'fs'
import { executeCommand } from './helpers'
import { clearLib, tsc } from './tsc'
import * as http from 'http'
import * as path from 'path'
import { createPrivateKey } from 'crypto'

function pumpVersion() {
  // writeFileSync('./package.json', JSON.stringify(packageJSON, null, 2))
}

export async function publish(pkgName?) {
  await tsc()
  const packageJSON = JSON.parse(
    readFileSync(path.resolve(`./packages/${pkgName}/package.json`)).toString(),
  )
  const versionParts = packageJSON.version.split('.')
  versionParts.push(parseInt(versionParts.pop()) + 1)
  packageJSON.version = versionParts.join('.')
  writeFileSync(
    path.resolve(`./dist/packages/${pkgName}/package.json`),
    JSON.stringify(packageJSON),
  )

  let v = await executeCommand('npm publish', path.resolve(`./dist/packages/${pkgName}`))
  // console.log(v)
  // const remoteVer = v.toString().split('\n').shift()
  // if (packageJSON.version != remoteVer) {
  //   await executeCommand('npm publish')
  // }
}
