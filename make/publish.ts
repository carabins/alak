import { lib } from './make-lib'
import { readFileSync, readSync, writeFileSync } from 'fs'
import { executeCommand } from './helpers'
import { clearLib, tsc } from './tsc'
import * as http from 'http'
import * as path from 'path'
import { createPrivateKey } from 'crypto'
import * as fs from 'fs'

function pumpVersion() {
  // writeFileSync('./package.json', JSON.stringify(packageJSON, null, 2))
}

export async function publish(pkgName?) {
  await tsc(pkgName)
  const sourcePath = `./packages/${pkgName}/package.json`
  const packageJSON = JSON.parse(readFileSync(sourcePath, 'utf-8'))
  // let v = await executeCommand(`npm show ${packageJSON.pkgName} version`)
  // const remoteVer = v.toString().split('\n').shift()
  const newVerParts = packageJSON.version.split('.')
  let step = newVerParts.length - 1
  newVerParts[step] = (parseInt(newVerParts[step]) + 1).toString()
  const newVer = newVerParts.join('.')
  if (packageJSON.version != newVer) {
    packageJSON.version = newVer
    writeFileSync(sourcePath, JSON.stringify(packageJSON, null, 4))
  }
  // console.log({ v }, { remoteVer })

  writeFileSync(
    path.resolve(`./dist/packages/${pkgName}/package.json`),
    JSON.stringify(packageJSON, null, 2),
  )
  fs.copyFileSync(path.resolve(`./LICENSE`),path.resolve(`./dist/packages/${pkgName}/LICENSE`))

  await executeCommand('npm publish', path.resolve(`./dist/packages/${pkgName}`))

  // const remoteVer = v.toString().split('\n').shift()
  // if (packageJSON.version != remoteVer) {
  //   await executeCommand('npm publish')
  // }
}
