import { Project } from './common/project'
import { FileLog, Log } from './log'
import { writeFile, writeJSONSync } from 'fs-extra'
import { writeFileSync } from 'fs'
import * as path from 'path'
import { Const } from './common/constants'
import * as fs from 'fs'
import { exec } from 'child_process'
import { versions } from '~/scripts/index'

export function upver(project: Project) {
  const trace = FileLog(project.packageJson.name + ' version')
  const v = project.packageJson.version
  const parts = v.split('.')
  let build = parseInt(parts.pop())
  // @ts-ignore
  build++
  if (isNaN(build as any)) {
    Log.error(build + 'build is Not A Number')
    Log.error('wrong version number', parts)
    throw 'wrong version number'
  }
  parts.push(build.toString())
  const nv = parts.join('.')
  trace('set version', nv)
  project.packageJson.version = nv
  versions[project.packageJson.name] = nv
  project.savePackageJsonTo.art()
}

export function publish(project: Project) {
  const trace = FileLog('publish:' + project.packageJson.name)
  project.savePackageJsonTo.source()

  trace('run npm publish --access public')

  exec(
    'npm publish --access public',
    {
      cwd: project.artPatch,
    },
    (error, stdout, stderr) => {
      if (error) {
        trace.error(`${error.message}`)
        return
      }
      if (stderr) {
        if (stderr.length > 30) {
          trace.error(`${stderr}`)
        }
        return
      }
      trace(`result\n`, stdout)
      trace('done')
    },
  )
}
