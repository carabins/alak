import { lib } from './make-lib'
import { readFileSync, readSync, writeFileSync } from 'fs'
import { executeCommand } from './helpers'
import { clearLib } from './tsc'
import * as http from 'http'


function pumpVersion() {
  const packageJSON = JSON.parse(readFileSync('./package.json', 'utf-8'))
  const versionParts = packageJSON.version.split('.')
  versionParts.push(parseInt(versionParts.pop()) + 1)
  packageJSON.version = versionParts.join('.')
  writeFileSync('./package.json', JSON.stringify(packageJSON, null, 2))
}

async function publish() {
  const packageJSON = JSON.parse(readFileSync('./package.json', 'utf-8'))
  let v = await executeCommand('npm show alak version')
  const remoteVer = v.toString().split("\n").shift()
  if (packageJSON.version != remoteVer) {
    await executeCommand('npm publish')
  }
}

publish()
